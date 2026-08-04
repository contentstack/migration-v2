/**
 * Derived project status (cs-project-dashboard trd.md TR-9, TC-1).
 *
 * Computed from the project's persisted documents on every render — never read
 * from a stored field. A derived value cannot go stale, which is the whole point:
 * v2 stores a status number and it drifts from reality whenever an update is
 * missed (FR-5.1).
 *
 * Pure: no store access, no network, no React.
 */
export type ProjectStatus = 'Draft' | 'In Progress' | 'Completed';

/** The subset of a project this derivation reads. */
export interface StatusInput {
  source?: unknown;
  destination?: unknown;
  /**
   * Server-owned migration record. No v3 feature writes this yet, which is why
   * `Completed` is currently unreachable — see FR-5.5. The branch exists now so
   * that adding a Migrate step changes the input, not this function.
   */
  migration?: { status?: string } | null;
}

export const deriveProjectStatus = (project: StatusInput | null | undefined): ProjectStatus => {
  if (!project) return 'Draft';

  if (project.migration?.status === 'succeeded') return 'Completed';

  const hasSource = !!project.source;
  const hasDestination = !!project.destination;
  if (hasSource || hasDestination) return 'In Progress';

  // Anything else — including a project whose documents are unreadable — reads
  // Draft rather than an empty badge (FR-5.6, EC-14).
  return 'Draft';
};
