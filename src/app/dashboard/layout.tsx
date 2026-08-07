import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
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

  return <AppShell actor={actor}>{children}</AppShell>;
}
