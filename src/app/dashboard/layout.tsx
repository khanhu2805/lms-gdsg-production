import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ActionDialogProvider } from "@/components/ui/action-dialogs";
import { requireActor } from "@/lib/auth/actor";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await requireActor();
  } catch {
    redirect("/");
  }

  return (
    <ActionDialogProvider>
      <AppShell actor={actor}>{children}</AppShell>
    </ActionDialogProvider>
  );
}
