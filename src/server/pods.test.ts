import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { getPodPage, listPods } from "./pods";

beforeEach(resetDb);

describe("pod page", () => {
  it("shows the pod's members with main skills, lead first", async () => {
    const page = await getPodPage("roadmap-2");
    expect(page?.pod).toMatchObject({ name: "RoadMap 2", jiraPodValue: "RoadMap 2" });
    expect(page?.members).toEqual([
      { id: expect.any(Number), name: "Aman Tyagi", mainSkill: "BE", isLead: true },
      { id: expect.any(Number), name: "Akash Singh", mainSkill: "AI", isLead: false },
      { id: expect.any(Number), name: "Kalpan Punamiya", mainSkill: "Data", isLead: false },
      { id: expect.any(Number), name: "Mayank Awasthi", mainSkill: "FE", isLead: false },
      { id: expect.any(Number), name: "Muthaiyan Mani", mainSkill: "FE", isLead: false },
    ]);
  });

  it("is null for an unknown pod", async () => {
    expect(await getPodPage("nope")).toBeNull();
  });

  it("lists all four pods in deck order for the pod tabs", async () => {
    expect(await listPods()).toEqual([
      { slug: "roadmap-1", name: "RoadMap 1" },
      { slug: "roadmap-2", name: "RoadMap 2" },
      { slug: "velocity", name: "Velocity" },
      { slug: "atlas", name: "Atlas" },
    ]);
  });
});
