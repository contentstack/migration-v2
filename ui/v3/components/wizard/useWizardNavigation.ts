import { useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { V3_BASE } from '../../constants';
import { stepByRouteSegment, WIZARD_STEPS } from './steps';

/**
 * Owns every step transition (feature.md FR-6.1–6.3).
 *
 * The chrome navigates; panels never do. Keeping this in one hook is what makes
 * "a control inside a panel does not change step" enforceable rather than a
 * convention.
 */
export const useWizardNavigation = () => {
  const navigate = useNavigate();
  const { projectId, stepId } = useParams();
  const [params] = useSearchParams();

  // The current step is read from the route, so a deep link, a refresh and a
  // Back button all resolve to the same step (AC-4.3).
  const activeIndex = useMemo(() => {
    const i = WIZARD_STEPS.indexOf(stepByRouteSegment(stepId)!);
    return i >= 0 ? i : 0;
  }, [stepId]);

  const pathFor = useCallback(
    (index: number) => {
      const step = WIZARD_STEPS[index];
      const base = `${V3_BASE}/projects/${projectId}/migration/steps/${step.routeSegment}`;
      // STOPGAP: `orgId` rides in the query string because the v3 route carries
      // no org (trd.md TQ-2). Preserved across transitions so the panels' reads
      // keep working; remove once the route owns the org.
      const orgId = params.get('orgId');
      return orgId ? `${base}?orgId=${encodeURIComponent(orgId)}` : base;
    },
    [projectId, params]
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= WIZARD_STEPS.length || index === activeIndex) return;
      navigate(pathFor(index));
    },
    [activeIndex, navigate, pathFor]
  );

  return {
    activeIndex,
    projectId: projectId ?? '',
    orgId: params.get('orgId') ?? '',
    isFirst: activeIndex === 0,
    goTo,
    /** Always the immediately preceding step, never a jump to the start. */
    goBack: useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex]),
    goNext: useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex]),
  };
};
