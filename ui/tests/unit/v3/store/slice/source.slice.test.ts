import { describe, it, expect } from 'vitest';

import reducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';

/**
 * TDD — v3 source.slice (reducers).
 * Backs TC_SRC_002 (mode switch retains the other mode's data — FR-1.2/EC-8),
 * TC_SRC_012 (stack scope default/change), TC_SRC_020 (file scope default +
 * validate), TC_SRC_026 (remove/clear resets the file sub-state only).
 */
const init = () => reducer(undefined, { type: '@@INIT' } as any);

describe('v3 source.slice', () => {
  it('TC_SRC_002 (positive): switching mode away and back retains the stack sub-state', () => {
    let s = init();
    s = reducer(s, sourceActions.setStackField({ field: 'region', value: 'NA' }));
    s = reducer(s, sourceActions.setMode('file'));
    s = reducer(s, sourceActions.setMode('stack'));
    expect(s.mode).toBe('stack');
    expect(s.stack.region).toBe('NA');
  });

  // Negative — taxonomy #7 (isolation/no cross-write): file edits do not touch stack state.
  it('TC_SRC_002 (negative): editing the file sub-state leaves the stack sub-state untouched', () => {
    let s = init();
    s = reducer(s, sourceActions.setStackField({ field: 'region', value: 'NA' }));
    s = reducer(s, sourceActions.setFileSelected({ fileName: 'x.zip', sizeBytes: 10 }));
    expect(s.file.fileName).toBe('x.zip');
    expect(s.stack.region).toBe('NA'); // unchanged
  });

  it('TC_SRC_012 (positive): stack scope defaults to "whole"', () => {
    expect(init().stack.scope).toBe('whole');
  });

  // Negative — the default is not sticky; it can move to "specific".
  it('TC_SRC_012 (negative): stack scope changes to "specific" when set', () => {
    const s = reducer(init(), sourceActions.setStackField({ field: 'scope', value: 'specific' }));
    expect(s.stack.scope).toBe('specific');
  });

  it('TC_SRC_020 (positive): file scope defaults to "all" and file starts unvalidated', () => {
    const s = init();
    expect(s.file.scope).toBe('all');
    expect(s.file.validated).toBe(false);
  });

  // Negative — validation transitions the file sub-state (validated + manifest + sourceId).
  it('TC_SRC_020 (negative): setFileValidated marks the file validated and stores the manifest', () => {
    const s = reducer(
      init(),
      sourceActions.setFileValidated({ sourceId: 's1', manifest: [{ name: 'Content Types', count: 2 }] })
    );
    expect(s.file.validated).toBe(true);
    expect(s.file.sourceId).toBe('s1');
    expect(s.file.manifest).toEqual([{ name: 'Content Types', count: 2 }]);
  });

  it('TC_SRC_026 (positive): clearFile resets the file sub-state', () => {
    let s = init();
    s = reducer(s, sourceActions.setFileSelected({ fileName: 'x.zip', sizeBytes: 10 }));
    s = reducer(s, sourceActions.setFileValidated({ sourceId: 's1', manifest: [{ name: 'A', count: 1 }] }));
    s = reducer(s, sourceActions.clearFile());
    expect(s.file.fileName).toBeUndefined();
    expect(s.file.validated).toBe(false);
    expect(s.file.manifest).toEqual([]);
  });

  // Negative — clearFile is scoped to the file sub-state; it must not touch stack state.
  it('TC_SRC_026 (negative): clearFile does not affect the stack sub-state', () => {
    let s = init();
    s = reducer(s, sourceActions.setStackField({ field: 'region', value: 'NA' }));
    s = reducer(s, sourceActions.clearFile());
    expect(s.stack.region).toBe('NA');
  });
});
