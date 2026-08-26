import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { V3Dispatch, V3RootState } from './index';
import { auditActions } from './slice/audit.slice';
import { contentMappingActions } from './slice/contentMapping.slice';
import { destinationActions } from './slice/destination.slice';
import { scopeActions } from './slice/scope.slice';
import { sourceActions } from './slice/source.slice';

/**
 * Enforces the project-scope invariant: **state belonging to one project must never be
 * visible in another.**
 *
 * ## The bug this exists for
 *
 * Opening a project and going to its Audit page showed the stats of the project opened
 * *previously*, until the page was refreshed. The cause was not the audit fetch — it was
 * the absence of this rule. `AuditPanel` guards its load with `if (phase === 'idle')`, so
 * once anything is loaded it never re-reads, and the store still held the other project's
 * findings.
 *
 * `SourcePanel` has the identical shape (`if (!graph) dispatch(loadPersistedGraph)`), which
 * would show project A's content graph inside project B. It went unreported only because
 * nobody looked. Fixing the two guards individually would have left every future panel free
 * to repeat the mistake, so the rule is enforced once, here.
 *
 * ## Two things that are easy to get wrong
 *
 * **The scope must live in the store.** Returning to the dashboard and opening another
 * project unmounts the wizard page, so a component-local "previous id" is undefined on
 * arrival while the store still holds the old project. That is the reported flow exactly.
 *
 * **Children must not render until the scope is current.** React runs child effects BEFORE
 * parent ones, so a panel mounted alongside the reset would read the stale state in its own
 * mount effect, hit its `phase === 'idle'` guard, and skip the fetch — reproducing the bug
 * through the fix. Hence the boolean return: the caller renders the panel only once it is
 * true.
 *
 * @returns whether the store's project-scoped state belongs to `projectId` yet.
 */
export const useProjectScope = (projectId: string): boolean => {
  const dispatch = useDispatch<V3Dispatch>();
  const current = useSelector((s: V3RootState) => s.scope.projectId);

  /*
    An empty id is a route in transition, not a change of project. Treating it as one would
    wipe the state of the project still on screen.
  */
  const settled = !projectId || current === projectId;

  useEffect(() => {
    if (!projectId || current === projectId) return;

    /*
      Every slice whose contents describe ONE project. `session` (the signed-in user),
      `project` (the dashboard list) and `toast` (transient UI) are app-scoped and must
      survive — resetting them would sign the user out of their own project list.

      A new project-scoped slice belongs in this list. That is the one thing to remember,
      and it is the whole rule rather than a condition repeated in every panel.
    */
    dispatch(auditActions.reset());
    dispatch(sourceActions.reset());
    dispatch(destinationActions.reset());
    dispatch(contentMappingActions.reset());
    dispatch(scopeActions.enterProject(projectId));
  }, [dispatch, projectId, current]);

  return settled;
};
