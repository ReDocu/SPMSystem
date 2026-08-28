import { redirect } from "next/navigation";
import { toDateKey } from "@/lib/dates";

// 정적 프리렌더 시 리다이렉트 날짜가 빌드 시점에 고정되므로 요청마다 계산한다
export const dynamic = "force-dynamic";

export default function SchedulePage() {
  redirect(`/schedule/day/${toDateKey(new Date())}`);
}
