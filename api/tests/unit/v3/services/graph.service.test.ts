import { describe, it, expect } from "vitest";

import { buildGraph } from "../../../../v3/services/graph.service.js";

/**
 * TDD — v3 graph.service (buildGraph).
 * Backs TC_SRC_032 (stat-tile counts equal the extract result) and TC_SRC_033
 * (dependency-ordered nodes + reference edges). feature.md FR-4.2/4.3, EC-7.
 */
describe("v3 graph.service — buildGraph", () => {
  it("TC_SRC_032 (positive): counts reflect content types and the passed module counts", () => {
    const cts = [
      { uid: "a", title: "A", schema: [] },
      { uid: "b", title: "B", schema: [] },
    ];
    const g = buildGraph(cts, { assets: 3, entries: 5, globalFields: 1 });
    expect(g.counts.contentTypes).toBe(2);
    expect(g.counts.assets).toBe(3);
    expect(g.counts.entries).toBe(5);
    expect(g.counts.globalFields).toBe(1);
    expect(g.counts.references).toBe(0);
    expect(g.nodes).toHaveLength(2);
  });

  // Negative — taxonomy #1 (missing/empty input): empty stack/file → zero-state (EC-7).
  it("TC_SRC_032 (negative): empty content types yield all-zero counts and no nodes/edges", () => {
    const g = buildGraph([], {});
    expect(g.counts).toEqual({
      contentTypes: 0,
      assets: 0,
      entries: 0,
      globalFields: 0,
      references: 0,
    });
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });

  it("TC_SRC_033 (positive): a reference field creates an edge and tiers the referrer above its target", () => {
    const cts = [
      {
        uid: "page",
        title: "Page",
        schema: [{ data_type: "reference", reference_to: ["author"] }],
      },
      { uid: "author", title: "Author", schema: [] },
    ];
    const g = buildGraph(cts, {});
    expect(g.edges).toEqual([{ from: "page", to: "author" }]);
    expect(g.counts.references).toBe(1);
    const page = g.nodes.find((n) => n.uid === "page")!;
    const author = g.nodes.find((n) => n.uid === "author")!;
    expect(page.tier).toBeGreaterThan(author.tier);
  });

  // Negative — taxonomy #2 (invalid shape): references to unknown/self types make no edge.
  it("TC_SRC_033 (negative): references to unknown or self content types create no edge", () => {
    const cts = [
      {
        uid: "page",
        title: "Page",
        schema: [
          { data_type: "reference", reference_to: ["ghost"] },
          { data_type: "reference", reference_to: ["page"] },
        ],
      },
    ];
    const g = buildGraph(cts, {});
    expect(g.edges).toHaveLength(0);
    expect(g.counts.references).toBe(0);
  });
});
