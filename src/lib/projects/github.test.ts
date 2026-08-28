import { describe, expect, test } from "vitest";
import { parseGitHubRepo } from "./github";

describe("parseGitHubRepo — repo_url에서 owner/repo 추출 (읽기 전용 연동, P5)", () => {
  test("표준 GitHub URL", () => {
    expect(parseGitHubRepo("https://github.com/ReDocu/SPMSystem")).toEqual({
      owner: "ReDocu",
      repo: "SPMSystem",
    });
  });

  test(".git 접미사·하위 경로·트레일링 슬래시 정리", () => {
    expect(parseGitHubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGitHubRepo("https://github.com/a/b/tree/main/src")).toEqual({ owner: "a", repo: "b" });
    expect(parseGitHubRepo("https://github.com/a/b/")).toEqual({ owner: "a", repo: "b" });
  });

  test("GitHub이 아니거나 불완전한 URL은 null", () => {
    expect(parseGitHubRepo("https://gitlab.com/a/b")).toBeNull();
    expect(parseGitHubRepo("https://github.com/onlyowner")).toBeNull();
    expect(parseGitHubRepo("잘못된 url")).toBeNull();
    expect(parseGitHubRepo(null)).toBeNull();
  });
});
