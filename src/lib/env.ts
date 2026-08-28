// PIN이 설정돼 있어야만 잠금이 활성화된다 (미설정 = 로컬 개발 편의로 바로 진입)
export function isPinEnabled(): boolean {
  return Boolean(process.env.SPM_PIN && process.env.SPM_SECRET);
}
