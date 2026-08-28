export interface ReleaseNoteEntry {
  version: string;
  projectTitle: string;
  envName: string;
  deployedAt: string; // "YYYY-MM-DD HH:MM"
  changelog: string | null;
  rolledBack: boolean;
}

/** 배포 변경사항 누적 → 릴리즈 노트 마크다운 (상세기획 §7.1). 최신 배포부터. */
export function buildReleaseNotes(entries: ReleaseNoteEntry[]): string {
  if (entries.length === 0) return "";
  const sorted = [...entries].sort((a, b) => b.deployedAt.localeCompare(a.deployedAt));
  const sections = sorted.map((e) => {
    const date = e.deployedAt.slice(0, 10);
    const header = `## ${e.version} — ${date}${e.rolledBack ? " (롤백됨)" : ""}`;
    const meta = `_${e.projectTitle}/${e.envName}_`;
    const body = e.changelog?.trim()
      ? e.changelog
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => (line.startsWith("-") ? line : `- ${line}`))
          .join("\n")
      : "- (변경사항 없음)";
    return `${header}\n${meta}\n\n${body}`;
  });
  return sections.join("\n\n");
}
