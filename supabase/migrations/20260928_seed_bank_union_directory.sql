alter table public.associations add column if not exists source_url text
  check (source_url is null or source_url ~* '^https?://');

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
  ('Canara Bank Officers'' Association', 'CBOA', 'Officers'' association for Canara Bank.'),
  ('Federation of Bank of Baroda Officers'' Associations', 'FBBOA', 'Federation of officers'' associations for Bank of Baroda.'),
  ('Indian Overseas Bank Officers'' Association', 'IOBOA', 'Officers'' association for Indian Overseas Bank.'),
  ('All India Indian Bank Officers'' Association', 'AIIBOA', 'Officers'' association for Indian Bank.'),
  ('All India Union Bank Officers'' Federation', 'AIUBOF', 'Officers'' federation for Union Bank of India.'),
  ('All India UCO Bank Officers'' Federation', 'AIUCOBOF', 'Officers'' federation for UCO Bank.'),
  ('All India Punjab National Bank Officers'' Association', 'AIPNBOA', 'Officers'' association for Punjab National Bank.'),
  ('All India Central Bank Officers'' Federation', 'AICBOF', 'Officers'' federation for Central Bank of India.'),
  ('The Federation BOI Officers'' Association', 'FBOIOA', 'Officers'' federation for Bank of India.'),
  ('All India State Bank Officers'' Federation', 'AISBOF', 'Officers'' federation for State Bank of India.'),
  ('Association of Standard Chartered Bank Officers'' Kolkata', 'ASCBOK', 'Officers'' association for Standard Chartered Bank in Kolkata.'),
  ('Catholic Syrian Bank Officers'' Association', 'CSBOA', 'Officers'' association for Catholic Syrian Bank (now CSB Bank).'),
  ('South Indian Bank Officers'' Association', 'SIBOA', 'Officers'' association for South Indian Bank.'),
  ('Federal Bank Officers'' Association', 'FBOA', 'Officers'' association for Federal Bank.'),
  ('Karur Vysya Bank Officers'' Association', 'KVBOA', 'Officers'' association for Karur Vysya Bank.'),
  ('Dhanalakshmi Bank Officers'' Organization', 'DBOO', 'Officers'' organization for Dhanlaxmi Bank.'),
  ('Lakshmi Vilas Bank Officers'' Association', 'LVBOA', 'Officers'' association listed for Lakshmi Vilas Bank; verify current status following the bank''s merger.'),
  ('All India Regional Rural Bank Officers'' Federation', 'AIRRBOF', 'Federation representing officers'' organizations in Regional Rural Banks.')
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