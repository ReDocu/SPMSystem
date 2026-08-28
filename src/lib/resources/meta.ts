export interface PageMeta {
  title: string;
  thumbnail?: string;
}

// og 메타 정규식 — property/content 속성 순서 양쪽 지원
const OG_FORWARD = (prop: string) =>
  new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i");
const OG_REVERSE = (prop: string) =>
  new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, "i");
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

function ogContent(html: string, prop: string): string | undefined {
  const value = html.match(OG_FORWARD(prop))?.[1] ?? html.match(OG_REVERSE(prop))?.[1];
  const trimmed = value ? decodeEntities(value).trim() : "";
  return trimmed || undefined;
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 파비콘은 서버 복사 없이 외부 URL 직접 참조 (상세기획 §2.1 원칙). */
export function faviconUrl(url: string): string | null {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/** og:title·og:image 추출 — 붙여넣으면 자동 채움, 체감 만족도가 가장 큰 기능 (상세기획 §2.1). */
export function extractPageMeta(html: string, baseUrl: string): PageMeta {
  const ogTitle = ogContent(html, "title");
  const docTitle = html.match(TITLE_RE)?.[1];
  const title =
    ogTitle ||
    (docTitle ? decodeEntities(docTitle).trim() : "") ||
    hostOf(baseUrl) ||
    baseUrl;

  let thumbnail: string | undefined;
  const ogImage = ogContent(html, "image");
  if (ogImage) {
    try {
      thumbnail = new URL(ogImage, baseUrl).href;
    } catch {
      thumbnail = undefined;
    }
  }

  return { title, ...(thumbnail && { thumbnail }) };
}
