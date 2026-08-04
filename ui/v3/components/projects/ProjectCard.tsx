import { FC } from 'react';

import { deriveProjectStatus, ProjectStatus } from '../../utils/projectStatus';
import { deriveResumeStep } from '../../utils/resumeStep';
import { formatLastModified } from '../../utils/relativeDate';
import type { ProjectRecord } from '../../store/slice/project.slice';

/**
 * One project card (cs-project-dashboard FR-4.1–FR-4.12, FR-5.1–FR-5.6).
 *
 * The whole card is a single `<button>` with no nested controls, so there is
 * exactly one activation target and no sub-region can intercept a click (FR-4.7).
 * Both the status badge and the step the card opens are DERIVED per render from
 * the project's persisted documents — neither is read from a stored field, so
 * neither can go stale (TC-1).
 */
const BADGES: Record<ProjectStatus, { icon: string; color: string; surface: string }> = {
  Draft: { icon: 'dashed-circle', color: 'var(--text-muted)', surface: 'var(--surface-sunken)' },
  'In Progress': { icon: 'warning-triangle', color: 'var(--warning)', surface: 'var(--warning-surface)' },
  Completed: { icon: 'check-circle', color: 'var(--success)', surface: 'var(--success-surface)' },
};

const BadgeIcon: FC<{ kind: string }> = ({ kind }) => {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none' } as const;
  if (kind === 'check-circle') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="m8.5 12 2.3 2.3L15.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'warning-triangle') {
    return (
      <svg {...common}>
        <path d="M12 3 2.5 20h19L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" strokeDasharray="2.6 2.8" />
    </svg>
  );
};

const ProjectCard: FC<{
  project: ProjectRecord;
  /** Passed in so the rendered date is deterministic (TR-11). */
  now: Date | number;
  onOpen: (projectId: string, stepSegment: string) => void;
}> = ({ project, now, onOpen }) => {
  const status = deriveProjectStatus(project);
  const badge = BADGES[status];

  const open = () => {
    // A project with no usable id cannot be opened (FR-4.10).
    if (!project?.id) return;
    onOpen(project.id, deriveResumeStep(project));
  };

  return (
    <button
      type="button"
      data-testid="project-card"
      aria-label={`Open project ${project.name}`}
      onClick={open}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans, inherit)',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 0,
        overflow: 'hidden',
        transition: 'border-color .15s, box-shadow .15s, transform .15s',
      }}
    >
      <div style={{ padding: '24px 24px 20px', width: '100%' }}>
        <h2
          data-testid="project-card-name"
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: '-.01em',
            margin: '0 0 22px',
            color: 'var(--text-strong)',
            textAlign: 'left',
            // Visual truncation only — the full name stays in the document so it
            // remains selectable and copyable (FR-4.2, EC-12).
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div
            data-testid="project-card-source"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Source</span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--text-body)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
              }}
            >
              {/* Fixed for this feature: every v3 project is Contentstack → Contentstack (FR-4.3). */}
              Contentstack
            </span>
          </div>

          <div
            data-testid="project-card-status"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
              Project Status
            </span>
            <span
              data-testid="project-card-status-value"
              data-status={status}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13.5,
                fontWeight: 700,
                color: badge.color,
                background: badge.surface,
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                data-testid="project-card-status-icon"
                data-icon={badge.icon}
                aria-hidden="true"
                style={{ display: 'inline-flex' }}
              >
                <BadgeIcon kind={badge.icon} />
              </span>
              {/* Text is the primary signal, not colour (NFR-6). */}
              {status}
            </span>
          </div>
        </div>
      </div>

      <div
        data-testid="project-card-footer"
        style={{
          width: '100%',
          borderTop: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 9,
          color: 'var(--text-muted)',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span data-testid="project-card-clock" aria-hidden="true" style={{ display: 'inline-flex' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 8v4l2.5 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span data-testid="project-card-date">
          {/* Last modified, not created (FR-4.5, FR-4.6). */}
          {formatLastModified(project.updated_at, now)}
        </span>
      </div>
    </button>
  );
};

export default ProjectCard;
