import { describe, expect, test } from "vitest";
import { extractPageMeta, faviconUrl, hostOf } from "./meta";

const URL_BASE = "https://blog.example.com/posts/spm";

describe("extractPageMeta — og 태그 우선, 없으면 <title>, 그것도 없으면 도메인", () => {
  test("og:title과 og:image를 추출한다", () => {
    const html = `<html><head>
      <meta property="og:title" content="SPM 개발기" />
      <meta property="og:image" content="https://cdn.example.com/cover.png" />
      <title>블로그 — SPM 개발기</title>
    </head></html>`;
    expect(extractPageMeta(html, URL_BASE)).toEqual({
      title: "SPM 개발기",
      thumbnail: "https://cdn.example.com/cover.png",
    });
  });

  test("og:title이 없으면 <title>을 쓴다", () => {
    const html = `<html><head><title>  문서 제목  </title></head></html>`;
    expect(extractPageMeta(html, URL_BASE).title).toBe("문서 제목");
  });

  test("둘 다 없으면 호스트명을 제목으로 쓴다", () => {
    expect(extractPageMeta("<html></html>", URL_BASE).title).toBe("blog.example.com");
  });

  test("상대 경로 og:image는 절대 URL로 변환한다", () => {
    const html = `<meta property="og:image" content="/img/cover.png">`;
    expect(extractPageMeta(html, URL_BASE).thumbnail).toBe("https://blog.example.com/img/cover.png");
  });

  test("content/property 순서가 바뀌어도 추출한다", () => {
    const html = `<meta content="역순 제목" property="og:title">`;
    expect(extractPageMeta(html, URL_BASE).title).toBe("역순 제목");
  });

  test("HTML 엔티티를 해제한다", () => {
    const html = `<title>A &amp; B &#39;C&#39;</title>`;
    expect(extractPageMeta(html, URL_BASE).title).toBe("A & B 'C'");
  });

  test("잘못된 og:image URL은 무시한다", () => {
    const html = `<meta property="og:image" content="not a url ??">`;
    expect(extractPageMeta(html, "잘못된 base도").thumbnail).toBeUndefined();
  });
});

describe("hostOf · faviconUrl — 도메인·파비콘 (외부 URL 직접 참조)", () => {
  test("호스트명을 뽑는다", () => {
    expect(hostOf("https://www.example.com/a/b?c=1")).toBe("www.example.com");
    expect(hostOf("잘못된 url")).toBeNull();
  });

  test("파비콘은 origin/favicon.ico", () => {
    expect(faviconUrl("https://www.example.com/a/b")).toBe("https://www.example.com/favicon.ico");
    expect(faviconUrl("엉망")).toBeNull();
  });
});
