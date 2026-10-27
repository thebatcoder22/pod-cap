import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { viewerForEmail } from "./viewer";

beforeEach(resetDb);

describe("signed-in viewer", () => {
  it("lands each lead on their own pod", async () => {
    expect(await viewerForEmail("aman@delightree.com")).toMatchObject({
      name: "Aman Tyagi",
      isAdmin: true,
      pod: { slug: "roadmap-2", name: "RoadMap 2" },
    });
    expect(await viewerForEmail("abdullah@delightree.com")).toMatchObject({ isAdmin: false, pod: { slug: "atlas" } });
  });

  it("views read only at a Delightree address that is not allowlisted", async () => {
    expect(await viewerForEmail("mayank@delightree.com")).toMatchObject({ canEdit: false, isAdmin: false });
  });

  it("is null outside Delightree", async () => {
    expect(await viewerForEmail("someone@gmail.com")).toBeNull();
  });
});
