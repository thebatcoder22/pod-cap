import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { checkAccess } from "./access";

beforeEach(resetDb);

describe("sign-in access", () => {
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

  it("lets the four pod leads edit", async () => {
    expect(await checkAccess("rahul@delightree.com")).toMatchObject({ canEdit: true });
  });

  it("lets any other Delightree address in read only", async () => {
    expect(await checkAccess("mayank@delightree.com")).toEqual({ allowed: true, canEdit: false, isAdmin: false });
  });

  it("refuses addresses outside Delightree", async () => {
    for (const email of ["someone@gmail.com", "aman@delightree.com.evil.io", "aman@notdelightree.com"]) {
      expect(await checkAccess(email)).toEqual({ allowed: false });
    }
  });

  it("ignores email case", async () => {
    expect(await checkAccess("Shikhar@Delightree.com")).toMatchObject({ allowed: true });
  });

  it("marks only Aman as admin", async () => {
    expect(await checkAccess("aman@delightree.com")).toEqual({ allowed: true, canEdit: true, isAdmin: true });
    expect(await checkAccess("rahul@delightree.com")).toEqual({ allowed: true, canEdit: true, isAdmin: false });
  });
});
