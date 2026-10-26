import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../tests/db";
import { ForbiddenError } from "./permissions";
import { setProficiency } from "./people";
import { getPodPage, listPods } from "./pods";
import { ValidationError } from "./settings";
import { viewerForEmail } from "./viewer";

beforeEach(resetDb);

describe("pod page", () => {
  it("shows the pod's members with main skills, lead first", async () => {
    const page = await getPodPage("roadmap-2");
    expect(page?.pod).toMatchObject({ name: "RoadMap 2", jiraPodOptionId: "11232", jiraPodValue: "RoadMap 2-Aman" });
    expect(page?.members).toEqual([
      expect.objectContaining({ name: "Aman Tyagi", mainSkill: "BE", isLead: true }),
      expect.objectContaining({ name: "Akash Singh", mainSkill: "AI", isLead: false }),
      expect.objectContaining({ name: "Kalpan Punamiya", mainSkill: "Data", isLead: false }),
      expect.objectContaining({ name: "Mayank Awasthi", mainSkill: "FE", isLead: false }),
      expect.objectContaining({ name: "Muthaiyan Mani", mainSkill: "FE", isLead: false }),
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

describe("proficiency", () => {
  const person = async (slug: string, name: string) => (await getPodPage(slug))!.members.find((m) => m.name === name)!;

  it("is 100% in the main skill and 0% in every other skill by default", async () => {
    expect((await person("roadmap-2", "Kalpan Punamiya")).proficiency).toEqual({ FE: 0, BE: 0, Data: 100, AI: 0 });
  });

  it("lets a lead set a non-main skill for their own people, and every lead sees it", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const kalpan = await person("roadmap-2", "Kalpan Punamiya");
    await setProficiency(aman, kalpan.id, "FE", 40);
    await setProficiency(aman, kalpan.id, "AI", 25);
    await setProficiency(aman, kalpan.id, "FE", 60);
    expect((await person("roadmap-2", "Kalpan Punamiya")).proficiency).toEqual({ FE: 60, BE: 0, Data: 100, AI: 25 });
  });

  it("accepts the bounds 0 and 100", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const kalpan = await person("roadmap-2", "Kalpan Punamiya");
    await setProficiency(aman, kalpan.id, "FE", 100);
    await setProficiency(aman, kalpan.id, "AI", 0);
    expect((await person("roadmap-2", "Kalpan Punamiya")).proficiency).toMatchObject({ FE: 100, AI: 0 });
  });

  it("refuses to edit another pod's people, even for the admin", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const rahul = await person("velocity", "Rahul Saharan");
    await expect(setProficiency(aman, rahul.id, "FE", 50)).rejects.toThrow(ForbiddenError);
    await expect(setProficiency(null, rahul.id, "FE", 50)).rejects.toThrow(ForbiddenError);
    expect((await person("velocity", "Rahul Saharan")).proficiency.FE).toBe(rahul.proficiency.FE);
  });

  it("keeps the main skill at 100%", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const kalpan = await person("roadmap-2", "Kalpan Punamiya");
    await expect(setProficiency(aman, kalpan.id, "Data", 50)).rejects.toThrow(ValidationError);
  });

  it.each([-1, 101, 12.5, NaN])("refuses %s%%", async (percent) => {
    const aman = await viewerForEmail("aman@delightree.com");
    const kalpan = await person("roadmap-2", "Kalpan Punamiya");
    await expect(setProficiency(aman, kalpan.id, "FE", percent)).rejects.toThrow(ValidationError);
  });

  it("refuses an unknown skill or person", async () => {
    const aman = await viewerForEmail("aman@delightree.com");
    const kalpan = await person("roadmap-2", "Kalpan Punamiya");
    await expect(setProficiency(aman, kalpan.id, "QA" as never, 50)).rejects.toThrow(ValidationError);
    await expect(setProficiency(aman, 99999, "FE", 50)).rejects.toThrow(ValidationError);
  });
});
