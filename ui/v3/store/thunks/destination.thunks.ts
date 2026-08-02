import type { V3Dispatch, V3RootState } from '../index';
import { destinationApi, RegionCredential } from '../../services/api/destination.service';
import { canProceed, destinationActions, destStackLabel } from '../slice/destination.slice';

const errMsg = (e: any): string =>
  e?.response?.data?.message ??
  e?.response?.data?.error?.message ??
  e?.message ??
  'Something went wrong.';

/** Client-side fallback so the Region dropdown is never blank if /regions fails. */
const DEFAULT_REGIONS = [
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
  { value: 'AZURE_NA', label: 'Azure North America' },
  { value: 'AZURE_EU', label: 'Azure Europe' },
  { value: 'GCP_NA', label: 'GCP North America' },
];
const DEFAULT_HOME_REGION = 'NA';

/**
 * Credential for the currently-selected destination region. The home region
 * needs none (the app session covers it); a region unlocked via region-login
 * carries its resolved userId. Omitted entirely for the home region so the
 * server falls back to the session credential.
 */
const currentCredential = (state: V3RootState): RegionCredential => {
  const { region, homeRegion, regionAuth } = state.destination;
  const regionUserId = regionAuth[region];
  // Only forward a cross-region credential when one has actually been resolved.
  // Sending `{ region, regionUserId: undefined }` would make the server's
  // resolveRegionCredential reject a request the session credential can serve.
  if (!region || region === homeRegion || !regionUserId) return {};
  return { region, regionUserId };
};

const loadOrgsFor = async (dispatch: V3Dispatch, rc: RegionCredential) => {
  dispatch(destinationActions.setStacks([]));
  dispatch(destinationActions.setBranches([]));
  try {
    const { data } = await destinationApi.getOrgs(rc);
    dispatch(
      destinationActions.setOrgs(
        (data.orgs ?? []).map((o: any) => ({ value: o.uid, label: o.name }))
      )
    );
  } catch (e) {
    dispatch(destinationActions.setError(errMsg(e)));
  }
};

/** Load the selectable regions + the session's home region, then its orgs. */
export const loadDestRegions = () => async (dispatch: V3Dispatch) => {
  try {
    const { data } = await destinationApi.getRegions();
    const regions = data.regions?.length ? data.regions : DEFAULT_REGIONS;
    const homeRegion: string = data.homeRegion || DEFAULT_HOME_REGION;

    dispatch(destinationActions.setRegions(regions));
    dispatch(destinationActions.setField({ field: 'homeRegion', value: homeRegion }));
    dispatch(destinationActions.setField({ field: 'region', value: homeRegion }));
    await loadOrgsFor(dispatch, {});
  } catch (e) {
    dispatch(destinationActions.setError(errMsg(e)));
    dispatch(destinationActions.setRegions(DEFAULT_REGIONS));
    dispatch(destinationActions.setField({ field: 'homeRegion', value: DEFAULT_HOME_REGION }));
    dispatch(destinationActions.setField({ field: 'region', value: DEFAULT_HOME_REGION }));
    await loadOrgsFor(dispatch, {});
  }
};

/**
 * Destination region changed (FR-2.1). The home region — or one already unlocked
 * this session — loads immediately. Any other region requires a real
 * Contentstack login for it first; org loading is deferred until that succeeds.
 */
export const selectDestRegion =
  (region: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const d = getState().destination;
    const alreadyUnlocked = region === d.homeRegion || !!d.regionAuth[region];

    if (!alreadyUnlocked) {
      dispatch(destinationActions.openRegionLogin({ region, prevRegion: d.region }));
      return;
    }

    dispatch(destinationActions.setField({ field: 'region', value: region }));
    dispatch(destinationActions.setField({ field: 'org', value: '' }));
    dispatch(destinationActions.setField({ field: 'stackApiKey', value: '' }));
    dispatch(destinationActions.setField({ field: 'stackName', value: '' }));
    dispatch(destinationActions.setStackStats(undefined));
    await loadOrgsFor(dispatch, currentCredential(getState()));
  };

/** Submit the region-login modal: real Contentstack login, then unlock the region. */
export const submitDestRegionLogin =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const rl = getState().destination.regionLogin;
    if (!rl.region || !rl.email.trim() || !rl.password.trim()) return;

    dispatch(destinationActions.setRegionLoginLoading(true));
    try {
      const { data } = await destinationApi.regionLogin(
        rl.region,
        rl.email.trim(),
        rl.password
      );
      dispatch(destinationActions.regionAuthed({ region: rl.region, userId: data.userId }));
      dispatch(destinationActions.setField({ field: 'org', value: '' }));
      dispatch(destinationActions.setField({ field: 'stackApiKey', value: '' }));
      await loadOrgsFor(dispatch, { region: rl.region, regionUserId: data.userId });
    } catch (e) {
      dispatch(destinationActions.setRegionLoginError(errMsg(e)));
    }
  };

export const cancelDestRegionLogin = () => (dispatch: V3Dispatch) => {
  dispatch(destinationActions.cancelRegionLogin());
};

export const selectDestOrg =
  (org: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(destinationActions.setField({ field: 'org', value: org }));
    dispatch(destinationActions.setField({ field: 'stackApiKey', value: '' }));
    dispatch(destinationActions.setField({ field: 'stackName', value: '' }));
    dispatch(destinationActions.setBranches([]));
    dispatch(destinationActions.setStackStats(undefined));
    try {
      const rc = currentCredential(getState());
      const { data } = await destinationApi.getStacks(org, rc);
      dispatch(
        destinationActions.setStacks(
          (data.stacks ?? []).map((s: any) => ({ value: s.apiKey, label: s.name }))
        )
      );
    } catch (e) {
      dispatch(destinationActions.setError(errMsg(e)));
    }
  };

/** Fetch the destination stack's existing content statistics (FR-10.4). */
export const loadDestStackStats =
  (apiKey: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(destinationActions.setStatsLoading(true));
    try {
      const { data } = await destinationApi.getStackStats(apiKey, currentCredential(getState()));
      dispatch(destinationActions.setStackStats({ isEmpty: !!data.isEmpty, stats: data.stats ?? [] }));
    } catch {
      // EC-14 fallback is undecided (feature.md Q-18) — clear the card rather
      // than inventing an error state the design does not define.
      dispatch(destinationActions.setStackStats(undefined));
    }
  };

/** An existing stack was picked: load its branches, locales and content stats. */
export const selectDestStack =
  (stackApiKey: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(destinationActions.setField({ field: 'stackApiKey', value: stackApiKey }));
    dispatch(destinationActions.setField({ field: 'stackWasCreated', value: false }));
    dispatch(destinationActions.setDestBranch('main'));

    const rc = currentCredential(getState());
    try {
      const { data } = await destinationApi.getBranches(stackApiKey, rc);
      dispatch(
        destinationActions.setBranches(
          (data.branches ?? []).map((b: any) => ({ value: b.uid, label: b.uid }))
        )
      );
    } catch (e) {
      dispatch(destinationActions.setError(errMsg(e)));
    }
    try {
      const { data } = await destinationApi.getLocales(stackApiKey, rc);
      dispatch(
        destinationActions.setLocales(
          (data.locales ?? []).map((l: any) => ({ value: l.code, label: l.name ?? l.code }))
        )
      );
    } catch {
      /* locale options unavailable — the dropdowns simply stay empty */
    }
    await dispatch(loadDestStackStats(stackApiKey) as any);
  };

/**
 * Create the new destination stack (UC-7 / FR-1.5). A 400 from Contentstack —
 * including a name that already exists in the organization (EC-3) — is surfaced
 * on the modal, which stays open with the user's values intact for correction.
 */
export const createDestStack =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const d = getState().destination;
    const name = d.createStack.name.trim();
    const masterLocale = d.createStack.masterLocale.trim();
    // A stack's master locale is fixed at creation and cannot be changed
    // afterwards, so it must be an explicit choice — never defaulted here.
    if (!name || !masterLocale) return;

    const description = d.createStack.description.trim() || undefined;
    const rc = currentCredential(getState());

    dispatch(destinationActions.setCreateStackError(undefined));
    dispatch(destinationActions.setCreateStackLoading(true));
    try {
      const { data } = await destinationApi.createStack({
        orgId: d.org,
        name,
        description,
        masterLocale,
        ...rc,
      });
      dispatch(
        destinationActions.stackCreated({
          apiKey: data.apiKey,
          name: data.name,
          masterLocale: data.masterLocale ?? masterLocale,
        })
      );
      // A newly created stack has only the default `main` branch (EC-12).
      dispatch(destinationActions.setBranches([{ value: 'main', label: 'main' }]));
      dispatch(destinationActions.setDestBranch('main'));
    } catch (e) {
      dispatch(destinationActions.setCreateStackError(errMsg(e)));
    }
  };

/** Every locale Contentstack supports — feeds the create-stack master-locale
 * picker. Loaded once; a failure just leaves the picker empty. */
export const loadContentstackLocales =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    if (getState().destination.allLocales.length) return;
    dispatch(destinationActions.setAllLocalesLoading(true));
    dispatch(destinationActions.setAllLocalesError(undefined));
    dispatch(destinationActions.setAllLocalesLoading(true));
    try {
      const { data } = await destinationApi.getContentstackLocales(
        currentCredential(getState())
      );
      const list = (data.locales ?? [])
        .filter((l: any) => l?.code)
        .map((l: any) => ({
          value: l.code,
          label: l.name ? `${l.name} (${l.code})` : l.code,
        }));
      if (!list.length) {
        // A 200 with nothing usable is still a dead end for the user — say so
        // rather than rendering an empty dropdown.
        dispatch(
          destinationActions.setAllLocalesError('Contentstack returned no locales.')
        );
        return;
      }
      dispatch(destinationActions.setAllLocales(list));
    } catch (e) {
      dispatch(destinationActions.setAllLocalesError(errMsg(e)));
    }
  };

/** Read the persisted source this panel depends on (FR-8.3 / DEP-1). */
export const loadSourceContext =
  (orgId: string, projectId: string) => async (dispatch: V3Dispatch) => {
    try {
      const { data } = await destinationApi.getSource(orgId, projectId);
      const src = data.source ?? {};
      dispatch(
        destinationActions.setSourceContext({
          ready: src.lastExport?.status === 'succeeded' || !!src.graph,
          region: src.stack?.region ?? '',
          branch: src.stack?.branch ?? '',
          masterLocale: src.stack?.masterLocale ?? '',
        })
      );
    } catch {
      /* no source persisted yet — the gate stays closed (FR-6.2) */
    }
  };

/** Restore a previously persisted destination selection (UC-5 / AC-5.1). */
export const loadPersistedDestination =
  (orgId: string, projectId: string) => async (dispatch: V3Dispatch) => {
    try {
      const { data } = await destinationApi.getDestination(orgId, projectId);
      if (data?.destination) dispatch(destinationActions.hydrate(data.destination));
    } catch {
      // A 404 is the normal first-visit state, not an error (AC-5.1's negative).
    }
  };

/** The persisted `destination` document (trd.md DM-1). */
const buildDestinationDoc = (
  d: V3RootState['destination'],
  managementToken?: { name: string; uid?: string }
) => ({
  region: d.region,
  orgId: d.org,
  stack: {
    apiKey: d.stackApiKey,
    name: destStackLabel(d),
    wasCreated: d.stackWasCreated,
  },
  importAuth: {
    method: d.importAuth.method,
    ...(managementToken ? { managementToken } : {}),
  },
  branchMapping: { ...d.branchMapping },
  masterLocaleMapping: { ...d.masterLocaleMapping },
  additionalLanguageMappings: d.additionalLanguageMappings.map((m) => ({ ...m })),
});

/**
 * Proceed to content mapping (FR-6.3 / AC-1.2).
 *
 * For the Management-token method the token is created FIRST (FR-3.3 / AC-3.5,
 * resolving feature.md Q-15) and only a successful creation is followed by the
 * persist. A failure — including a token name that already exists on the stack
 * (EC-13 / AC-3.6) — surfaces the error and leaves the user on this panel with
 * nothing persisted.
 */
export const proceedToContentMapping =
  (orgId: string, projectId: string) =>
  async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const d = getState().destination;
    if (!canProceed(d)) return;

    const rc = currentCredential(getState());
    dispatch(destinationActions.setError(undefined));
    dispatch(destinationActions.setSaving(true));
    try {
      let managementToken: { name: string; uid?: string } | undefined;
      if (d.importAuth.method === 'management') {
        const { data } = await destinationApi.createManagementToken({
          stackApiKey: d.stackApiKey,
          name: d.importAuth.managementTokenName.trim(),
          ...rc,
        });
        managementToken = { name: data.name, uid: data.uid };
      }

      await destinationApi.persistDestination(
        orgId,
        projectId,
        buildDestinationDoc(getState().destination, managementToken)
      );
      dispatch(destinationActions.setProceeded(true));
    } catch (e) {
      dispatch(destinationActions.setError(errMsg(e)));
    } finally {
      dispatch(destinationActions.setSaving(false));
    }
  };
