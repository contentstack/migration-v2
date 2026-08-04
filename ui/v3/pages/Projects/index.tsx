import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { V3_BASE } from '../../constants';
import CreateProjectModal from '../../components/projects/CreateProjectModal';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectsTopBar from '../../components/projects/ProjectsTopBar';
import {
  FirstRunEmptyState,
  ListErrorState,
  ProjectSkeletonGrid,
  SearchEmptyState,
} from '../../components/projects/ProjectGridStates';
import { WIZARD_STEPS } from '../../components/wizard/steps';
import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { filterProjects, projectActions } from '../../store/slice/project.slice';
import { createProject, loadProjects } from '../../store/thunks/project.thunks';
import { loadUser } from '../../store/thunks/session.thunks';

/**
 * v3 Projects page (cs-project-dashboard).
 *
 * Lists the selected organization's projects, searches them client-side, opens one
 * at the furthest step it reached, and creates new ones. Replaces the placeholder
 * that previously linked to a hard-coded demo project id.
 *
 * This page is also what ends the wizard's dependency on a hand-typed `?orgId=`:
 * the organization it selects goes into the session slice, which the wizard reads
 * (trd.md TR-7, TR-17).
 */
const ProjectsV3: FC = () => {
  const dispatch = useV3Dispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const user = useV3Selector((s) => s.session.user);
  const { items, loading, error, creating, createError, unauthorized } = useV3Selector(
    (s) => s.project
  );

  // Seeded from the URL and trimmed, so returning from a project restores the
  // search the user left behind (FR-6.3).
  const [search, setSearch] = useState(() => (params.get('search') ?? '').trim());
  const [modalOpen, setModalOpen] = useState(false);

  // Fixed for the lifetime of one page view so every card formats its date against
  // the same instant — two cards rendered a tick apart must not disagree about
  // where the 7-day boundary falls.
  const now = useMemo(() => new Date(), []);

  /*
    Both reads fire once, on mount, and in parallel. The user read is only for the
    avatar, so a slow or failed one must not delay or break the list (EC-19). The
    empty dependency array is what makes FR-3.2 / NFR-2 hold: re-rendering for any
    reason cannot re-issue either request.
  */
  useEffect(() => {
    dispatch(loadUser());
    dispatch(loadProjects());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    Soft-deleted records are excluded server-side (FR-9.6); filtering again here is
    defence in depth, so a server-side regression cannot surface a deleted project
    as a clickable card. Owner and region cannot be checked client-side — the
    client does not know its own — so those remain purely a server property.
  */
  const live = useMemo(() => items.filter((p) => p.isDeleted !== true), [items]);
  const visible = useMemo(() => filterProjects(live, search), [live, search]);

  const searching = search.trim().length > 0;
  const hasProjects = live.length > 0;
  const failed = !!error;

  const openProject = (projectId: string, stepSegment: string) => {
    navigate(`${V3_BASE}/projects/${projectId}/migration/steps/${stepSegment}`);
  };

  const submitCreate = async (input: { name: string; description: string }) => {
    const created = await dispatch(createProject(input));
    if (!created) return; // The modal stays open and shows the failure (FR-7.13).
    setModalOpen(false);
    // A brand-new project has nothing persisted, so it opens at the first step.
    openProject(created.id, WIZARD_STEPS[0].routeSegment);
  };

  const closeModal = () => {
    setModalOpen(false);
    dispatch(projectActions.createReset());
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-page)' }}>
      <ProjectsTopBar user={user} />

      <main style={{ maxWidth: 1660, margin: '0 auto', padding: '34px 40px 60px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            paddingBottom: 26,
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 34,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 0 }}>
            {/*
              Rendered disabled and out of tab order. The design's back control
              points at a "Choose Migration Path" page that does not exist in this
              app; keeping it inert preserves the design's layout without shipping
              a control that goes somewhere wrong (FR-2.2).
            */}
            <button
              type="button"
              data-testid="projects-back"
              aria-label="Back to migration paths"
              disabled
              tabIndex={-1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                flex: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface-card)',
                color: 'var(--text-body)',
                cursor: 'not-allowed',
                opacity: 0.5,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5m0 0 6-6m-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-.025em',
                margin: 0,
                color: 'var(--text-strong)',
                whiteSpace: 'nowrap',
              }}
            >
              Migration Projects
            </h1>

            <div style={{ position: 'relative', flex: 1, maxWidth: 640 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-subtle)',
                }}
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.9" />
                <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
              <input
                data-testid="projects-search"
                aria-label="Search projects"
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 52,
                  padding: search ? '0 44px 0 46px' : '0 16px 0 46px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-card)',
                  fontFamily: 'inherit',
                  fontSize: 15,
                  color: 'var(--text-strong)',
                  outline: 'none',
                }}
              />
              {/* Offered only while the field has a value (FR-6.5). */}
              {search.length > 0 && (
                <button
                  type="button"
                  data-testid="projects-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    lineHeight: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/*
            Hidden when the loaded list is empty, so the first-run empty state's own
            control is the single create affordance in that condition (FR-2.6,
            FR-2.7). A search that filters everything out of view is NOT that
            condition — the control stays.
          */}
          {hasProjects && (
            <button
              type="button"
              data-testid="projects-new"
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                height: 52,
                padding: '0 22px',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--brand-strong)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-brand)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              New Project
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 26,
          }}
        >
          {loading && <ProjectSkeletonGrid />}

          {!loading && failed && (
            <ListErrorState
              message={error}
              onRetry={() => dispatch(loadProjects())}
            />
          )}

          {!loading &&
            !failed &&
            visible.map((p) => <ProjectCard key={p.id} project={p} now={now} onOpen={openProject} />)}

          {/*
            Exactly one empty state can show, and the choice is made here in one
            place rather than as independent conditions per state (FR-8.6).
          */}
          {!loading && !failed && !unauthorized && visible.length === 0 && searching && (
            <SearchEmptyState />
          )}
          {!loading && !failed && !unauthorized && visible.length === 0 && !searching && (
            <FirstRunEmptyState onCreate={() => setModalOpen(true)} />
          )}
        </div>
      </main>

      <CreateProjectModal
        open={modalOpen}
        creating={creating}
        error={createError}
        onSubmit={submitCreate}
        onCancel={closeModal}
      />
    </div>
  );
};

export default ProjectsV3;
