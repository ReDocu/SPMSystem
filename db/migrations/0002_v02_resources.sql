-- SPM v0.2 — 자료수집 (자료수집-상세기획 §3)
-- 유형은 site | idea 2종. summary·read_status는 추후 풀 (YAGNI)
-- 적용: docker exec 또는 psql "$DATABASE_URL" -f db/migrations/0002_v02_resources.sql

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('site', 'idea')),
  url text,
  title text not null,
  memo text,
  content text,
  thumbnail text,
  category text,
  created_at timestamptz not null default now()
);

create index resources_type_idx on public.resources (user_id, type, created_at desc);
create index resources_category_idx on public.resources (user_id, category) where type = 'site';
