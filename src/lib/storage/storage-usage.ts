import "server-only";

import { opendir, stat } from "node:fs/promises";
import path from "node:path";

import { env } from "@/config/env";

const CACHE_TTL_MS = 30_000;

let cachedStorageUsage:
  | {
      bytes: bigint;
      expiresAt: number;
    }
  | null = null;

let storageUsageInFlight: Promise<bigint> | null = null;

async function directorySizeBytes(directory: string): Promise<bigint> {
  let total = BigInt(0);
  const handle = await opendir(directory);

  for await (const entry of handle) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      total += await directorySizeBytes(fullPath);
      continue;
    }

    if (entry.isFile()) {
      const info = await stat(fullPath);
      total += BigInt(info.size);
    }
  }

  return total;
}

async function calculateStorageUsageBytes() {
  try {
    return await directorySizeBytes(path.resolve(env.UPLOAD_ROOT));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return BigInt(0);
    }

    throw error;
  }
}

export async function getStorageUsageBytes(): Promise<bigint> {
  const now = Date.now();

  if (cachedStorageUsage && cachedStorageUsage.expiresAt > now) {
    return cachedStorageUsage.bytes;
  }

  if (storageUsageInFlight) {
    return storageUsageInFlight;
  }

  storageUsageInFlight = calculateStorageUsageBytes();

  try {
    const bytes = await storageUsageInFlight;
    cachedStorageUsage = {
      bytes,
      expiresAt: now + CACHE_TTL_MS,
    };
    return bytes;
  } finally {
    storageUsageInFlight = null;
  }
}
