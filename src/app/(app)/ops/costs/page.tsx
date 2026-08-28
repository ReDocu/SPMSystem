import { isDbConfigured } from "@/lib/db";
import { listCosts } from "@/lib/ops/repo";
import { CostsPanel } from "@/components/ops/costs-panel";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const costs = isDbConfigured() ? await listCosts().catch(() => []) : [];
  return <CostsPanel costs={costs} />;
}
