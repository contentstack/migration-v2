import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 destination thunks.
 * Backs TC_DEST_010 (create stack → selected + modal closed), TC_DEST_012
 * (create-request failure), TC_DEST_013 (blank description is allowed),
 * TC_DEST_014 (stack-name collision → error, nothing created), TC_DEST_015
 * (non-home region opens the login modal), TC_DEST_018 (valid region login),
 * TC_DEST_019 (invalid credentials), TC_DEST_027 (management token created on
 * Proceed, before persisting), TC_DEST_028 (token-name collision blocks the
 * advance), TC_DEST_041 (happy-path persist + advance), TC_DEST_050 (resume),
 * TC_DEST_051 (persist failure).
 * feature.md AC-2.2, AC-3.5, AC-3.6, AC-5.1, AC-7.2, AC-7.4, AC-1.2, EC-3,
 * EC-4, EC-5, EC-13. The API service is mocked; a real store verifies state.
 */
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getRegions: vi.fn(),
    regionLogin: vi.fn(),
    getOrgs: vi.fn(),
    getStacks: vi.fn(),
    getBranches: vi.fn(),
    getLocales: vi.fn(),
    getContentstackLocales: vi.fn(),
    createStack: vi.fn(),
    createManagementToken: vi.fn(),
    getStackStats: vi.fn(),
    persistDestination: vi.fn(),
    getDestination: vi.fn(),
    getSource: vi.fn(),
  },
}));
vi.mock('../../../../../v3/services/api/destination.service', () => ({
  destinationApi: mockApi,
}));

import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import {
  createDestStack,
  selectDestRegion,
  submitDestRegionLogin,
  proceedToContentMapping,
  loadPersistedDestination,
} from '../../../../../v3/store/thunks/destination.thunks';

const mkStore = () => configureStore({ reducer: { destination: destinationReducer } });

/** Store with 'NA' as the already-authenticated home region. */
const mkStoreHomeNA = () => {
  const store = mkStore();
  store.dispatch(destinationActions.setField({ field: 'homeRegion', value: 'NA' }));
  store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
  return store;
};

/** A complete, proceed-ready destination selection using the authToken method. */
const seedReady = (store: any) => {
  store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
  store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
  store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt1' }));
  store.dispatch(destinationActions.setImportMethod('authToken'));
  store.dispatch(
    destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
  );
};

const httpError = (status: number, message: string) => ({
  response: { status, data: { error: { message } } },
});

beforeEach(() => {
  Object.values(mockApi).forEach((m) => (m as any).mockReset());
  mockApi.getStackStats.mockResolvedValue({ data: { isEmpty: true, stats: [] } });
  mockApi.getBranches.mockResolvedValue({ data: { branches: [{ uid: 'main' }] } });
  mockApi.getLocales.mockResolvedValue({ data: { locales: [{ code: 'en-us' }] } });
  mockApi.getContentstackLocales.mockResolvedValue({ data: { locales: [{ code: 'en-us', name: 'English' }] } });
  mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
  mockApi.getStacks.mockResolvedValue({ data: { stacks: [] } });
});

describe('v3 destination thunks — create stack', () => {
  it('TC_DEST_010 (positive): a successful create selects the new stack and closes the modal', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    mockApi.createStack.mockResolvedValue({ data: { apiKey: 'blt-new', name: 'production-eu' } });

    await store.dispatch(createDestStack() as any);

    const st = store.getState().destination;
    expect(st.stackApiKey).toBe('blt-new');
    expect(st.stackName).toBe('production-eu');
    expect(st.stackWasCreated).toBe(true);
    expect(st.createStack.open).toBe(false);
    // "Set as the selected destination Stack" (AC-7.2) means actually selectable:
    // the Stack dropdown builds its options from `stacks`, so a created stack that
    // is not appended there leaves the select bound to a value with no matching
    // option — which renders blank.
    expect(st.stacks).toEqual(
      expect.arrayContaining([{ value: 'blt-new', label: 'production-eu' }])
    );
  });

  // Negative — taxonomy #1 (missing/empty input): a blank name never reaches the API.
  it('TC_DEST_010 (negative): a blank stack name issues no create request', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: '   ' }));

    await store.dispatch(createDestStack() as any);

    expect(mockApi.createStack).not.toHaveBeenCalled();
    expect(store.getState().destination.createStack.open).toBe(true);
  });

  it('TC_DEST_012 (positive): a failed create surfaces the error, ends loading and keeps the modal open for retry', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'description', value: 'draft desc' }));
    mockApi.createStack.mockRejectedValue(httpError(502, 'Contentstack is unreachable.'));

    await store.dispatch(createDestStack() as any);

    const st = store.getState().destination;
    expect(st.createStack.error).toBe('Contentstack is unreachable.');
    expect(st.createStack.loading).toBe(false);
    expect(st.createStack.open).toBe(true);
    // in-progress selection retained for retry (EC-5)
    expect(st.createStack.name).toBe('production-eu');
    expect(st.createStack.description).toBe('draft desc');
    expect(st.stackApiKey).toBe('');
  });

  // Negative — taxonomy #6 (dependency failure, contrast): when the dependency
  // succeeds no error is recorded and the stack IS selected.
  it('TC_DEST_012 (negative): a successful create records no error and selects the stack', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    mockApi.createStack.mockResolvedValue({ data: { apiKey: 'blt-new', name: 'production-eu' } });

    await store.dispatch(createDestStack() as any);

    const st = store.getState().destination;
    expect(st.createStack.error).toBeUndefined();
    expect(st.stackApiKey).toBe('blt-new');
  });

  it('TC_DEST_013 (positive): a blank Stack description is accepted and sent as undefined', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    mockApi.createStack.mockResolvedValue({ data: { apiKey: 'blt-new', name: 'production-eu' } });

    await store.dispatch(createDestStack() as any);

    expect(mockApi.createStack).toHaveBeenCalledWith({
      orgId: 'o1',
      name: 'production-eu',
      description: undefined,
      masterLocale: 'en-us',
    });
  });

  // Negative — a supplied description IS forwarded, so the undefined above is a real
  // "omitted" signal rather than the description never being sent at all.
  it('TC_DEST_013 (negative): a supplied Stack description is forwarded to the API', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    store.dispatch(
      destinationActions.setCreateStackField({ field: 'description', value: 'EU marketing content' })
    );
    mockApi.createStack.mockResolvedValue({ data: { apiKey: 'blt-new', name: 'production-eu' } });

    await store.dispatch(createDestStack() as any);

    expect(mockApi.createStack).toHaveBeenCalledWith({
      orgId: 'o1',
      name: 'production-eu',
      description: 'EU marketing content',
      masterLocale: 'en-us',
    });
  });

  it('TC_DEST_014 (positive): a colliding stack name shows the already-exists error, creates nothing and keeps the modal open', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    mockApi.createStack.mockRejectedValue(
      httpError(400, "A stack named 'production-eu' already exists in this organization.")
    );

    await store.dispatch(createDestStack() as any);

    const st = store.getState().destination;
    expect(st.createStack.error).toBe(
      "A stack named 'production-eu' already exists in this organization."
    );
    expect(st.createStack.open).toBe(true);
    expect(st.createStack.name).toBe('production-eu');
    expect(st.stackApiKey).toBe('');
    expect(st.stackWasCreated).toBe(false);
  });

  // Negative — taxonomy #7 (conflict, contrast): the SAME flow with a non-colliding
  // name succeeds, so the block above is the collision being handled, not a
  // permanently broken create path.
  it('TC_DEST_014 (negative): a non-colliding name completes and marks the stack as created', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu-2' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'en-us' }));
    mockApi.createStack.mockResolvedValue({ data: { apiKey: 'blt-new', name: 'production-eu-2' } });

    await store.dispatch(createDestStack() as any);

    const st = store.getState().destination;
    expect(st.createStack.error).toBeUndefined();
    expect(st.stackWasCreated).toBe(true);
  });
});

describe('v3 destination thunks — create stack master locale', () => {
  it('(master locale, positive) the chosen master locale is forwarded and seeds the mapping row', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));
    store.dispatch(destinationActions.setCreateStackField({ field: 'masterLocale', value: 'fr-fr' }));
    mockApi.createStack.mockResolvedValue({
      data: { apiKey: 'blt-new', name: 'production-eu', masterLocale: 'fr-fr' },
    });

    await store.dispatch(createDestStack() as any);

    expect(mockApi.createStack).toHaveBeenCalledWith(
      expect.objectContaining({ masterLocale: 'fr-fr' })
    );
    expect(store.getState().destination.masterLocaleMapping.destLocale).toBe('fr-fr');
  });

  // Negative — taxonomy #1 (missing input): no master locale, no request. A stack's
  // master locale cannot be changed after creation, so it must not be defaulted here.
  it('(master locale, negative) a missing master locale issues no create request', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
    store.dispatch(destinationActions.openCreateStack());
    store.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'production-eu' }));

    await store.dispatch(createDestStack() as any);

    expect(mockApi.createStack).not.toHaveBeenCalled();
    expect(store.getState().destination.createStack.open).toBe(true);
  });
});

describe('v3 destination thunks — region re-authentication', () => {
  it('TC_DEST_015 (positive): picking a non-home region opens the login modal for that region', async () => {
    const store = mkStoreHomeNA();

    await store.dispatch(selectDestRegion('EU') as any);

    const rl = store.getState().destination.regionLogin;
    expect(rl.open).toBe(true);
    expect(rl.region).toBe('EU');
    expect(rl.prevRegion).toBe('NA');
    expect(mockApi.getOrgs).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): the HOME region needs no login — it
  // loads its organizations straight away with no modal.
  it('TC_DEST_015 (negative): picking the home region opens no modal and loads its organizations', async () => {
    const store = mkStoreHomeNA();
    store.dispatch(destinationActions.setField({ field: 'region', value: 'EU' }));

    await store.dispatch(selectDestRegion('NA') as any);

    expect(store.getState().destination.regionLogin.open).toBe(false);
    expect(mockApi.getOrgs).toHaveBeenCalled();
  });

  it('TC_DEST_018 (positive): a valid region login unlocks the region, closes the modal and keeps the new region', async () => {
    const store = mkStoreHomeNA();
    await store.dispatch(selectDestRegion('EU') as any);
    store.dispatch(destinationActions.setRegionLoginField({ field: 'email', value: 'me@company.com' }));
    store.dispatch(destinationActions.setRegionLoginField({ field: 'password', value: 's3cret' }));
    mockApi.regionLogin.mockResolvedValue({ data: { userId: 'u-eu', email: 'me@company.com' } });

    await store.dispatch(submitDestRegionLogin() as any);

    const st = store.getState().destination;
    expect(st.regionLogin.open).toBe(false);
    expect(st.region).toBe('EU');
    expect(st.regionAuth.EU).toBe('u-eu');
  });

  // Negative — taxonomy #1 (missing input): with blank credentials the login is never
  // attempted and the modal stays open.
  it('TC_DEST_018 (negative): blank credentials attempt no login and leave the modal open', async () => {
    const store = mkStoreHomeNA();
    await store.dispatch(selectDestRegion('EU') as any);

    await store.dispatch(submitDestRegionLogin() as any);

    expect(mockApi.regionLogin).not.toHaveBeenCalled();
    expect(store.getState().destination.regionLogin.open).toBe(true);
  });

  it('TC_DEST_019 (positive): invalid credentials show an error, keep the modal open and do not unlock the region', async () => {
    const store = mkStoreHomeNA();
    await store.dispatch(selectDestRegion('EU') as any);
    store.dispatch(destinationActions.setRegionLoginField({ field: 'email', value: 'me@company.com' }));
    store.dispatch(destinationActions.setRegionLoginField({ field: 'password', value: 'wrong' }));
    mockApi.regionLogin.mockRejectedValue(httpError(401, 'Invalid email or password.'));

    await store.dispatch(submitDestRegionLogin() as any);

    const st = store.getState().destination;
    expect(st.regionLogin.error).toBe('Invalid email or password.');
    expect(st.regionLogin.open).toBe(true);
    expect(st.regionLogin.loading).toBe(false);
    expect(st.regionAuth.EU).toBeUndefined();
  });

  // Negative — taxonomy #6 (dependency failure, contrast): valid credentials on the
  // same path record no error and do unlock the region.
  it('TC_DEST_019 (negative): valid credentials record no error and unlock the region', async () => {
    const store = mkStoreHomeNA();
    await store.dispatch(selectDestRegion('EU') as any);
    store.dispatch(destinationActions.setRegionLoginField({ field: 'email', value: 'me@company.com' }));
    store.dispatch(destinationActions.setRegionLoginField({ field: 'password', value: 's3cret' }));
    mockApi.regionLogin.mockResolvedValue({ data: { userId: 'u-eu', email: 'me@company.com' } });

    await store.dispatch(submitDestRegionLogin() as any);

    const st = store.getState().destination;
    expect(st.regionLogin.error).toBeUndefined();
    expect(st.regionAuth.EU).toBe('u-eu');
  });
});

describe('v3 destination thunks — Proceed', () => {
  it('TC_DEST_027 (positive): Proceed creates the management token before persisting the selection', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(destinationActions.setImportMethod('management'));
    store.dispatch(destinationActions.setManagementTokenName('eu-marketing-import'));
    mockApi.createManagementToken.mockResolvedValue({
      data: { uid: 'tok1', name: 'eu-marketing-import', secret: 'cs-secret' },
    });
    mockApi.persistDestination.mockResolvedValue({ data: { destination: {} } });

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    expect(mockApi.createManagementToken).toHaveBeenCalledWith({
      stackApiKey: 'blt1',
      name: 'eu-marketing-import',
    });
    expect(mockApi.persistDestination).toHaveBeenCalled();
    expect(
      mockApi.createManagementToken.mock.invocationCallOrder[0]
    ).toBeLessThan(mockApi.persistDestination.mock.invocationCallOrder[0]);
    expect(store.getState().destination.proceeded).toBe(true);
  });

  // Negative — taxonomy #4 (forbidden state): the authToken method mints no token, so
  // Proceed must persist WITHOUT calling the token endpoint at all.
  it('TC_DEST_027 (negative): the authToken method persists without creating any management token', async () => {
    const store = mkStore();
    seedReady(store); // authToken
    mockApi.persistDestination.mockResolvedValue({ data: { destination: {} } });

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    expect(mockApi.createManagementToken).not.toHaveBeenCalled();
    expect(mockApi.persistDestination).toHaveBeenCalled();
  });

  it('TC_DEST_028 (positive): a colliding token name blocks the advance — nothing is persisted', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(destinationActions.setImportMethod('management'));
    store.dispatch(destinationActions.setManagementTokenName('eu-marketing-import'));
    mockApi.createManagementToken.mockRejectedValue(
      httpError(400, "A management token named 'eu-marketing-import' already exists on this stack.")
    );

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.error).toBe(
      "A management token named 'eu-marketing-import' already exists on this stack."
    );
    expect(mockApi.persistDestination).not.toHaveBeenCalled();
    expect(st.proceeded).toBe(false);
    expect(st.saving).toBe(false);
  });

  // Negative — taxonomy #7 (conflict, contrast): a non-colliding token name completes
  // the whole chain, so the block above is the collision, not a broken Proceed.
  it('TC_DEST_028 (negative): a non-colliding token name persists and advances', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(destinationActions.setImportMethod('management'));
    store.dispatch(destinationActions.setManagementTokenName('eu-marketing-import-2'));
    mockApi.createManagementToken.mockResolvedValue({
      data: { uid: 'tok2', name: 'eu-marketing-import-2', secret: 'cs-secret' },
    });
    mockApi.persistDestination.mockResolvedValue({ data: { destination: {} } });

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.error).toBeUndefined();
    expect(st.proceeded).toBe(true);
  });

  it('TC_DEST_041 (positive): the happy path persists the full destination selection and advances', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(destinationActions.setDestBranch('main'));
    store.dispatch(destinationActions.setDestMasterLocale('en-gb'));
    mockApi.persistDestination.mockResolvedValue({ data: { destination: {} } });

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    expect(mockApi.persistDestination).toHaveBeenCalledWith(
      'O1',
      'P1',
      expect.objectContaining({
        region: 'NA',
        orgId: 'o1',
        stack: expect.objectContaining({ apiKey: 'blt1', wasCreated: false }),
        importAuth: expect.objectContaining({ method: 'authToken' }),
        branchMapping: { srcBranch: 'main', destBranch: 'main' },
        masterLocaleMapping: { srcLocale: 'en-us', destLocale: 'en-gb' },
      })
    );
    expect(store.getState().destination.proceeded).toBe(true);
  });

  // Negative — taxonomy #4 (forbidden state): a not-ready source must block the thunk
  // itself, not just the button — nothing is persisted and the user does not advance.
  it('TC_DEST_041 (negative): a not-ready source blocks the thunk — nothing is persisted', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(
      destinationActions.setSourceContext({ ready: false, region: 'NA', branch: 'main', masterLocale: 'en-us' })
    );

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    expect(mockApi.persistDestination).not.toHaveBeenCalled();
    expect(store.getState().destination.proceeded).toBe(false);
  });

  it('TC_DEST_051 (positive): a failed persist surfaces the error, ends saving and keeps the selection', async () => {
    const store = mkStore();
    seedReady(store);
    mockApi.persistDestination.mockRejectedValue(httpError(500, 'Could not save the destination.'));

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.error).toBe('Could not save the destination.');
    expect(st.saving).toBe(false);
    expect(st.proceeded).toBe(false);
    // in-progress selection retained for retry (EC-5)
    expect(st.stackApiKey).toBe('blt1');
    expect(st.importAuth.method).toBe('authToken');
  });

  // Negative — taxonomy #6 (dependency failure, contrast): a successful persist clears
  // any prior error and does advance.
  it('TC_DEST_051 (negative): a successful persist clears the error and advances', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(destinationActions.setError('previous failure'));
    mockApi.persistDestination.mockResolvedValue({ data: { destination: {} } });

    await store.dispatch(proceedToContentMapping('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.error).toBeUndefined();
    expect(st.proceeded).toBe(true);
  });
});

describe('v3 destination thunks — resume', () => {
  it('TC_DEST_050 (positive): a persisted destination is restored field-for-field on load', async () => {
    const store = mkStore();
    mockApi.getDestination.mockResolvedValue({
      data: {
        destination: {
          region: 'EU',
          orgId: 'o9',
          stack: { apiKey: 'blt9', name: 'Production — EU', wasCreated: true },
          importAuth: { method: 'management', managementToken: { name: 'eu-import' } },
          branchMapping: { srcBranch: 'release-eu', destBranch: 'develop' },
          masterLocaleMapping: { srcLocale: 'en-us', destLocale: 'en-gb' },
          additionalLanguageMappings: [{ srcLocale: 'fr-fr', destLocale: 'fr-fr' }],
        },
      },
    });

    await store.dispatch(loadPersistedDestination('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.region).toBe('EU');
    expect(st.org).toBe('o9');
    expect(st.stackApiKey).toBe('blt9');
    expect(st.stackName).toBe('Production — EU');
    expect(st.importAuth.method).toBe('management');
    expect(st.importAuth.managementTokenName).toBe('eu-import');
    expect(st.branchMapping).toEqual({ srcBranch: 'release-eu', destBranch: 'develop' });
    expect(st.masterLocaleMapping).toEqual({ srcLocale: 'en-us', destLocale: 'en-gb' });
    expect(st.additionalLanguageMappings).toEqual([{ srcLocale: 'fr-fr', destLocale: 'fr-fr' }]);
  });

  // Negative — taxonomy #6 (dependency failure): a 404 (nothing persisted yet) is the
  // normal first-visit state — it must leave a pristine form, not raise an error.
  it('TC_DEST_050 (negative): a 404 with no persisted destination leaves a pristine form and no error', async () => {
    const store = mkStore();
    mockApi.getDestination.mockRejectedValue(httpError(404, 'No destination selection found.'));

    await store.dispatch(loadPersistedDestination('O1', 'P1') as any);

    const st = store.getState().destination;
    expect(st.error).toBeUndefined();
    expect(st.region).toBe('');
    expect(st.stackApiKey).toBe('');
    expect(st.importAuth.method).toBeUndefined();
  });
});
