import { isDbConfigured } from "@/lib/db";
import { checklistFor, listDeployments, listEnvironments } from "@/lib/ops/repo";
import { DeploymentsPanel } from "@/components/ops/deployments-panel";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage() {
  const [deployments, environments, defaultChecklist] = isDbConfigured()
    ? await Promise.all([
        listDeployments().catch(() => []),
        listEnvironments().catch(() => []),
        checklistFor(null).catch(() => []),
      ])
    : [[], [], []];
  return (
    <DeploymentsPanel
      deployments={deployments}
      environments={environments.map((e) => ({ id: e.id, label: `${e.projectTitle}/${e.name}` }))}
      defaultChecklist={defaultChecklist}
    />
  );
}
