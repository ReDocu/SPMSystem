import { describe, expect, test } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "test-secret";

describe("PIN 세션 토큰 (서명 쿠키)", () => {
  test("발급한 토큰은 검증을 통과한다", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, SECRET)).toBe(true);
  });

  test("서명이 다른 시크릿으로는 검증에 실패한다", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, "other-secret")).toBe(false);
  });

  test("만료 시각을 조작한 토큰은 실패한다", () => {
    const token = createSessionToken(SECRET);
    const [, sig] = token.split(".");
    const forged = `${Date.now() + 999_999_999}.${sig}`;
    expect(verifySessionToken(forged, SECRET)).toBe(false);
  });

  test("만료된 토큰은 실패한다", () => {
    const token = createSessionToken(SECRET, -1000);
    expect(verifySessionToken(token, SECRET)).toBe(false);
  });

  test("형식이 깨진 토큰은 실패한다", () => {
    expect(verifySessionToken("garbage", SECRET)).toBe(false);
    expect(verifySessionToken("", SECRET)).toBe(false);
  });
});
