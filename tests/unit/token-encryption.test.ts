import { describe, expect, it } from "vitest";

import {
  decryptToken,
  encryptAccountTokens,
  encryptToken,
} from "@/lib/security/token-encryption";

describe("mã hóa OAuth token", () => {
  it("mã hóa AES-GCM và giải mã đúng", () => {
    const plaintext = "sensitive-oauth-token";
    const ciphertext = encryptToken(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptToken(ciphertext)).toBe(plaintext);
  });

  it("mỗi lần dùng IV riêng và phát hiện dữ liệu sửa đổi", () => {
    const first = encryptToken("same");
    const second = encryptToken("same");
    expect(first).not.toBe(second);
    expect(() => decryptToken(`${first}tampered`)).toThrow();
  });

  it("mã hóa tất cả token trong account", () => {
    const account = encryptAccountTokens({
      accessToken: "access",
      refreshToken: "refresh",
      idToken: "identity",
      scope: "openid",
    });
    expect(decryptToken(account.accessToken)).toBe("access");
    expect(decryptToken(account.refreshToken)).toBe("refresh");
    expect(decryptToken(account.idToken)).toBe("identity");
    expect(account.scope).toBe("openid");
  });
});
