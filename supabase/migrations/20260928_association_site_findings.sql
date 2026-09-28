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

create index if not exists association_site_findings_status_idx
  on public.association_site_findings (association_id, review_status, fetched_at desc);

alter table public.association_site_findings enable row level security;

drop policy if exists "Approved website findings are public" on public.association_site_findings;
create policy "Approved website findings are public" on public.association_site_findings
for select using (review_status = 'approved' or public.is_admin());

drop policy if exists "Admins review website findings" on public.association_site_findings;
create policy "Admins review website findings" on public.association_site_findings
for update to authenticated using (public.is_admin()) with check (public.is_admin());
