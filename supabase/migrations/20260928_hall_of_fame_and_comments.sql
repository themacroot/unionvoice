create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations (id),
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  title text not null check (char_length(title) between 5 and 160),
  body text not null check (char_length(body) between 10 and 10000),
  achieved_on date,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions (id) on delete cascade,
  achievement_id uuid references public.achievements (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  author_name text,
  body text not null check (char_length(body) between 2 and 4000),
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  constraint comments_single_target check (
    (question_id is not null and achievement_id is null)
    or (question_id is null and achievement_id is not null)
  )
);

create index if not exists achievements_feed_idx on public.achievements (created_at desc) where status = 'published';
create index if not exists achievements_association_idx on public.achievements (association_id, created_at desc);
create index if not exists comments_question_idx on public.comments (question_id, created_at);
create index if not exists comments_achievement_idx on public.comments (achievement_id, created_at);

alter table public.achievements enable row level security;
alter table public.comments enable row level security;

create policy "Published achievements are public" on public.achievements
for select using (status = 'published' or public.is_admin());
create policy "Signed-in users post achievements" on public.achievements
for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.associations a where a.id = association_id and a.status = 'approved')
);
create policy "Admins moderate achievements" on public.achievements
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete achievements" on public.achievements
for delete to authenticated using (public.is_admin());

create policy "Comments on visible content are public" on public.comments
for select using (
  (question_id is not null and exists (select 1 from public.questions q where q.id = question_id and q.status = 'published'))
  or (achievement_id is not null and exists (select 1 from public.achievements a where a.id = achievement_id and a.status = 'published'))
  or public.is_admin()
);
create policy "Comments require a published target" on public.comments
for insert with check (
  (user_id is null or user_id = (select auth.uid()))
  and (
    (question_id is not null and exists (select 1 from public.questions q where q.id = question_id and q.status = 'published'))
    or (achievement_id is not null and exists (select 1 from public.achievements a where a.id = achievement_id and a.status = 'published'))
  )
);
create policy "Admins delete comments" on public.comments
for delete to authenticated using (public.is_admin());
