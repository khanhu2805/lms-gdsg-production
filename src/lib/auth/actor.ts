import "server-only";

import { headers as nextHeaders } from "next/headers";

import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

import { auth } from "./auth";

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export async function requireActor(requestHeaders?: Headers): Promise<Actor> {
  const headers = requestHeaders ?? (await nextHeaders());
  const session = await auth.api.getSession({ headers });

  if (!session?.user?.id) {
    throw new AppError("UNAUTHENTICATED");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      lockedAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || user.lockedAt || user.deletedAt) {
    throw new AppError(
      "FORBIDDEN",
      "Tài khoản đã bị khóa, ngừng hoạt động hoặc không còn tồn tại.",
    );
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireRoles(
  allowedRoles: readonly UserRole[],
  requestHeaders?: Headers,
) {
  const actor = await requireActor(requestHeaders);
  if (!allowedRoles.includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  return actor;
}
