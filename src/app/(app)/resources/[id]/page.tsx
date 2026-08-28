import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getResource } from "@/lib/resources/repo";
import { ResourceEditor } from "@/components/resources/resource-editor";

// 자료 상세 — 아이디어 마크다운 수정 / 사이트 제목·메모·카테고리 수정 (화면명세서 §7)
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id) || !isDbConfigured()) notFound();

  const item = await getResource(id).catch(() => null);
  if (!item) notFound();

  return <ResourceEditor item={item} />;
}
