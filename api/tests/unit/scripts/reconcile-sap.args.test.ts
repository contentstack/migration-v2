import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../scripts/reconcile-sap.js';

/**
 * Regression tests for reconcile-sap.ts's argument parsing.
 *
 * Shipped broken the first time this script was actually run with only ONE of
 * the two optional flags present: an unguarded `[jsonAt, jsonAt + 1, ...]
 * .filter(i => i >= 0)` treated the absent flag's "+1" companion index (which is
 * 0, since indexOf returns -1) as a real index to consume, silently eating
 * positional argument 0 — the source path. Every case here corresponds to a
 * real invocation shape, not a hypothetical.
 */
describe('reconcile-sap parseArgs', () => {
  it('resolves both positionals with no flags', () => {
    const r = parseArgs(['source.impex', 'migration-dir']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.migrationDir).toBe('migration-dir');
    expect(r.jsonOut).toBeNull();
    expect(r.ctPath).toBeNull();
  });

  it('resolves both positionals with only --json present', () => {
    const r = parseArgs(['source.impex', 'migration-dir', '--json', 'out.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.migrationDir).toBe('migration-dir');
    expect(r.jsonOut).toBe('out.json');
    expect(r.ctPath).toBeNull();
  });

  it('resolves both positionals with only --content-types present', () => {
    const r = parseArgs(['source.impex', 'migration-dir', '--content-types', 'ct.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.migrationDir).toBe('migration-dir');
    expect(r.jsonOut).toBeNull();
    expect(r.ctPath).toBe('ct.json');
  });

  it('resolves both positionals with both flags present', () => {
    const r = parseArgs(['source.impex', 'migration-dir', '--json', 'out.json', '--content-types', 'ct.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.migrationDir).toBe('migration-dir');
    expect(r.jsonOut).toBe('out.json');
    expect(r.ctPath).toBe('ct.json');
  });

  it('resolves both positionals regardless of flag order', () => {
    const r = parseArgs(['source.impex', 'migration-dir', '--content-types', 'ct.json', '--json', 'out.json']);
    expect(r.sourcePath).toBe('source.impex');
    expect(r.migrationDir).toBe('migration-dir');
  });
});
