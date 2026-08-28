@AGENTS.md

# SPM (Single Project Management)

1인 사용자 전용 개인 관리 도구. 일정 · 프로젝트 · 운영/배포 · 자료수집을 한 시스템에서 관리한다.

## 기획 문서 (구현 전 반드시 참조)

- `planner/SPM-기획서.md` — 마스터 기획서 v0.2 (데이터 모델 §7, 스택 §8, 로드맵 §12)
- `planner/화면명세서.md` — 전 화면 라우팅·요소 명세
- `planner/{일정관리,프로젝트관리,운영배포,자료수집}-상세기획.md` — 영역별 상세
- 와이어프레임: `planner/wireframe/` (아티팩트 캔버스 원본), 디자인: `SPMSystem.pen` (Pencil MCP로만 열 것)

## 스택 · 구조

- Next.js App Router + TypeScript + Tailwind v4 / Supabase (Postgres + Auth + RLS) / Vercel Hobby
- 디자인 토큰: `src/app/globals.css` — SPMSystem.pen 변수와 1:1 ($bg, $ink, $primary …)
- 라우팅: `/`(런처, 사이드바 없음) · `(app)/` 그룹(사이드바) · `/login`
- 인박스 자동 추정: `src/lib/capture/parse.ts` (기획서 §4.2 규칙, 테스트 필수)
- DB: `supabase/migrations/` — 모든 테이블 user_id + RLS(auth.uid() = user_id)

## 원칙 (기획서에서 강제)

- 로드맵 버전(v0.1~v0.6) 밖의 기능을 미리 만들지 않는다. 미구현 영역 메뉴는 숨긴다 (ISSUE-11)
- 삭제는 확인 모달 금지 — 즉시 실행 + 5초 되돌리기. 생성·수정은 인라인 우선, 모달은 게이트 카드뿐
- `/api/health`는 DB 조회 포함 필수 (Supabase 무활동 정지 방지)
- JSON export는 v0.1부터 유지 (유일한 백업 수단)
- 테스트: `npm test` (vitest) — 로직(lib)은 테스트 먼저
