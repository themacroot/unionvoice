alter table public.associations add column if not exists association_type text not null default 'bank';
alter table public.associations add column if not exists parent_id uuid references public.associations (id) on delete set null;
alter table public.associations add column if not exists homepage_url text;

alter table public.association_requests add column if not exists association_type text not null default 'bank';
alter table public.association_requests add column if not exists parent_id uuid references public.associations (id) on delete set null;
alter table public.association_requests add column if not exists homepage_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'associations_association_type_check') then
    alter table public.associations add constraint associations_association_type_check
      check (association_type in ('apex', 'bank', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'associations_homepage_url_check') then
    alter table public.associations add constraint associations_homepage_url_check
      check (homepage_url is null or homepage_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'association_requests_association_type_check') then
    alter table public.association_requests add constraint association_requests_association_type_check
      check (association_type in ('apex', 'bank', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'association_requests_homepage_url_check') then
    alter table public.association_requests add constraint association_requests_homepage_url_check
      check (homepage_url is null or homepage_url ~* '^https?://');
  end if;
end;
$$;

insert into public.associations (name, acronym, description, association_type, status)
values ('All India Bank Officers Confederation', 'AIBOC', 'Apex body for affiliated bank officers associations', 'apex', 'approved')
on conflict (acronym) do nothing;

insert into public.associations (name, acronym, description, association_type, parent_id, status)
select 'SIB''s Officers Association', 'SIBOA', 'South Indian Bank Officers Association', 'bank', id, 'approved'
from public.associations where acronym = 'AIBOC'
on conflict (acronym) do update set parent_id = coalesce(public.associations.parent_id, excluded.parent_id);
