create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text not null unique,
  description text,
  association_type text not null default 'bank' check (association_type in ('apex', 'bank', 'other')),
  parent_id uuid references public.associations (id) on delete set null,
  homepage_url text check (homepage_url is null or homepage_url ~* '^https?://'),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.associations add column if not exists association_type text not null default 'bank';
alter table public.associations add column if not exists parent_id uuid references public.associations (id) on delete set null;
alter table public.associations add column if not exists homepage_url text;
alter table public.associations add column if not exists source_url text;

create table if not exists public.association_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text not null,
  description text,
  contact_email text not null,
  association_type text not null default 'bank' check (association_type in ('apex', 'bank', 'other')),
  parent_id uuid references public.associations (id) on delete set null,
  homepage_url text check (homepage_url is null or homepage_url ~* '^https?://'),
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  association_id uuid references public.associations (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.association_requests add column if not exists association_type text not null default 'bank';
alter table public.association_requests add column if not exists parent_id uuid references public.associations (id) on delete set null;
alter table public.association_requests add column if not exists homepage_url text;

create table if not exists public.association_members (
  association_id uuid not null references public.associations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'representative' check (role in ('representative', 'moderator')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  primary key (association_id, user_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations (id),
  user_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 5 and 160),
  body text not null check (char_length(body) between 10 and 10000),
  department text,
  cluster text,
  region text,
  is_anonymous boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  association_id uuid not null references public.associations (id),
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 2 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.association_site_findings (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations (id) on delete cascade,
  source_url text not null check (source_url ~* '^https://'),
  page_title text not null,
  excerpt text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'hidden')),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (association_id, source_url)
);

create index if not exists questions_feed_idx on public.questions (created_at desc) where status = 'published';
create index if not exists questions_association_idx on public.questions (association_id, created_at desc);
create index if not exists answers_question_idx on public.answers (question_id, created_at);
create index if not exists association_site_findings_status_idx on public.association_site_findings (association_id, review_status, fetched_at desc);
create index if not exists association_requests_status_idx on public.association_requests (status, created_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function public.is_association_representative(target_association uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.association_members
    where association_id = target_association and user_id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.associations enable row level security;
alter table public.association_requests enable row level security;
alter table public.association_members enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.association_site_findings enable row level security;

create policy "Profiles are visible to signed-in users" on public.profiles
for select to authenticated using (true);

create policy "Approved associations are public" on public.associations
for select using (status = 'approved' or public.is_admin());
create policy "Admins manage associations" on public.associations
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Signed-in users request associations" on public.association_requests
for insert to authenticated with check (requested_by = (select auth.uid()) and status = 'pending');
create policy "Requesters and admins view association requests" on public.association_requests
for select to authenticated using (requested_by = (select auth.uid()) or public.is_admin());
create policy "Admins review association requests" on public.association_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users see own memberships and admins see all" on public.association_members
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins manage association memberships" on public.association_members
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Published questions are public" on public.questions
for select using (status = 'published');
create policy "Questions require an approved association" on public.questions
for insert with check (
  status = 'published'
  and exists (select 1 from public.associations a where a.id = association_id and a.status = 'approved')
  and (user_id is null or user_id = (select auth.uid()))
);
create policy "Admins moderate questions" on public.questions
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete questions" on public.questions
for delete to authenticated using (public.is_admin());

create policy "Answers on published questions are public" on public.answers
for select using (exists (select 1 from public.questions q where q.id = question_id and q.status = 'published'));
create policy "Association representatives answer" on public.answers
for insert to authenticated with check (
  author_id = (select auth.uid())
  and public.is_association_representative(association_id)
  and exists (select 1 from public.questions q where q.id = question_id and q.association_id = association_id and q.status = 'published')
);
create policy "Authors and admins edit answers" on public.answers
for update to authenticated using (author_id = (select auth.uid()) or public.is_admin())
with check (author_id = (select auth.uid()) or public.is_admin());

create policy "Approved website findings are public" on public.association_site_findings
for select using (review_status = 'approved' or public.is_admin());
create policy "Admins review website findings" on public.association_site_findings
for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.associations (name, acronym, description, association_type, status)
values ('All India Bank Officers Confederation', 'AIBOC', 'Apex body for affiliated bank officers associations', 'apex', 'approved')
on conflict (acronym) do nothing;

insert into public.associations (name, acronym, description, association_type, parent_id, status)
select 'SIB''s Officers Association', 'SIBOA', 'South Indian Bank Officers Association', 'bank', id, 'approved'
from public.associations where acronym = 'AIBOC'
on conflict (acronym) do update set parent_id = coalesce(public.associations.parent_id, excluded.parent_id);

update public.associations
set homepage_url = 'https://aiboc.org/', source_url = 'https://aiboc.org/'
where acronym = 'AIBOC';

update public.associations
set source_url = 'https://aiboc.org/aiboc-affiliates/'
where acronym = 'SIBOA';

insert into public.associations (name, acronym, description, association_type, homepage_url, source_url, status)
values
  ('All India Bank Employees'' Association', 'AIBEA', 'National bank employees'' union representing workmen, including clerical and subordinate staff.', 'apex', 'https://aibea.in/', 'https://aibea.in/', 'approved'),
  ('Bank Employees Federation of India', 'BEFI', 'National federation representing bank employees through its affiliated unions.', 'apex', 'https://www.befi.in/index.php', 'https://www.befi.in/index.php', 'approved')
on conflict (acronym) do update set
  name = excluded.name,
  description = excluded.description,
  association_type = excluded.association_type,
  homepage_url = excluded.homepage_url,
  source_url = excluded.source_url,
  status = excluded.status;

with aiboc as (select id from public.associations where acronym = 'AIBOC'),
affiliates(name, acronym, description) as (values
  ('Canara Bank Officers’ Association', 'CBOA', 'Officers’ association for Canara Bank.'),
  ('Federation of Bank of Baroda Officers’ Associations', 'FBBOA', 'Federation of officers’ associations for Bank of Baroda.'),
  ('Indian Overseas Bank Officers’ Association', 'IOBOA', 'Officers’ association for Indian Overseas Bank.'),
  ('All India Indian Bank Officers’ Association', 'AIIBOA', 'Officers’ association for Indian Bank.'),
  ('All India Union Bank Officers’ Federation', 'AIUBOF', 'Officers’ federation for Union Bank of India.'),
  ('All India UCO Bank Officers’ Federation', 'AIUCOBOF', 'Officers’ federation for UCO Bank.'),
  ('All India Punjab National Bank Officers’ Association', 'AIPNBOA', 'Officers’ association for Punjab National Bank.'),
  ('All India Central Bank Officers’ Federation', 'AICBOF', 'Officers’ federation for Central Bank of India.'),
  ('The Federation BOI Officers’ Association', 'FBOIOA', 'Officers’ federation for Bank of India.'),
  ('All India State Bank Officers’ Federation', 'AISBOF', 'Officers’ federation for State Bank of India.'),
  ('Association of Standard Chartered Bank Officers’ Kolkata', 'ASCBOK', 'Officers’ association for Standard Chartered Bank in Kolkata.'),
  ('Catholic Syrian Bank Officers’ Association', 'CSBOA', 'Officers’ association for Catholic Syrian Bank (now CSB Bank).'),
  ('South Indian Bank Officers’ Association', 'SIBOA', 'Officers’ association for South Indian Bank.'),
  ('Federal Bank Officers’ Association', 'FBOA', 'Officers’ association for Federal Bank.'),
  ('Karur Vysya Bank Officers’ Association', 'KVBOA', 'Officers’ association for Karur Vysya Bank.'),
  ('Dhanalakshmi Bank Officers’ Organization', 'DBOO', 'Officers’ organization for Dhanlaxmi Bank.'),
  ('Lakshmi Vilas Bank Officers’ Association', 'LVBOA', 'Officers’ association listed for Lakshmi Vilas Bank; verify current status following the bank’s merger.'),
  ('All India Regional Rural Bank Officers’ Federation', 'AIRRBOF', 'Federation representing officers’ organizations in Regional Rural Banks.')
)
insert into public.associations (name, acronym, description, association_type, parent_id, source_url, status)
select affiliates.name, affiliates.acronym, affiliates.description, 'bank', aiboc.id,
  'https://aiboc.org/aiboc-affiliates/', 'approved'
from affiliates cross join aiboc
on conflict (acronym) do update set
  name = excluded.name,
  description = excluded.description,
  association_type = excluded.association_type,
  parent_id = excluded.parent_id,
  source_url = excluded.source_url,
  status = excluded.status;

-- Bootstrap after your first Google sign-in by replacing the email below, then run once in SQL Editor.
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@example.com');
-- Add representatives in Table Editor or SQL Editor after they have signed in:
-- insert into public.association_members (association_id, user_id) values ('<SIBOA_UUID>', '<REPRESENTATIVE_PROFILE_UUID>');
