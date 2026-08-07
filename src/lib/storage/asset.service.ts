import "server-only";

import type { AssetCategory } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import {
  inspectUpload,
  persistProtectedUpload,
  persistStreamingVideoUpload,
  removeProtectedUpload,
} from "./file-policy";

async function createReadyAsset(
  actor: Actor,
  input: {
    category: AssetCategory;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    checksum: string;
  },
  context?: RequestContext,
) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        ...input,
        status: "READY",
        uploadedById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "ASSET_UPLOADED",
      entityType: "Asset",
      entityId: asset.id,
      newValue: {
        ...asset,
        storageKey: "[PROTECTED]",
      },
      context,
    });
    return {
      id: asset.id,
      category: asset.category,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes.toString(),
      status: asset.status,
    };
  });
}

export async function storeAsset(
  actor: Actor,
  input: {
    category: AssetCategory;
    file: File;
  },
  context?: RequestContext,
) {
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const inspected = await inspectUpload({
    category: input.category,
    originalName: input.file.name,
    claimedMimeType: input.file.type,
    buffer,
  });
  const storageKey = await persistProtectedUpload({
    category: input.category,
    storageName: inspected.storageName,
    buffer,
  });

  try {
    return await createReadyAsset(
      actor,
      {
        category: input.category,
        storageKey,
        originalName: input.file.name,
        mimeType: inspected.mimeType,
        sizeBytes: inspected.sizeBytes,
        checksum: inspected.checksum,
      },
      context,
    );
  } catch (error) {
    await removeProtectedUpload(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function storeStreamingVideoAsset(
  actor: Actor,
  input: {
    body: ReadableStream<Uint8Array> | null;
    originalName: string;
    claimedMimeType?: string | null;
    declaredSize?: number;
  },
  context?: RequestContext,
) {
  const persisted = await persistStreamingVideoUpload(input);
  try {
    return await createReadyAsset(
      actor,
      {
        category: "RECORDING",
        storageKey: persisted.storageKey,
        originalName: input.originalName,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
        checksum: persisted.checksum,
      },
      context,
    );
  } catch (error) {
    await removeProtectedUpload(persisted.storageKey).catch(() => undefined);
    throw error;
  }
}
