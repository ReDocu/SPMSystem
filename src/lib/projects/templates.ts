// 문서 탭 템플릿 4종 프리셋 (상세기획 §5.3 P2)

export const DOC_TEMPLATES: Record<string, { label: string; content: string }> = {
  spec: {
    label: "기능 명세",
    content: `# 기능 명세

## 개요
-

## 기능 목록
| 기능 | 설명 | 우선순위 |
|---|---|---|
|  |  |  |

## 만들지 않는 것
-
`,
  },
  screen: {
    label: "화면설계",
    content: `# 화면설계

## 화면 목록
| 화면 | 라우팅 | 설명 |
|---|---|---|
|  |  |  |

## 와이어프레임 메모
-
`,
  },
  erd: {
    label: "ERD",
    content: `# ERD

## 테이블
\`\`\`
table_name   id, ...
\`\`\`

## 관계
-
`,
  },
  api: {
    label: "API 스펙",
    content: `# API 스펙

## 엔드포인트
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET |  |  |

## 공통 응답
\`\`\`json
{ }
\`\`\`
`,
  },
};
