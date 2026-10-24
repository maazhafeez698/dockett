import { AppShell } from "~/components/app-shell";
import { WorkspaceContentSkeleton } from "~/components/loading-skeletons";

export default function Loading() {
  return (
    <AppShell docLabel="Loading">
      <WorkspaceContentSkeleton />
    </AppShell>
  );
}
