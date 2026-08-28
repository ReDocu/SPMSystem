import { isDbConfigured } from "@/lib/db";
import { listPlatforms } from "@/lib/ops/repo";
import { PlatformCatalog } from "@/components/ops/platform-catalog";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const items = isDbConfigured() ? await listPlatforms().catch(() => []) : [];
  return <PlatformCatalog items={items} />;
}
