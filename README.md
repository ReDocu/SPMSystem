# SPM — Single Project Management

1인 사용자 전용 개인 관리 도구. 일정, 프로젝트, 운영·배포, 자료수집을 하나의 시스템에서 관리한다.
**로컬 실행 전용** — 데이터는 로컬 Postgres, 인증은 PIN 잠금 하나다.

## 개발

```bash
npm install
cp .env.example .env.local           # DATABASE_URL, SPM_PIN, SPM_SECRET

# DB: Docker Desktop (WSL2 필요)
docker compose up -d                 # postgres:17 → localhost:5432/spm
docker compose exec -T db psql -U postgres -d spm < db/migrations/0001_v01_init.sql

npm run dev                          # http://localhost:3000
npm test                             # vitest
npm run build
```

`SPM_PIN`을 비워두면 잠금 없이 바로 진입한다 (로컬 개발 편의).

## 로드맵

| 버전 | 범위 |
|---|---|
| v0.1 (현재) | PIN 잠금, 인박스 캡처, 일별 기록지, JSON export |
| v0.2 | 자료수집 v1 + 북마클릿 |
| v0.3 | 프로젝트 CRUD + 게이트 + 칸반 + 연별 목표 |
| v0.4 | 달별 현황판 + 일정 CRUD |
| v0.5 | 운영·배포 (플랫폼 카탈로그, 배포 이력, 비용) |
| v0.6 | 통계, 회고, 외부 연동 |

기획 문서는 `planner/`, 디자인 원본은 `SPMSystem.pen` (Pencil 전용) 참조.
