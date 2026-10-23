import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const sealed = encryptSecret("ATATT3x-token");
    expect(sealed).not.toContain("ATATT3x-token");
    expect(decryptSecret(sealed)).toBe("ATATT3x-token");
  });

  it("uses a fresh nonce every time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered value", () => {
    const sealed = encryptSecret("ATATT3x-token");
    // Flip a ciphertext bit in the bytes: editing base64 text can land on padding bits and change nothing.
    const bytes = Buffer.from(sealed, "base64");
    bytes[bytes.length - 1] ^= 1;
    const tampered = bytes.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
