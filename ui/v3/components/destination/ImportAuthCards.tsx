import { FC } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { destinationActions, ImportAuthMethod } from '../../store/slice/destination.slice';

/**
 * Import-authentication method chooser (UC-3 / FR-3.1–3.6).
 *
 * Both cards are always visible and directly selectable — there is no separate
 * "Change" step. Management token reveals a required token-NAME field (the name
 * of the read/write token the system will create on Proceed, FR-3.3) plus the
 * dismissible apps-cannot-install warning; authToken reveals nothing.
 */
const METHODS: { id: ImportAuthMethod; label: string; desc: string }[] = [
  {
    id: 'management',
    label: 'Management token',
    desc: 'Stack-scoped token with an API key. Recommended for automated imports.',
  },
  {
    id: 'authToken',
    label: 'authToken',
    desc: 'User session token from a Contentstack login. Good for quick, one-off imports.',
  },
];

const ImportAuthCards: FC = () => {
  const dispatch = useV3Dispatch();
  const importAuth = useV3Selector((s) => s.destination.importAuth);
  const appsWarningDismissed = useV3Selector((s) => s.destination.appsWarningDismissed);

  const isMgmt = importAuth.method === 'management';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>
        Import authentication *
      </div>

      <div role="radiogroup" aria-label="Import authentication" style={{ display: 'flex', gap: 10 }}>
        {METHODS.map((m) => {
          const on = importAuth.method === m.id;
          const pick = () => dispatch(destinationActions.setImportMethod(m.id));
          return (
            <div
              key={m.id}
              className="v3-authcard"
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onClick={pick}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  pick();
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '12px 13px',
                border: `1px solid ${on ? 'var(--brand-strong)' : 'var(--border-default)'}`,
                background: on ? 'var(--brand-subtle)' : 'var(--surface-card)',
                borderRadius: 'var(--radius-lg)',
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span
                  style={{
                    width: 17,
                    height: 17,
                    flex: 'none',
                    borderRadius: '50%',
                    border: `1.5px solid ${on ? 'var(--brand-strong)' : 'var(--border-default)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on && (
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: 'var(--brand-strong)',
                        display: 'block',
                      }}
                    />
                  )}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>
                  {m.label}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {m.desc}
              </span>
            </div>
          );
        })}
      </div>

      {isMgmt && (
        <>
          <div>
            <label className="v3-label" htmlFor="v3-dest-mgmt-token-name">
              Management token name *
            </label>
            <input
              id="v3-dest-mgmt-token-name"
              aria-label="Management token name"
              className="v3-field"
              style={{ paddingRight: 12, backgroundImage: 'none' }}
              type="text"
              required
              spellCheck={false}
              placeholder="e.g. eu-marketing-import"
              value={importAuth.managementTokenName}
              onChange={(e) => dispatch(destinationActions.setManagementTokenName(e.target.value))}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 6 }}>
              Name of the management token configured on the destination stack.
            </div>
          </div>

          {!appsWarningDismissed && (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: 'var(--warning-surface)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
              }}
            >
              <span style={{ flex: 'none', color: 'var(--warning)', marginTop: 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4.5 2.8 20h18.4L12 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M12 10v4.5M12 17.2h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <div style={{ fontSize: 11.5, color: 'var(--text-body)', lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                <b style={{ color: 'var(--text-strong)' }}>Important:</b> a management token cannot
                install apps. Any app in this migration will be installed with your{' '}
                <b style={{ color: 'var(--text-strong)' }}>authToken</b> — you&rsquo;ll be asked to
                sign in before those steps run.
              </div>
              <button
                type="button"
                className="v3-iconbtn"
                aria-label="Dismiss"
                title="Dismiss"
                onClick={() => dispatch(destinationActions.dismissAppsWarning())}
                style={{
                  flex: 'none',
                  width: 20,
                  height: 20,
                  margin: '-1px -2px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImportAuthCards;
