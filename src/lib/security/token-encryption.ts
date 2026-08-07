import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function encryptionKey() {
  return Buffer.from(env.OAUTH_TOKEN_ENCRYPTION_KEY, "hex");
}

export function encryptToken(value: string | null | undefined) {
  if (!value) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptToken(value: string | null | undefined) {
  if (!value) return value;

  const [version, ivPart, tagPart, encryptedPart] = value.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Định dạng OAuth token đã mã hóa không hợp lệ.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptAccountTokens<
  T extends {
    accessToken?: string | null;
    refreshToken?: string | null;
    idToken?: string | null;
  },
>(account: T): T {
  return {
    ...account,
    accessToken: encryptToken(account.accessToken),
    refreshToken: encryptToken(account.refreshToken),
    idToken: encryptToken(account.idToken),
  };
}
