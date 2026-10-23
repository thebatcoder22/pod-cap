import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { getPodPage } from "./pods";
import { viewerForEmail } from "./viewer";
import { assertAdmin, assertCanEditPod, ForbiddenError } from "./permissions";

beforeEach(resetDb);

const podId = async (slug: string) => (await getPodPage(slug))!.pod.id;

describe("permissions", () => {
  it("lets a lead edit their own pod and refuses another lead's pod", async () => {
    const rahul = await viewerForEmail("rahul@delightree.com");
    const velocity = await podId("velocity");
    const atlas = await podId("atlas");
    expect(() => assertCanEditPod(rahul, velocity)).not.toThrow();
    expect(() => assertCanEditPod(rahul, atlas)).toThrow(ForbiddenError);
  });

  it("gives the admin no edit rights over another lead's pod", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const roadmap1 = await podId("roadmap-1");
    expect(() => assertCanEditPod(aman, roadmap1)).toThrow(ForbiddenError);
  });

  it("reserves admin actions for the admin", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const shikhar = await viewerForEmail("shikhar@delightree.com");
    expect(() => assertAdmin(aman)).not.toThrow();
    expect(() => assertAdmin(shikhar)).toThrow(ForbiddenError);
  });

  it("refuses everything when signed out", () => {
    expect(() => assertCanEditPod(null, 1)).toThrow(ForbiddenError);
    expect(() => assertAdmin(null)).toThrow(ForbiddenError);
  });
});
