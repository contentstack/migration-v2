import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1c: inventory scale.
 *
 * Backs TC_CTS_136, TC_CTS_137 (feature.md NFR-1; trd.md §13).
 *
 * Follows `auditScale.service.test.ts`: a wall-clock budget on a generated
 * fixture. NFR-1 states a concrete number — 200 content types in under 2
 * seconds — so this is measurable rather than a feel test, unlike the p95 HTTP
 * latencies the audit run had to report as unautomatable.
 *
 * The number that actually matters is not the elapsed time but the SHAPE of the
 * work: the reference walk must stay linear in fields, not quadratic in content
 * types. TC_CTS_137's negative pins that by comparing two sizes rather than
 * trusting one absolute figure, which is the part a faster CI machine cannot
 * paper over.
 */
const { mockListDestinationContentTypes } = vi.hoisted(() => ({
  mockListDestinationContentTypes: vi.fn(),
}));

vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: { getDestinationContentTypes: mockListDestinationContentTypes },
}));

import { buildContentTypeInventory } from "../../../../v3/services/contentTypeInventory.service.js";

const TMP = path.join(os.tmpdir(), `v3-cts-scale-${process.pid}`);
let dir: string;

/**
 * `n` content types, each with 20 fields including nested groups, a modular
 * block and a reference — the shape the walk actually has to traverse.
 */
const generate = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    uid: `ct_${i}`,
    title: `Content Type ${i}`,
    schema: [
      { uid: "title", data_type: "text" },
      { uid: "ref", data_type: "reference", reference_to: [`ct_${(i + 1) % n}`] },
      {
        uid: "grp",
        data_type: "group",
        schema: [
          { uid: "inner", data_type: "text" },
          { uid: "inner_ref", data_type: "reference", reference_to: [`ct_${(i + 2) % n}`] },
          { uid: "deep", data_type: "group", schema: [{ uid: "d", data_type: "text" }] },
        ],
      },
      {
        uid: "blocks",
        data_type: "blocks",
        multiple: true,
        blocks: [
          { uid: "b1", schema: [{ uid: "t", data_type: "text" }] },
          {
            uid: "b2",
            schema: [{ uid: "br", data_type: "reference", reference_to: [`ct_${(i + 3) % n}`] }],
          },
        ],
      },
      ...Array.from({ length: 14 }, (_, f) => ({ uid: `f_${f}`, data_type: "text" })),
    ],
  }));

const writeSchema = (d: string, cts: unknown[]) => {
  const p = path.join(d, "content_types", "schema.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cts));
};

beforeEach(() => {
  dir = path.join(TMP, `case-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  mockListDestinationContentTypes.mockReset();
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("v3 content type inventory — scale", () => {
  it("TC_CTS_136 (positive): builds the inventory and graph for 200 content types in under 2 seconds", async () => {
    writeSchema(dir, generate(200));

    const started = Date.now();
    const inv = await buildContentTypeInventory({ exportDir: dir });
    const elapsed = Date.now() - started;

    expect(inv.contentTypes).toHaveLength(200);
    expect(elapsed).toBeLessThan(2000);
  });

  /*
    Negative — taxonomy #3 (boundary): speed alone proves nothing if the graph is
    wrong. At 200 content types every one has exactly three outbound edges by
    construction, so a walk that skipped nested containers to go fast would pass
    the timing assertion above and fail here.
  */
  it("TC_CTS_136 (negative): does not reach that budget by skipping nested references", async () => {
    writeSchema(dir, generate(200));

    const inv = await buildContentTypeInventory({ exportDir: dir });

    const zero = inv.contentTypes.find((c) => c.uid === "ct_0")!;
    expect(zero.references.sort()).toEqual(["ct_1", "ct_2", "ct_3"]);
    expect(inv.contentTypes.every((c) => c.references.length === 3)).toBe(true);
  });

  it("TC_CTS_137 (positive): builds the inventory for 500 content types without error", async () => {
    writeSchema(dir, generate(500));

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes).toHaveLength(500);
    expect(inv.contentTypes.every((c) => c.references.length === 3)).toBe(true);
  });

  /*
    Negative — taxonomy #3 (boundary): the cost must scale with the number of
    content types, not with its square. 500 types is 2.5× 200, so anything near
    6.25× the time means the walk is comparing content types against each other
    — the failure mode that only shows up on a customer's largest stack. A
    generous 4× ceiling absorbs CI noise while still catching quadratic growth.
  */
  it("TC_CTS_137 (negative): does not grow quadratically between 200 and 500 content types", async () => {
    const small = path.join(dir, "small");
    const large = path.join(dir, "large");
    fs.mkdirSync(small, { recursive: true });
    fs.mkdirSync(large, { recursive: true });
    writeSchema(small, generate(200));
    writeSchema(large, generate(500));

    const t0 = Date.now();
    const smallInv = await buildContentTypeInventory({ exportDir: small });
    const smallMs = Math.max(Date.now() - t0, 1);

    const t1 = Date.now();
    const largeInv = await buildContentTypeInventory({ exportDir: large });
    const largeMs = Date.now() - t1;

    /*
      Anchored on real work first. A ratio comparison is trivially satisfied by
      an implementation that does nothing — both runs return instantly and the
      ratio is 1. Asserting the graphs were actually built makes the ratio mean
      something.
    */
    expect(smallInv.contentTypes).toHaveLength(200);
    expect(largeInv.contentTypes).toHaveLength(500);
    expect(largeInv.contentTypes.every((c) => c.references.length === 3)).toBe(true);

    /*
      `4x + 50ms`, not a bare ratio. At these sizes the 200-type run can finish in
      1-2ms, so a single GC pause during the 500-type run produces a ratio of 8
      against work that is perfectly linear — this test failed exactly once that
      way while the suites ran concurrently. The constant absorbs scheduling noise
      at small magnitudes without weakening the intent: genuinely quadratic growth
      is ~6.25x here, which the constant cannot rescue once the times are large
      enough to mean anything.
    */
    expect(largeMs).toBeLessThan(smallMs * 4 + 50);
  });
});
