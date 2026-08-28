import { InboxList } from "@/components/inbox-list";
import { isDbConfigured } from "@/lib/db";
import { listUnprocessed } from "@/lib/inbox/repo";

// 인박스 — 전역 캡처의 처리함 (화면명세서 §3). 동적 렌더링은 (app)/layout에서 일괄 선언

export default async function InboxPage() {
  const items = isDbConfigured()
    ? await listUnprocessed().catch((error) => {
        console.error("인박스 목록 실패:", error);
        return [];
      })
    : [];
  return <InboxList initialItems={items} />;
}
