import { parseGitHubRepo } from "@/lib/projects/github";

export interface GitHubActivity {
  repoLabel: string;
  openIssues: number;
  commits: { sha: string; message: string; date: string }[];
}

const TIMEOUT_MS = 4000;
const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "SPM/0.6 (personal tool, read-only)",
};

/**
 * GitHub 읽기 전용 연동 (P5) — 커밋·이슈를 표시만 한다. 양방향 동기화는 하지 않는다.
 * 무인증(시간당 60회 한도)으로 충분한 1인 도구. 실패하면 조용히 null.
 */
export async function fetchGitHubActivity(repoUrl: string | null): Promise<GitHubActivity | null> {
  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) return null;
  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  try {
    // 5분 캐시 — force-dynamic 페이지의 렌더마다 무인증 한도(60/h)를 태우지 않는다
    const init = {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 300 },
    };
    const [repoRes, commitsRes] = await Promise.all([
      fetch(base, init),
      fetch(`${base}/commits?per_page=5`, init),
    ]);
    if (!repoRes.ok || !commitsRes.ok) return null;
    const repo = (await repoRes.json()) as { open_issues_count?: number };
    const commits = (await commitsRes.json()) as {
      sha: string;
      commit?: { message?: string; author?: { date?: string } };
    }[];
    return {
      repoLabel: `${parsed.owner}/${parsed.repo}`,
      openIssues: repo.open_issues_count ?? 0,
      commits: (Array.isArray(commits) ? commits : []).slice(0, 5).map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit?.message ?? "").split("\n")[0].slice(0, 100),
        date: (c.commit?.author?.date ?? "").slice(0, 10),
      })),
    };
  } catch {
    return null;
  }
}
