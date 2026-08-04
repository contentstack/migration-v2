import { WIZARD_STEPS } from '../components/wizard/steps';

/**
 * Derived resume step (cs-project-dashboard trd.md TR-10, FR-4.9).
 *
 * Returns the wizard route segment a project should open at — the furthest step
 * it has reached — computed from its persisted documents. Deliberately derived
 * rather than stored: v2 keeps a `current_step` number on the record, which is a
 * second source of truth that can disagree with the documents (TC-1).
 *
 * Expressed in `migration-wizard-chrome`'s own step vocabulary rather than a
 * local copy of it, so reordering the wizard cannot silently desynchronise this.
 *
 * Known limit (feature.md Q-2): a step the user merely visited without persisting
 * anything is not represented, so someone who opened Content mapping and saved
 * nothing reopens at Destination.
 */
export interface ResumeInput {
  source?: { lastExport?: { status?: string } | null } | null;
  destination?: unknown;
}

const segment = (id: string): string =>
  WIZARD_STEPS.find((s) => s.id === id)?.routeSegment ?? WIZARD_STEPS[0].routeSegment;

export const deriveResumeStep = (project: ResumeInput | null | undefined): string => {
  // A persisted destination outranks a ready source — it is strictly further
  // along the flow, so the presence of both must not resolve to Audit.
  if (project?.destination) return segment('destination');

  // Only a SUCCEEDED export counts as progress past the first step. A running or
  // failed export is not progress (FR-4.9).
  if (project?.source?.lastExport?.status === 'succeeded') return segment('audit');

  return segment('source');
};
