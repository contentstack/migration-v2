import { FC, useEffect, useRef } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { destinationActions } from '../../store/slice/destination.slice';
import { createDestStack } from '../../store/thunks/destination.thunks';

/**
 * "Create a new stack" modal (UC-7 / FR-1.4–1.6).
 *
 * Creating a stack is the one genuinely irreversible action on this panel — it
 * makes a real stack in the customer's Contentstack organization (prd.md PR-4) —
 * so Cancel and the close control both create nothing and discard the draft.
 * A name that already exists is surfaced as an error with the modal left open
 * for correction (EC-3), never auto-suffixed.
 */
const CreateStackModal: FC = () => {
  const dispatch = useV3Dispatch();
  const cs = useV3Selector((s) => s.destination.createStack);
  const orgs = useV3Selector((s) => s.destination.orgs);
  const org = useV3Selector((s) => s.destination.org);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cs.open) nameRef.current?.focus();
  }, [cs.open]);

  if (!cs.open) return null;

  const orgLabel = orgs.find((o) => o.value === org)?.label ?? org;
  const canCreate = !!cs.name.trim() && !cs.loading;
  const cancel = () => dispatch(destinationActions.cancelCreateStack());

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canCreate) dispatch(createDestStack());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create a new stack"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(12,13,23,.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: 26,
          position: 'relative',
        }}
      >
        <button
          type="button"
          className="v3-modalclose"
          aria-label="Close"
          onClick={cancel}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="v3-eyebrow-lg" style={{ marginBottom: 4 }}>
          Destination
        </div>
        <h3 style={{ fontSize: 'var(--text-h4)', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-strong)' }}>
          Create a new stack
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
          The stack is created in <b style={{ color: 'var(--text-body)' }}>{orgLabel}</b> and
          selected as your destination.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label className="v3-label" htmlFor="v3-new-stack-name">
                Stack name *
              </label>
              <input
                ref={nameRef}
                id="v3-new-stack-name"
                aria-label="Stack name"
                className="v3-field"
                style={{ paddingRight: 12, backgroundImage: 'none' }}
                type="text"
                required
                spellCheck={false}
                placeholder="production-eu-marketing-site"
                value={cs.name}
                onChange={(e) =>
                  dispatch(destinationActions.setCreateStackField({ field: 'name', value: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="v3-label" htmlFor="v3-new-stack-desc">
                Stack description
              </label>
              <textarea
                id="v3-new-stack-desc"
                aria-label="Stack description"
                rows={3}
                placeholder="What this stack is for (optional)"
                value={cs.description}
                onChange={(e) =>
                  dispatch(
                    destinationActions.setCreateStackField({ field: 'description', value: e.target.value })
                  )
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-strong)',
                  padding: '9px 12px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-card)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {cs.error && (
            <div
              role="alert"
              style={{
                marginBottom: 14,
                fontSize: 12.5,
                color: 'var(--danger)',
                background: 'var(--danger-surface)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 11px',
              }}
            >
              {cs.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="v3-btn v3-btn--secondary"
              onClick={cancel}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button type="submit" className="v3-btn" disabled={!canCreate} style={{ flex: 1 }}>
              {cs.loading ? 'Creating…' : 'Create stack'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStackModal;
