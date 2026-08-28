import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(secret: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const exp = String(Date.now() + ttlMs);
  return `${exp}.${sign(exp, secret)}`;
}

export function verifySessionToken(token: string, secret: string): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;

  const expected = Buffer.from(sign(exp, secret));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const SESSION_COOKIE = "spm_session";
