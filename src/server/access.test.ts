import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { checkAccess } from "./access";

beforeEach(resetDb);

describe("sign-in allowlist", () => {
  it("lets the four pod leads in", async () => {
    for (const email of [
      "aman@delightree.com",
      "shikhar@delightree.com",
      "rahul@delightree.com",
      "abdullah@delightree.com",
    ]) {
      expect(await checkAccess(email)).toMatchObject({ allowed: true });
    }
  });

  it("refuses a Delightree address that is not allowlisted", async () => {
    expect(await checkAccess("mayank@delightree.com")).toEqual({ allowed: false });
  });

  it("ignores email case", async () => {
    expect(await checkAccess("Shikhar@Delightree.com")).toMatchObject({ allowed: true });
  });

  it("marks only Aman as admin", async () => {
    expect(await checkAccess("aman@delightree.com")).toEqual({ allowed: true, isAdmin: true });
    expect(await checkAccess("rahul@delightree.com")).toEqual({ allowed: true, isAdmin: false });
  });
});
