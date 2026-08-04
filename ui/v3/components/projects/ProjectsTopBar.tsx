import { FC } from 'react';

import { avatarInitials } from '../../utils/avatar';

/**
 * Projects page top bar (cs-project-dashboard FR-1.1–FR-1.6).
 *
 * The design's bar carries an organization block here. Since a project is no
 * longer organization-specific (2026-08-05) there is nothing for that block to
 * show, so it is replaced by the product name — taken from the wizard chrome's app
 * bar rather than invented, so the two surfaces read as one product. This is a
 * drafted deviation from the design and is flagged as feature.md Q-16.
 *
 * Still deliberately NOT the wizard chrome's component: that bar carries a step
 * position and a source indicator, this one carries the avatar (FR-1.6).
 */
export interface TopBarUser {
  firstName?: string;
  lastName?: string;
  email?: string;
}

const ProjectsTopBar: FC<{ user?: TopBarUser }> = ({ user }) => {
  const initials = avatarInitials(user);

  return (
    <header
      data-testid="projects-topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          data-testid="projects-topbar-mark"
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(150deg, var(--violet-500), var(--violet-700))',
            boxShadow: 'var(--shadow-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flex: 'none',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </div>

        <span
          data-testid="projects-topbar-name"
          style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}
        >
          Migrate to Contentstack
        </span>
      </div>

      <div
        data-testid="projects-avatar"
        aria-label="Signed-in user"
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-page)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          flex: 'none',
        }}
      >
        {/* Never an empty circle: initials, or a person icon (FR-1.5). */}
        {initials ?? (
          <svg
            data-testid="projects-avatar-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </header>
  );
};

export default ProjectsTopBar;
