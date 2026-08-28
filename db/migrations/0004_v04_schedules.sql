-- SPM v0.4 — 일정(event) + 달별 현황판 (기획서 §7 schedules, 일정관리-상세기획 §5)
-- 반복은 rrule 문자열, 회차 취소는 exdates. 회차 변경 = exdate + 단발 일정 생성
-- 적용: docker exec 또는 psql "$DATABASE_URL" -f db/migrations/0004_v04_schedules.sql

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  rrule text,
  all_day boolean not null default false,
  category text not null default '일반' check (category in ('일반', '기념일', '출장', '수업')),
  exdates date[] not null default '{}',
  created_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create index schedules_range_idx on public.schedules (user_id, start_at);
