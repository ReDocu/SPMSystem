# SPM — Single Project Management

1인 사용자 전용 개인 관리 도구. 일정, 프로젝트, 운영·배포, 자료수집을 하나의 시스템에서 관리한다.

## 개발

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build
```

Supabase 연동은 `.env.example`을 `.env.local`로 복사한 뒤 프로젝트 키를 채우고,
`supabase/migrations/`의 SQL을 Supabase SQL Editor에서 실행한다.

## 로드맵

| 버전 | 범위 |
|---|---|
| v0.1 (현재) | 로그인, 인박스 캡처, 일별 기록지, JSON export |
| v0.2 | 자료수집 v1 + 북마클릿 |
| v0.3 | 프로젝트 CRUD + 게이트 + 칸반 + 연별 목표 |
| v0.4 | 달별 현황판 + 일정 CRUD |
| v0.5 | 운영·배포 (플랫폼 카탈로그, 배포 이력, 비용) |
| v0.6 | 통계, 회고, 외부 연동 |

기획 문서는 `planner/`, 디자인 원본은 `SPMSystem.pen` (Pencil 전용) 참조.
