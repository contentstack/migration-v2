import { FC } from 'react';

/**
 * The projects grid's non-content states (cs-project-dashboard FR-8.1–FR-8.8).
 *
 * The design specifies only the search-empty state. The loading placeholders and
 * the first-run and error states are drafted here in the design's voice and are
 * flagged for sign-off (FR-8.9 / prd.md PQ-1) — the copy below is not settled
 * design.
 */

/**
 * Loading placeholders. Not buttons and hidden from assistive technology, so they
 * are unreachable by pointer AND by keyboard (FR-8.2). Sized to the real card's
 * footprint so the layout does not shift when content replaces them (FR-8.1).
 */
export const ProjectSkeletonGrid: FC<{ count?: number }> = ({ count = 8 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        data-testid="project-skeleton"
        aria-hidden="true"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '24px 24px 20px' }}>
          <div
            style={{
              height: 19,
              width: '70%',
              marginBottom: 22,
              borderRadius: 'var(--radius-xs, 4px)',
              background: 'var(--surface-sunken)',
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[0, 1].map((c) => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                <div style={{ height: 12.5, width: 62, borderRadius: 4, background: 'var(--surface-sunken)' }} />
                <div style={{ height: 34, width: 112, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ height: 14, width: 96, borderRadius: 4, background: 'var(--surface-sunken)' }} />
        </div>
      </div>
    ))}
  </>
);

/**
 * First run — the organization has no projects at all. This is the state every
 * new user meets first, and it carries the ONLY create affordance in that
 * condition (FR-8.3, FR-8.4, FR-2.6).
 */
export const FirstRunEmptyState: FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div
    data-testid="projects-empty-firstrun"
    style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}
  >
    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 6 }}>
      No projects yet
    </div>
    <div style={{ fontSize: 14, marginBottom: 20 }}>
      Create your first project to start a Contentstack to Contentstack migration.
    </div>
    <button
      type="button"
      data-testid="projects-empty-create"
      onClick={onCreate}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        height: 44,
        padding: '0 20px',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--brand-strong)',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-brand)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      New Project
    </button>
  </div>
);

/** A search matched nothing. Copy verbatim from the design (FR-8.5). */
export const SearchEmptyState: FC = () => (
  <div
    data-testid="projects-empty-search"
    style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}
  >
    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 6 }}>
      No projects match your search
    </div>
    <div style={{ fontSize: 14 }}>Try a different name or clear the search.</div>
  </div>
);

/**
 * The list failed to load. Rendered instead of — never as — an empty list, since
 * an empty grid would tell the user they have no projects (FR-8.7, NFR-8).
 */
export const ListErrorState: FC<{ message?: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div
    data-testid="projects-error"
    role="alert"
    style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}
  >
    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 6 }}>
      Couldn’t load your projects
    </div>
    <div style={{ fontSize: 14, marginBottom: 20 }}>{message || 'Something went wrong.'}</div>
    <button
      type="button"
      data-testid="projects-retry"
      onClick={onRetry}
      style={{
        height: 40,
        padding: '0 18px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-card)',
        color: 'var(--text-body)',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      Retry
    </button>
  </div>
);
