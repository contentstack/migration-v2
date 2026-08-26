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
/**
 * @param projectId the project whose documents to read.
 * @param activeIndex the wizard step currently shown. Included ONLY as a re-read trigger:
 *   its value is never used, but a change of step is the moment the chrome must refresh.
 *
 *   ⚠️ Why it is needed. This hook derives step completion from the SERVER
 *   (`lastExport.status === 'succeeded' || !!graph`), which is the right rule — the chrome
 *   must not invent a second definition of "complete" out of in-memory slice state. But
 *   with `[projectId]` alone it read once and never again, so a successful export left the
 *   Source step without its tick until the page was refreshed, which remounted the hook.
 *
 *   Navigating between steps is the natural refresh point: it is exactly when the chrome's
 *   view of "what is done" is about to be looked at, it is route-driven so it needs no
 *   coupling to any slice, and it costs two small reads.
 */
export const useWizardSource = (projectId: string, activeIndex?: number): WizardSourceState => {
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
    /*
      `activeIndex` is a trigger, not an input — the effect reads nothing from it. Anything
      that changed on every render would loop here, because the effect sets state.
    */
  }, [projectId, activeIndex]);

  return state;
};
