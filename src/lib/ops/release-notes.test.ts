import { describe, expect, test } from "vitest";
import { buildReleaseNotes } from "./release-notes";

describe("buildReleaseNotes — 변경사항 누적 → 릴리즈 노트 (상세기획 §7.1)", () => {
  test("버전별 그룹, 최신부터, 롤백 표시", () => {
    const md = buildReleaseNotes([
      { version: "v0.2", projectTitle: "SPM", envName: "prod", deployedAt: "2026-08-25 14:00", changelog: "칸반 추가", rolledBack: false },
      { version: "v0.1", projectTitle: "SPM", envName: "prod", deployedAt: "2026-08-10 21:00", changelog: "첫 배포", rolledBack: true },
    ]);
    expect(md).toContain("## v0.2 — 2026-08-25");
    expect(md).toContain("- 칸반 추가");
    expect(md).toContain("## v0.1 — 2026-08-10 (롤백됨)");
    expect(md.indexOf("v0.2")).toBeLessThan(md.indexOf("v0.1"));
  });

  test("changelog 없는 배포는 '(변경사항 없음)'", () => {
    const md = buildReleaseNotes([
      { version: "v1", projectTitle: "A", envName: "prod", deployedAt: "2026-08-01 09:00", changelog: null, rolledBack: false },
    ]);
    expect(md).toContain("(변경사항 없음)");
  });

  test("빈 목록은 빈 문자열", () => {
    expect(buildReleaseNotes([])).toBe("");
  });
});
