-- SPM v0.1 스키마 — 로컬 Postgres (기획서 v0.3 §7·§8)
-- 규칙: 모든 테이블에 user_id (기획서 §7 규칙 2 — 지금은 1인이어도 유지)
-- 적용: psql "$DATABASE_URL" -f db/migrations/0001_v01_init.sql

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'me',
  created_at timestamptz not null default now()
);

insert into public.users (name) values ('me');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  status text not null default 'idea',
  description text,
  purpose text,
  target_user text,
  scope_in text,
  scope_out text,
  tech_stack text[],
  repo_url text,
  deploy_url text,
  progress numeric not null default 0,
  color text,
  started_at date,
  ended_at date,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  status text not null default 'todo',
  priority int,
  due_date date,
  planned_date date,
  target_year int,
  estimated_min int,
  actual_min int not null default 0,
  created_at timestamptz not null default now()
);

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440 and end_min > start_min),
  content text not null,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  content text,
  condition int check (condition between 1 and 4),
  unique (user_id, date)
);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  raw_text text not null,
  source text not null default 'web',
  guessed_type text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_planned_date_idx on public.tasks (user_id, planned_date);
create index time_logs_date_idx on public.time_logs (user_id, date);
create index inbox_unprocessed_idx on public.inbox_items (user_id) where processed_at is null;
