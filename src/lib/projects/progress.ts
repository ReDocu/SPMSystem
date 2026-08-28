interface MilestoneLike {
  id: string;
  weight: number;
}

interface TaskLike {
  status: string;
  milestoneId: string | null;
}

/**
 * 진행률 = Σ(마일스톤별 태스크 완료율 × 가중치) / Σ가중치 (상세기획 §4).
 * - dropped 태스크는 분모 제외 (영원히 100%가 안 나오는 문제 방지)
 * - 마일스톤이 없으면 태스크 개수 방식 폴백
 * 결과는 0~100 정수. 서버에서 projects.progress에 캐싱한다.
 */
export function computeProgress(milestones: MilestoneLike[], tasks: TaskLike[]): number {
  const alive = tasks.filter((t) => t.status !== "dropped");

  if (milestones.length === 0) {
    if (alive.length === 0) return 0;
    const done = alive.filter((t) => t.status === "done").length;
    return Math.round((done / alive.length) * 100);
  }

  if (alive.length === 0) return 0;
  let weightSum = 0;
  let weighted = 0;
  for (const ms of milestones) {
    weightSum += ms.weight;
    const msTasks = alive.filter((t) => t.milestoneId === ms.id);
    if (msTasks.length === 0) continue; // 완료율 0%
    const done = msTasks.filter((t) => t.status === "done").length;
    weighted += (done / msTasks.length) * ms.weight;
  }
  if (weightSum === 0) return 0;
  return Math.round((weighted / weightSum) * 100);
}
