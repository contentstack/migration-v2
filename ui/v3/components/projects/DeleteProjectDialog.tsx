import { FC, useEffect, useRef } from 'react';

/**
 * Confirmation dialog for deleting a project (cs-project-lifecycle FR-2.2–FR-2.5,
 * NFR-3).
 *
 * No design exists for this dialog (feature.md Q-1), so its semantics and styling
 * follow the confirmation dialog already in `ContentMappingPanel` — same roles, same
 * focus handling, same card treatment, all on existing tokens. Nothing here introduces
 * a one-off value.
 *
 * The dialog is deliberately dumb: it reports intent and nothing else. The project id
 * is what it hands back, never the name — two projects can share a name (there are two
 * "Chirag Sample" records in the live store), so routing a destructive action by name
 * could delete the wrong one.
 */
/*
  Copied from `ContentMappingPanel`'s `dialogBackdrop` / `dialogCard` rather than
  approximated (feature.md Q-1: no design exists, so the existing dialog IS the
  specification). An earlier version of this file invented near-values — radius-lg
  instead of radius-xl, 20px/22px padding instead of 22px/24px, a maxWidth instead of
  the clamped width, plus a border the precedent does not have. Each would have read as
  "almost the same dialog", which is worse than either matching or deliberately
  differing.

  ⚠️ The backdrop colour is a literal because the design system has no overlay token —
  `theme.css` defines none, and the precedent hardcodes this same rgba. Flagged in the
  report rather than silently introducing a one-off token here.
*/
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(22,19,32,.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
};

const card: React.CSSProperties = {
  width: 'min(460px, calc(100vw - 32px))',
  background: 'var(--surface-card)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-lg)',
  padding: '22px 24px',
  /*
    No `outline: none`. This card is focused programmatically on open (tabIndex -1), so
    suppressing the outline would remove the only indication a keyboard user has that
    focus moved into the dialog — and NFR-3 requires a visible focus indicator. The
    precedent sets no outline property either; an earlier version of this file added one,
    which was both a divergence and an accessibility regression.
  */
};

const DeleteProjectDialog: FC<{
  project: { id: string; name: string };
  deleting: boolean;
  error?: string;
  onConfirm: (projectId: string) => void;
  onCancel: () => void;
}> = ({ project, deleting, error, onConfirm, onCancel }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  /** The element that had focus when the dialog opened, so it can be given back. */
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      // Focus returns where it came from rather than falling to the body, so a
      // keyboard user is not dropped at the top of the page (NFR-3).
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape cancels. It must never confirm — this dialog gates an irreversible
      // action, so the easy key is the safe one.
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div style={backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm delete project"
        ref={dialogRef}
        tabIndex={-1}
        style={card}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>
          Delete this project?
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.55, marginTop: 8 }}>
          <b style={{ color: 'var(--text-strong)' }}>{project.name}</b> and its exported content
          will be removed. This cannot be undone.
        </p>

        {error && (
          <p
            role="alert"
            data-testid="delete-project-error"
            style={{
              marginTop: 12,
              fontSize: 12.5,
              color: 'var(--danger)',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 9px',
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 18 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-card)',
              color: 'var(--text-body)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="delete-project-confirm"
            onClick={() => onConfirm(project.id)}
            /* Disabled while in flight so one confirmation cannot issue two deletions
               (FR-2.7). Re-enabled when the request settles, so a failure can be
               retried from the dialog it failed in. */
            disabled={deleting}
            /*
              The app's established danger treatment: `--danger` text on
              `--danger-surface` with a `--danger` border. Verified against every existing
              use in v3 — SourcePanel, ContentMappingPanel and CreateProjectModal all use
              this outlined form, and NOTHING in v3 uses a filled red button.

              An earlier version of this file used a solid `--danger` fill with literal
              white text. That invented a visual weight the product does not have anywhere
              else, and the literal duplicated the `--text-on-brand` token. Following the
              convention (feature.md Q-1) rather than inventing emphasis.
            */
            style={{
              fontSize: 13,
              fontWeight: 800,
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${deleting ? 'var(--border-subtle)' : 'var(--danger)'}`,
              background: deleting ? 'var(--surface-sunken)' : 'var(--danger-surface)',
              color: deleting ? 'var(--text-subtle)' : 'var(--danger)',
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectDialog;
