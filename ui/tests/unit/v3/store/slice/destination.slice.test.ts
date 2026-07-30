import { describe, it, expect } from 'vitest';

import reducer, { destinationActions } from '../../../../../v3/store/slice/destination.slice';

/**
 * TDD — v3 destination.slice (reducers).
 * Backs TC_DEST_020 (cancelling the region-switch login reverts the Region field —
 * AC-2.3 / FR-2.4) and TC_DEST_025 (switching import-auth method discards the
 * other method's entered token name — AC-3.4 / FR-3.6 / EC-9).
 */
const init = () => reducer(undefined, { type: '@@INIT' } as any);

describe('v3 destination.slice — region-switch login', () => {
  it('TC_DEST_020 (positive): cancelling the region-switch login reverts Region to its prior value', () => {
    let s = init();
    s = reducer(s, destinationActions.setField({ field: 'region', value: 'NA' }));
    s = reducer(s, destinationActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
    expect(s.region).toBe('EU'); // committed optimistically while the modal is open

    s = reducer(s, destinationActions.cancelRegionLogin());
    expect(s.region).toBe('NA');
    expect(s.regionLogin.open).toBe(false);
  });

  // Negative — taxonomy #4 (forbidden state): a SUCCESSFUL login must NOT revert the
  // region; it keeps the new region and records its resolved userId.
  it('TC_DEST_020 (negative): a successful region login keeps the new region instead of reverting', () => {
    let s = init();
    s = reducer(s, destinationActions.setField({ field: 'region', value: 'NA' }));
    s = reducer(s, destinationActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
    s = reducer(s, destinationActions.regionAuthed({ region: 'EU', userId: 'u-eu' }));

    expect(s.region).toBe('EU');
    expect(s.regionAuth.EU).toBe('u-eu');
    expect(s.regionLogin.open).toBe(false);
  });
});

describe('v3 destination.slice — import authentication', () => {
  it('TC_DEST_025 (positive): switching from Management token to authToken discards the entered token name', () => {
    let s = init();
    s = reducer(s, destinationActions.setImportMethod('management'));
    s = reducer(s, destinationActions.setManagementTokenName('eu-marketing-import'));
    expect(s.importAuth.managementTokenName).toBe('eu-marketing-import');

    s = reducer(s, destinationActions.setImportMethod('authToken'));
    expect(s.importAuth.method).toBe('authToken');
    expect(s.importAuth.managementTokenName).toBe('');
  });

  // Negative — taxonomy #4 (forbidden state): re-selecting the SAME method is not a
  // switch, so it must NOT wipe the value the user already typed.
  it('TC_DEST_025 (negative): re-selecting the already-active method preserves the entered token name', () => {
    let s = init();
    s = reducer(s, destinationActions.setImportMethod('management'));
    s = reducer(s, destinationActions.setManagementTokenName('eu-marketing-import'));
    s = reducer(s, destinationActions.setImportMethod('management'));

    expect(s.importAuth.managementTokenName).toBe('eu-marketing-import');
  });
});
