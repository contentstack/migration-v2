import { FC, useEffect, useRef } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { destinationActions } from '../../store/slice/destination.slice';
import { cancelDestRegionLogin, submitDestRegionLogin } from '../../store/thunks/destination.thunks';

/**
 * Destination region re-authentication modal (UC-2 / FR-2.1–2.4).
 *
 * Opens whenever the user picks a destination Region they are not already
 * authenticated against, and performs a real Contentstack login for it.
 * Cancelling — via the close control or the overlay — reverts the Region field
 * to its previous value and changes no session (AC-2.3).
 */
const DestRegionLoginModal: FC = () => {
  const dispatch = useV3Dispatch();
  const rl = useV3Selector((s) => s.destination.regionLogin);
  const regions = useV3Selector((s) => s.destination.regions);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rl.open) emailRef.current?.focus();
  }, [rl.open]);

  if (!rl.open) return null;

  const regionLabel = regions.find((r) => r.value === rl.region)?.label ?? rl.region;
  const canSubmit = !!rl.email.trim() && !!rl.password.trim() && !rl.loading;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) dispatch(submitDestRegionLogin());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to continue"
      onClick={(e) => {
        if (e.target === e.currentTarget) dispatch(cancelDestRegionLogin());
      }}
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
          maxWidth: 390,
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
          aria-label="Close"
          onClick={() => dispatch(cancelDestRegionLogin())}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="v3-eyebrow-lg" style={{ marginBottom: 4 }}>
          Authentication
        </div>
        <h3 style={{ fontSize: 'var(--text-h4)', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-strong)' }}>
          Sign in to continue
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
          Switching to <b style={{ color: 'var(--text-body)' }}>{regionLabel}</b> requires you to
          authenticate against that region.
        </p>

        <form onSubmit={onSubmit}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginBottom: rl.error ? 10 : 18,
            }}
          >
            <div>
              <label className="v3-label" htmlFor="v3-dest-region-email">
                Email
              </label>
              <input
                ref={emailRef}
                id="v3-dest-region-email"
                aria-label="Email"
                className="v3-field"
                style={{ paddingRight: 12, backgroundImage: 'none' }}
                type="text"
                placeholder="you@company.com"
                autoComplete="off"
                value={rl.email}
                onChange={(e) =>
                  dispatch(destinationActions.setRegionLoginField({ field: 'email', value: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="v3-label" htmlFor="v3-dest-region-password">
                Password
              </label>
              <input
                id="v3-dest-region-password"
                aria-label="Password"
                className="v3-field"
                style={{ paddingRight: 12, backgroundImage: 'none' }}
                type="password"
                placeholder="••••••••"
                autoComplete="off"
                value={rl.password}
                onChange={(e) =>
                  dispatch(
                    destinationActions.setRegionLoginField({ field: 'password', value: e.target.value })
                  )
                }
              />
            </div>
          </div>

          {rl.error && (
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
              {rl.error}
            </div>
          )}

          <button type="submit" className="v3-btn" disabled={!canSubmit} style={{ width: '100%' }}>
            {rl.loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DestRegionLoginModal;
