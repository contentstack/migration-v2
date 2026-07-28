import { describe, it, expect } from 'vitest';

import {
  toggleModule,
  forcedKeys,
  ModuleLike,
} from '../../../../v3/utils/moduleSelection';

/**
 * TDD — v3 moduleSelection (toggleModule / forcedKeys).
 * Backs TC_SRC_023 (dependent auto-selects + marks its dependencies forced) and
 * TC_SRC_024 (a forced dependency cannot be unchecked while a dependent remains
 * selected). feature.md FR-3.6 / AC-2.5.
 */
const MODULES: ModuleLike[] = [
  { key: 'contentTypes', dependsOn: [] },
  { key: 'assets', dependsOn: [] },
  { key: 'entries', dependsOn: ['contentTypes', 'assets'] },
];

describe('v3 moduleSelection — toggleModule / forcedKeys', () => {
  it('TC_SRC_023 (positive): selecting a dependent auto-selects its dependencies and marks them forced', () => {
    const next = toggleModule(MODULES, [], 'entries');
    expect(next).toEqual(expect.arrayContaining(['entries', 'contentTypes', 'assets']));
    expect(next).toHaveLength(3);

    const forced = forcedKeys(MODULES, next);
    expect([...forced].sort()).toEqual(['assets', 'contentTypes']);
    expect(forced.has('entries')).toBe(false);
  });

  // Negative — taxonomy #1 (missing/empty: no dependencies): selecting a leaf adds only itself, forces nothing.
  it('TC_SRC_023 (negative): selecting a module with no dependencies adds only itself and forces nothing', () => {
    const next = toggleModule(MODULES, [], 'assets');
    expect(next).toEqual(['assets']);
    expect([...forcedKeys(MODULES, next)]).toEqual([]);
  });

  it('TC_SRC_024 (positive): a dependency cannot be unchecked while a dependent remains selected', () => {
    const selected = ['entries', 'contentTypes', 'assets'];
    const next = toggleModule(MODULES, selected, 'contentTypes');
    expect(next).toEqual(selected); // unchanged — uncheck blocked
    expect(next).toContain('contentTypes');
  });

  // Negative — taxonomy #4 (forbidden state contrast): an unforced module IS removable.
  it('TC_SRC_024 (negative): a module that is not required by any dependent is removed on uncheck', () => {
    const next = toggleModule(MODULES, ['assets'], 'assets');
    expect(next).toEqual([]);
  });
});
