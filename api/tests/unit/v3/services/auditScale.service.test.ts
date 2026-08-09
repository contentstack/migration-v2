import { describe, it, expect } from "vitest";

/**
 * TDD — cs-audit-report, Phase 1 closing tranche: scan scale, plus the two rows
 * covered behaviourally elsewhere that had no test carrying their own id.
 *
 * Backs TC_AR_022, TC_AR_180 and TC_AR_184 (feature.md NFR-1, NFR-5, FR-2.10; trd.md
 * §13, TRR-2).
 *
 * What is honestly testable here, and what is not:
 *
 * NFR-1 (a 400-record scan under 10s) and NFR-5 (50,000 records without exhausting
 * memory) are properties of the algorithm, so they can be asserted — with generous
 * bounds, because a unit suite shares a machine with whatever else is running. The
 * bound that matters is not the wall clock but the SHAPE: the asset scan must be one
 * pass over records plus a set difference, not records × assets. A quadratic
 * implementation passes at 400 records and dies at 50,000, which is exactly the
 * failure TRR-2 predicts, so the scale case is the one with teeth.
 *
 * NFR-2/3/4's p95 HTTP latencies (TC_AR_181–183) are NOT asserted here and are not
 * unit-testable — see the report's upstream-gaps section.
 */
import { runAuditChecks } from "../../../../v3/services/auditChecks.service.js";
import type {
  AuditExportData,
  AuditExportRecord,
} from "../../../../v3/services/auditReader.service.js";

const record = (
  ctUid: string,
  uid: string,
  locale: string,
  entry: Record<string, unknown> = {}
): AuditExportRecord => ({
  ctUid,
  uid,
  locale,
  entry: { uid, locale, title: `Entry ${uid}`, publish_details: [], ...entry },
});

const data = (over: Partial<AuditExportData> = {}): AuditExportData => ({
  readable: true,
  modules: { contentTypes: true, globalFields: true, assets: true, entries: true },
  contentTypes: [],
  globalFields: [],
  assets: {},
  records: [],
  entryRecordCount: 0,
  variantRecords: [],
  variantsPresent: false,
  errors: {},
  exportedAt: "2026-08-05T09:20:27.553Z",
  ...over,
});

/** Builds an export of the requested size, with one asset referenced per 10 records. */
const syntheticExport = (
  recordCount: number,
  assetCount: number,
  ctCount: number,
  gfCount: number
): AuditExportData => {
  const contentTypes = Array.from({ length: ctCount }, (_, i) => ({
    uid: `ct${i}`,
    schema: [{ uid: "img", data_type: "file" }],
  }));
  const assets: Record<string, any> = {};
  for (let i = 0; i < assetCount; i++) assets[`a${i}`] = { uid: `a${i}`, is_dir: false };

  const records = Array.from({ length: recordCount }, (_, i) =>
    record(`ct${i % ctCount}`, `e${i}`, "en", {
      // Every tenth record references an asset, so the scan has real work to do.
      img: i % 10 === 0 ? { uid: `a${i % assetCount}` } : null,
      publish_details: i % 3 === 0 ? [] : [{ environment: "env", locale: "en" }],
    })
  );

  return data({
    contentTypes,
    globalFields: Array.from({ length: gfCount }, (_, i) => ({ uid: `gf${i}` })),
    assets,
    records,
    entryRecordCount: records.length,
  });
};

describe("v3 auditChecks — scan scale", () => {
  it("TC_AR_180 (positive): a 400-record export with 100 assets, 25 content types and 15 global fields scans well inside the budget", () => {
    const input = syntheticExport(400, 100, 25, 15);

    const started = performance.now();
    const result = runAuditChecks(input);
    const elapsed = performance.now() - started;

    // NFR-1 allows 10s. The bound here is deliberately far tighter, because anything
    // approaching 10s at this size means the implementation is quadratic and will not
    // survive TC_AR_184.
    expect(elapsed).toBeLessThan(2000);
    expect(result.totals.denominator).toBe(25 + 15 + 100 + 400);
  });

  /*
    Negative — taxonomy #3 (boundary): 50,000 records, the ceiling NFR-5 states.

    This is the case that catches a records × assets scan. At 400 records such an
    implementation looks fine; here it does 50,000 × 500 = 25 million comparisons and
    either times out or exhausts the heap (TRR-2). Correct behaviour is one pass over
    the records collecting referenced uids, then a set difference against the asset
    list — so the cost is records + assets, not their product.
  */
  it("TC_AR_184 (negative): a 50,000-record export completes without a quadratic blow-up", () => {
    const input = syntheticExport(50_000, 500, 50, 20);

    const started = performance.now();
    const result = runAuditChecks(input);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(15_000);
    expect(result.totals.entryRecords).toBe(50_000);
    // The counts must still be right at scale, not merely fast.
    expect(result.checks.find((c) => c.id === "unusedAssets")!.state).toBe("done");
    expect(result.checks.find((c) => c.id === "unpublishedEntries")!.count).toBeGreaterThan(0);
  });

  it("TC_AR_180b (positive): scan cost grows about linearly, not with the square of the record count", () => {
    const small = syntheticExport(2_000, 200, 20, 10);
    const large = syntheticExport(20_000, 200, 20, 10);

    const t0 = performance.now();
    runAuditChecks(small);
    const smallMs = Math.max(performance.now() - t0, 1);

    const t1 = performance.now();
    runAuditChecks(large);
    const largeMs = performance.now() - t1;

    // Ten times the records must not cost anywhere near a hundred times the work. The
    // ceiling is loose on purpose — this asserts the ALGORITHM's shape, not a timing.
    expect(largeMs / smallMs).toBeLessThan(30);
  });

  /*
    Negative — taxonomy #1 (missing input): TC_AR_022's own id, which until now was
    covered only by a test named for TC_AR_050.

    A record whose `publish_details` key is absent entirely — every entry in an export
    predating the 2026-08-05 exporter fix — must not be silently treated as published.
    The check reports `unavailable`, so the page says it could not look rather than
    reporting a clean result (FR-2.10, FR-2.11, EC-5).
  */
  it("TC_AR_022 (negative): a record with no publish_details key is never treated as published", () => {
    const noKey = record("blog", "e1", "en");
    delete (noKey.entry as Record<string, unknown>).publish_details;

    const result = runAuditChecks(
      data({ records: [noKey], entryRecordCount: 1 })
    );
    const check = result.checks.find((c) => c.id === "unpublishedEntries")!;

    expect(check.state).toBe("unavailable");
    expect(check.count).toBeUndefined();
    // And emphatically not the alternative reading: absent data is not evidence of
    // publication, so the record must not quietly drop out of the flagged set as
    // though it had been checked and found fine.
    expect(check.items).toEqual([]);
  });
});
