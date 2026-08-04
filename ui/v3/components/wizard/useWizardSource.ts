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
export const useWizardSource = (projectId: string): WizardSourceState => {
  const [state, setState] = useState<WizardSourceState>({
    sourceReady: false,
    destinationPersisted: false,
  });

  useEffect(() => {
    // A project id is all these reads need since the 2026-08-05 revision removed
    // the organization segment from their paths (cs-project-dashboard FR-9.13).
    if (!projectId) return;

    let live = true;

    void (async () => {
      let next: WizardSourceState = { sourceReady: false, destinationPersisted: false };

      try {
        const { data } = await wizardApi.getSource(projectId);
        const src = data?.source ?? {};
        next = {
          ...next,
          // GAP: the persisted source carries no stack *name* — `V3StackSource` has
          // region/orgId/stackApiKey/branch/scope/modules only — so a stack source
          // can only be identified by its API key here. File sources do carry a
          // filename. (That `orgId` is the Contentstack SOURCE organization, not the
          // project's; it is unaffected by this revision.) Reported, not worked around.
          sourceName: src.stack?.name ?? src.stack?.stackApiKey ?? src.file?.fileName,
          sourceReady: src.lastExport?.status === 'succeeded' || !!src.graph,
        };
      } catch {
        /* no source persisted yet — placeholder and an incomplete step (EC-8) */
      }

      try {
        const { data } = await wizardApi.getDestination(projectId);
        next = { ...next, destinationPersisted: !!data?.destination };
      } catch {
        /* a 404 is the normal first-visit state, not an error */
      }

      if (live) setState(next);
    })();

    return () => {
      live = false;
    };
  }, [projectId]);

  return state;
};
