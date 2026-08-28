-- SPM v0.6 — G4 회고 (프로젝트관리-상세기획 §5.4·§6.3)
-- 수치는 작성 시점 스냅샷(stats json) — 이후 데이터가 변해도 회고는 그대로
-- 역전이 후 재종료 시 기존 행 재사용 (project_id unique, BUG-04)
-- 적용: docker exec 또는 psql "$DATABASE_URL" -f db/migrations/0006_v06_retro.sql

create table public.retrospectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null unique references public.projects (id) on delete cascade,
  good text,
  bad text,
  learned text,
  never_again text,          -- 가장 중요한 문항
  stats jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
