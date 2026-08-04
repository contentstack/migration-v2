import { describe, it, expect } from 'vitest';

/**
 * TDD — v3 derived project status.
 *
 * Backs TC_PD_051 (the derivation returns `Completed` for a project that has
 * completed a migration).
 *
 * feature.md FR-5.5. trd.md TR-9.
 *
 * `Completed` is unreachable through the product today — v3 has no migration
 * step and therefore no completion signal — so this exercises the derivation
 * directly. FR-5.5 requires the branch to exist now precisely so that adding the
 * signal later changes the input rather than this function's shape.
 */
import { deriveProjectStatus } from '../../../../v3/utils/projectStatus';

const project = (over: Record<string, unknown> = {}) => ({
  id: 'P1',
  orgId: 'O1',
  name: 'Blog content move',
  region: 'NA',
  owner: 'U1',
  isDeleted: false,
  created_at: 't',
  updated_at: 't',
  ...over,
});

describe('v3 deriveProjectStatus', () => {
  it('TC_PD_051 (positive): a project that has completed a migration derives Completed', () => {
    const completed = project({
      source: { mode: 'stack', lastExport: { status: 'succeeded' } },
      destination: { region: 'NA', orgId: 'O1', stack: { apiKey: 'blt1', name: 'Prod' } },
      migration: { status: 'succeeded' },
    });

    expect(deriveProjectStatus(completed as never)).toBe('Completed');
  });

  // Negative — taxonomy #2 (invalid shape): a migration that exists but has not
  // succeeded is not completion. Treating any migration record as `Completed`
  // would report a running or failed migration as finished.
  it('TC_PD_051 (negative): a migration that has not succeeded does not derive Completed', () => {
    const running = project({
      source: { mode: 'stack', lastExport: { status: 'succeeded' } },
      destination: { region: 'NA', orgId: 'O1', stack: { apiKey: 'blt1', name: 'Prod' } },
      migration: { status: 'running' },
    });

    expect(deriveProjectStatus(running as never)).toBe('In Progress');
  });
});
