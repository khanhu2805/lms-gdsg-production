import "server-only";

import type { Actor } from "@/lib/auth/actor";
import {
  assertClassAccess,
  assertStaffClassAccess,
} from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

import { nginxInternalPath } from "./file-policy";

export async function authorizeAssetDownload(actor: Actor, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      status: "READY",
      deletedAt: null,
    },
    include: {
      materials: {
        include: {
          content: {
            select: {
              classId: true,
              publicationStatus: true,
            },
          },
        },
      },
      submissionFiles: {
        include: {
          submission: {
            include: {
              assignment: {
                include: {
                  content: { select: { classId: true } },
                },
              },
            },
          },
        },
      },
      reports: {
        select: { requestedById: true, status: true, expiresAt: true },
      },
    },
  });
  if (!asset) throw new AppError("NOT_FOUND");

  if (asset.materials.length > 0) {
    const material = asset.materials[0]!;
    await assertClassAccess(actor, material.content.classId);
    if (
      ["STUDENT", "PARENT"].includes(actor.role) &&
      material.content.publicationStatus !== "PUBLISHED"
    ) {
      throw new AppError("FORBIDDEN");
    }
  } else if (asset.submissionFiles.length > 0) {
    const submission = asset.submissionFiles[0]!.submission;
    if (actor.role === "STUDENT") {
      if (submission.studentId !== actor.id) {
        throw new AppError("FORBIDDEN");
      }
    } else {
      await assertStaffClassAccess(
        actor,
        submission.assignment.content.classId,
      );
    }
  } else if (asset.reports.length > 0) {
    const report = asset.reports[0]!;
    if (
      report.requestedById !== actor.id &&
      !["ADMIN", "MANAGER"].includes(actor.role)
    ) {
      throw new AppError("FORBIDDEN");
    }
    if (
      report.status !== "READY" ||
      (report.expiresAt && report.expiresAt <= new Date())
    ) {
      throw new AppError("CONFLICT", "Báo cáo đã hết hạn hoặc chưa sẵn sàng.");
    }
  } else if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }

  return {
    internalPath: nginxInternalPath(asset.storageKey),
    mimeType: asset.mimeType,
    originalName: asset.originalName,
  };
}
