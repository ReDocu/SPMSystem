-- SPM v0.1 스키마 (기획서 §7 데이터 모델의 v0.1 부분집합)
-- 규칙: 모든 테이블에 user_id + RLS(auth.uid() = user_id)

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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
  user_id uuid not null references auth.users (id) on delete cascade,
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
  user_id uuid not null references auth.users (id) on delete cascade,
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
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  content text,
  condition int check (condition between 1 and 4),
  unique (user_id, date)
);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_text text not null,
  source text not null default 'web',
  guessed_type text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_planned_date_idx on public.tasks (user_id, planned_date);
create index time_logs_date_idx on public.time_logs (user_id, date);
create index inbox_unprocessed_idx on public.inbox_items (user_id) where processed_at is null;

-- RLS: anon key가 프론트에 노출되므로 반드시 켠다 (기획서 §8.2-1)
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.time_logs enable row level security;
alter table public.daily_notes enable row level security;
alter table public.inbox_items enable row level security;

create policy "own projects" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own time_logs" on public.time_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily_notes" on public.daily_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own inbox_items" on public.inbox_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
