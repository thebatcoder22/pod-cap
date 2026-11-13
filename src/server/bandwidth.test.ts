import { describe, expect, it } from "vitest";
import { spansOf } from "./bandwidth";

const epic = (key: string, ...tickets: string[]) => ({ key, label: key, url: null, tickets });
const loose = { key: null, label: "1 ticket without an epic", url: null, tickets: ["DTP-1 x"] };

describe("spansOf", () => {
  it("runs an epic across back-to-back sprints as one span, and packs the rest into free lanes", () => {
    const spans = spansOf([
      { work: [epic("A", "DTP-1"), epic("B"), loose] },
      { work: [epic("B"), epic("A", "DTP-2"), loose] },
      null,
      { work: [epic("A"), epic("C")] },
    ]);
    expect(spans.map(({ label, from, to, lane }) => [label, from, to, lane])).toEqual([
      ["A", 0, 1, 0],
      ["B", 0, 1, 1],
      ["1 ticket without an epic", 0, 0, 2],
      // Tickets without an epic never join up: each sprint's are different tickets.
      ["1 ticket without an epic", 1, 1, 2],
      // A sprint without the epic breaks the run.
      ["A", 3, 3, 0],
      ["C", 3, 3, 1],
    ]);
    expect(spans[0].tickets).toEqual(["DTP-1", "DTP-2"]);
  });
});
