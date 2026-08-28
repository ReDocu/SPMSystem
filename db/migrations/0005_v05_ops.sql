-- SPM v0.5 — 운영·배포 (운영배포-상세기획 §10)
-- 원칙: 시크릿 값·가격 자동 수집 없음 — 메타데이터와 기록만
-- 적용: docker exec 또는 psql "$DATABASE_URL" -f db/migrations/0005_v05_ops.sql

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('웹·클라우드', '게임', '모바일 스토어', '도메인·구독')),
  homepage_url text,
  pricing_url text,
  free_tier_note text,
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,                 -- prod / staging / db …
  platform_id uuid references public.platforms (id) on delete set null,
  host text,
  domain text,
  ssl_expires_at date,
  secrets jsonb not null default '[]', -- [{key, location, purpose}] — 값 필드 자체가 없다
  created_at timestamptz not null default now()
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  environment_id uuid not null references public.environments (id) on delete cascade,
  version text not null,
  deployed_at timestamptz not null default now(),
  changelog text,
  rolled_back boolean not null default false,
  checklist_snapshot jsonb,           -- [{item, checked}] — 그때 뭘 확인했는지 (§7.2)
  created_at timestamptz not null default now()
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- incidents(장애 기록)는 로드맵 버전 미배정 — 설계 확정 후 별도 마이그레이션으로 (상세기획 §8)

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  platform_id uuid references public.platforms (id) on delete set null,
  name text not null,
  amount numeric not null default 0,   -- 무료 티어도 0원 등록 = 사용 중 인벤토리 (§9)
  currency text not null default 'KRW',
  cycle text not null default 'monthly' check (cycle in ('monthly', 'yearly', 'once')),
  next_billing_at date,
  price_checked_at date,
  created_at timestamptz not null default now()
);

alter table public.projects
  add column platform_id uuid references public.platforms (id) on delete set null;

create index environments_project_idx on public.environments (user_id, project_id);
create index deployments_env_idx on public.deployments (user_id, environment_id, deployed_at desc);
create index costs_billing_idx on public.costs (user_id, next_billing_at);

-- ---------- 시드: 플랫폼 카탈로그 (상세기획 §3.3 O2 — 4카테고리 전부) ----------
insert into public.platforms (user_id, name, category, homepage_url, pricing_url, free_tier_note, is_custom)
select u.id, s.name, s.category, s.homepage, s.pricing, s.note, false
from (select id from public.users order by created_at limit 1) u,
(values
  ('Vercel', '웹·클라우드', 'https://vercel.com', 'https://vercel.com/pricing', 'Hobby 무료 — 크론 1회/일, 상업적 사용 제한'),
  ('Netlify', '웹·클라우드', 'https://netlify.com', 'https://www.netlify.com/pricing/', '무료 300 빌드분/월'),
  ('Cloudflare', '웹·클라우드', 'https://cloudflare.com', 'https://www.cloudflare.com/plans/', 'Pages·Workers 무료 티어 넉넉'),
  ('Supabase', '웹·클라우드', 'https://supabase.com', 'https://supabase.com/pricing', '무료 DB 500MB · 7일 무활동 정지'),
  ('Railway', '웹·클라우드', 'https://railway.app', 'https://railway.app/pricing', '무료 크레딧 $5/월'),
  ('Render', '웹·클라우드', 'https://render.com', 'https://render.com/pricing', '무료 웹서비스 — 15분 무활동 슬립'),
  ('Fly.io', '웹·클라우드', 'https://fly.io', 'https://fly.io/pricing', '소형 VM 무료 한도'),
  ('AWS', '웹·클라우드', 'https://aws.amazon.com', 'https://aws.amazon.com/pricing/', '12개월 프리 티어'),
  ('GitHub Pages', '웹·클라우드', 'https://pages.github.com', 'https://github.com/pricing', '정적 호스팅 무료'),
  ('Steam', '게임', 'https://store.steampowered.com', 'https://partner.steamgames.com/steamdirect', 'Steamworks $100/게임 (환급 가능)'),
  ('itch.io', '게임', 'https://itch.io', 'https://itch.io/docs/creators/pricing', '무료 — 수익 분배 조절 가능'),
  ('Epic Games Store', '게임', 'https://store.epicgames.com', 'https://dev.epicgames.com/ko/services', '등록 $100/앱'),
  ('Google Play', '모바일 스토어', 'https://play.google.com/console', 'https://support.google.com/googleplay/android-developer/answer/6112435', '$25 1회'),
  ('App Store', '모바일 스토어', 'https://developer.apple.com', 'https://developer.apple.com/kr/support/enrollment/', '$99/년'),
  ('가비아', '도메인·구독', 'https://gabia.com', 'https://domain.gabia.com/regist/price', '.com ₩22,000/년 내외'),
  ('Namecheap', '도메인·구독', 'https://namecheap.com', 'https://www.namecheap.com/domains/', '.com $10~15/년'),
  ('Cloudflare Registrar', '도메인·구독', 'https://cloudflare.com', 'https://www.cloudflare.com/products/registrar/', '원가 판매'),
  ('OpenAI API', '도메인·구독', 'https://platform.openai.com', 'https://openai.com/api/pricing/', '종량제'),
  ('Anthropic API', '도메인·구독', 'https://console.anthropic.com', 'https://www.anthropic.com/pricing', '종량제'),
  ('UptimeRobot', '도메인·구독', 'https://uptimerobot.com', 'https://uptimerobot.com/pricing/', '무료 50 모니터/5분 간격'),
  ('Sentry', '도메인·구독', 'https://sentry.io', 'https://sentry.io/pricing/', '무료 5K 에러/월')
) as s(name, category, homepage, pricing, note);

-- 시드: 기본 배포 체크리스트 1종 (§7.2)
insert into public.checklist_templates (user_id, project_id, name, items)
select u.id, null, '기본 배포 체크리스트',
  '["환경변수 확인", "DB 마이그레이션", "백업 확인", "롤백 계획"]'::jsonb
from (select id from public.users order by created_at limit 1) u;
