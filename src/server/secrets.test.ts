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
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "B" : "A") + sealed.slice(-1);
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
