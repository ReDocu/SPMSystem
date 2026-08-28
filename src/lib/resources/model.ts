// 클라이언트에서도 쓰는 타입·상수 — pg를 끌고 오는 repo.ts와 분리 (서버 전용 코드 번들 방지)

export type ResourceType = "site" | "idea";

export interface Resource {
  id: string;
  type: ResourceType;
  url: string | null;
  title: string;
  memo: string | null;
  content: string | null;
  thumbnail: string | null;
  category: string | null;
  createdAt: string;
}

export const DEFAULT_CATEGORIES = ["디자인", "개발", "기획", "기타"] as const;
export const FALLBACK_CATEGORY = "기타"; // 인박스 URL은 '기타'로 즉시 저장, 분류는 후처리 (USE-02)
