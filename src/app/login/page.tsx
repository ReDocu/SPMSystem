import { isSupabaseConfigured } from "@/lib/env";

// Supabase Auth, Google 1개만. 회원가입 화면 없음 — 미허용 계정은 안내 한 줄 (화면명세서 §1)
export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-[0.3em]">SPM</h1>
      <p className="text-sm text-muted">Single Project Manager</p>
      <div className="h-6" />
      {configured ? (
        <a
          href="/auth/google"
          className="rounded-lg border border-line bg-surface px-8 py-3 text-sm font-medium hover:border-primary"
        >
          Google로 계속하기
        </a>
      ) : (
        <div className="rounded-lg border border-dashed border-line px-8 py-3 text-sm text-muted">
          Supabase 환경변수를 설정하면 Google 로그인이 활성화됩니다
        </div>
      )}
    </div>
  );
}
