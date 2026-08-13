import { FC, useEffect, useState } from 'react';

/**
 * Create-project modal (cs-project-dashboard FR-7.1–FR-7.7, FR-7.11–FR-7.14).
 *
 * The design contains no modal for this flow (Q-3), so the treatment follows the
 * existing v3 modals — `CreateStackModal` and `DestRegionLoginModal`.
 *
 * Every cancel path creates nothing (FR-7.11). That matters more here than the
 * wording suggests: v3 cannot delete a project, so anything created is permanent.
 */
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 255;

const NAME_TOO_LONG = `Project name must be ${NAME_MAX} characters or fewer`;
const NAME_LEADING_SPACE = 'Project name cannot start with a space';
const DESCRIPTION_TOO_LONG = `Description must be ${DESCRIPTION_MAX} characters or fewer`;

const CreateProjectModal: FC<{
  open: boolean;
  creating: boolean;
  error?: string;
  /**
   * Names already visible in the loaded project list, for the pre-submit clash hint
   * (cs-project-lifecycle FR-4.4). An affordance only — the server rule is the
   * contract (FR-3.7), so this never blocks a submission.
   */
  existingNames?: string[];
  onSubmit: (input: { name: string; description: string }) => void;
  onCancel: () => void;
}> = ({ open, creating, error, existingNames, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [attempted, setAttempted] = useState(false);

  // Reset only when the modal OPENS. Deliberately not keyed on `error`, so a
  // failed creation preserves what the user typed (FR-7.13, EC-5).
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setAttempted(false);
    }
  }, [open]);

  if (!open) return null;

  const nameTooLong = name.length > NAME_MAX;
  const nameLeadingSpace = name.length > 0 && name !== name.trimStart();
  const descriptionTooLong = description.length > DESCRIPTION_MAX;
  const nameMissing = name.trim().length === 0;

  const invalid = nameMissing || nameTooLong || nameLeadingSpace || descriptionTooLong;

  // Length problems surface immediately; the required-name message waits for an
  // attempt, so an untouched form is not shouting at the user.
  /*
    Pre-submit clash hint (FR-4.4). Uses the SAME comparison the server does — trimmed
    and case-folded, ends only — so the two cannot disagree: a hint that collapsed inner
    whitespace would warn about a name the server would happily accept.

    Deliberately NOT part of `invalid`, so it never blocks submission. The server rule is
    the contract (FR-3.7); this is an affordance, and a client-side gate would become a
    second, divergent rule the moment the list on screen went stale.
  */
  const normaliseName = (value: string) => value.trim().toLowerCase();
  const nameClashes =
    !!name.trim() &&
    (existingNames ?? []).some((existing) => normaliseName(existing) === normaliseName(name));

  const message =
    (nameTooLong && NAME_TOO_LONG) ||
    (nameLeadingSpace && NAME_LEADING_SPACE) ||
    (descriptionTooLong && DESCRIPTION_TOO_LONG) ||
    (attempted && nameMissing && 'Project name is required') ||
    (nameClashes && 'A project with that name already exists') ||
    error ||
    '';

  const submit = () => {
    setAttempted(true);
    if (invalid || creating) return;
    onSubmit({ name, description });
  };

  const field = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '10px 12px',
    fontSize: 13.5,
    fontFamily: 'inherit',
    color: 'var(--text-strong)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
  };
  const label = {
    display: 'block',
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--text-body)',
  };

  return (
    <div
      data-testid="create-project-overlay"
      // Clicking the overlay cancels; clicking inside the panel does not, which is
      // why the panel stops propagation rather than the overlay filtering targets.
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(15, 17, 26, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        data-testid="create-project-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Create a new project"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: 'var(--shadow-xl)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>
            New project
          </h2>
          <button
            type="button"
            data-testid="create-project-close"
            className="v3-modalclose"
            aria-label="Close"
            onClick={onCancel}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              lineHeight: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <label htmlFor="create-project-name" style={label}>
            Name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="create-project-name"
            data-testid="create-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. EU region migration"
            style={field}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label htmlFor="create-project-description" style={label}>
            Description
          </label>
          <textarea
            id="create-project-description"
            data-testid="create-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional"
            style={{ ...field, resize: 'vertical' }}
          />
        </div>

        {message && (
          <div
            role="alert"
            data-testid="create-project-error"
            style={{
              marginTop: 12,
              padding: '9px 12px',
              fontSize: 12.5,
              color: 'var(--danger)',
              background: 'var(--danger-surface)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {message}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            data-testid="create-project-cancel"
            onClick={onCancel}
            style={{
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-body)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="create-project-submit"
            disabled={invalid || creating}
            onClick={submit}
            style={{
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: invalid || creating ? 'var(--text-subtle)' : 'var(--text-on-brand)',
              background: invalid || creating ? 'var(--surface-sunken)' : 'var(--brand-strong)',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              cursor: invalid || creating ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
