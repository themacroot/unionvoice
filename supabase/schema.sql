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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.associations add column if not exists association_type text not null default 'bank';
alter table public.associations add column if not exists parent_id uuid references public.associations (id) on delete set null;
alter table public.associations add column if not exists homepage_url text;

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

create index if not exists questions_feed_idx on public.questions (created_at desc) where status = 'published';
create index if not exists questions_association_idx on public.questions (association_id, created_at desc);
create index if not exists answers_question_idx on public.answers (question_id, created_at);
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

insert into public.associations (name, acronym, description, association_type, status)
values ('All India Bank Officers Confederation', 'AIBOC', 'Apex body for affiliated bank officers associations', 'apex', 'approved')
on conflict (acronym) do nothing;

insert into public.associations (name, acronym, description, association_type, parent_id, status)
select 'SIB''s Officers Association', 'SIBOA', 'South Indian Bank Officers Association', 'bank', id, 'approved'
from public.associations where acronym = 'AIBOC'
on conflict (acronym) do update set parent_id = coalesce(public.associations.parent_id, excluded.parent_id);

-- Bootstrap after your first Google sign-in by replacing the email below, then run once in SQL Editor.
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@example.com');
-- Add representatives in Table Editor or SQL Editor after they have signed in:
-- insert into public.association_members (association_id, user_id) values ('<SIBOA_UUID>', '<REPRESENTATIVE_PROFILE_UUID>');
