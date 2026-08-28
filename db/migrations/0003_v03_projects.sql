-- SPM v0.3 — 프로젝트 관리 (프로젝트관리-상세기획 §6·§10)
-- projects 본체는 0001에서 이미 생성됨 (purpose·scope 등 G1~G2 필드 포함)
-- 적용: docker exec 또는 psql "$DATABASE_URL" -f db/migrations/0003_v03_projects.sql

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date,
  weight int not null default 1 check (weight between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  content text,
  template_type text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 상태 전이 자동 기록 — 생애 타임라인(v0.5)의 뼈대. v0.3부터 로깅 시작 (§6.4)
create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null default 'transition',
  from_status text,
  to_status text,
  occurred_at timestamptz not null default now(),
  note text
);

alter table public.tasks
  add column milestone_id uuid references public.milestones (id) on delete set null;

create index milestones_project_idx on public.milestones (user_id, project_id, due_date);
create index documents_project_idx on public.documents (user_id, project_id, updated_at desc);
create index project_events_project_idx on public.project_events (user_id, project_id, occurred_at);
create index tasks_project_idx on public.tasks (user_id, project_id) where project_id is not null;
create index tasks_target_year_idx on public.tasks (user_id, target_year) where target_year is not null;
