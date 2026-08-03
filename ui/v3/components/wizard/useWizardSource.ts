import { useEffect, useState } from 'react';

import { wizardApi } from '../../services/api/wizard.service';

export interface WizardSourceState {
  /** Display name for the app bar's source indicator; undefined until known. */
  sourceName?: string;
  /** Whether the source step counts as complete (a succeeded export). */
  sourceReady: boolean;
  /** Whether a destination selection has been persisted. */
  destinationPersisted: boolean;
}

/**
 * Reads the persisted step documents the chrome needs (trd.md TR-3, TR-8).
 *
 * Called once, by `WizardChrome` — the app bar and the tracker both read this
 * one result rather than fetching independently (NFR-4).
 *
 * A failed or absent read is not an error state here: the app bar falls back to
 * "Not selected" and the step reads incomplete (feature.md EC-8). That is the
 * normal first-visit condition, not a fault worth surfacing in the chrome.
 */
export const useWizardSource = (orgId: string, projectId: string): WizardSourceState => {
  const [state, setState] = useState<WizardSourceState>({
    sourceReady: false,
    destinationPersisted: false,
  });

  useEffect(() => {
    // Without an org the reads would 404 on an empty path segment — skip rather
    // than fire them. See the STOPGAP note in pages/Migration (trd.md TQ-2).
    if (!orgId || !projectId) return;

    let live = true;

    void (async () => {
      let next: WizardSourceState = { sourceReady: false, destinationPersisted: false };

      try {
        const { data } = await wizardApi.getSource(orgId, projectId);
        const src = data?.source ?? {};
        next = {
          ...next,
          // GAP: the persisted source carries no stack *name* (api/v3 types
          // `V3StackSource` has region/orgId/stackApiKey/branch/scope/modules
          // only), so a stack source can only be identified by its API key
          // here. File sources do carry a filename. Reported, not worked around.
          sourceName: src.stack?.name ?? src.stack?.stackApiKey ?? src.file?.fileName,
          sourceReady: src.lastExport?.status === 'succeeded' || !!src.graph,
        };
      } catch {
        /* no source persisted yet — placeholder and an incomplete step (EC-8) */
      }

      try {
        const { data } = await wizardApi.getDestination(orgId, projectId);
        next = { ...next, destinationPersisted: !!data?.destination };
      } catch {
        /* a 404 is the normal first-visit state, not an error */
      }

      if (live) setState(next);
    })();

    return () => {
      live = false;
    };
  }, [orgId, projectId]);

  return state;
};
