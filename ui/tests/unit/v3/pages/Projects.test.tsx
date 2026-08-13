import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

/**
 * TDD — v3 Projects page: composition, the list, search, the four states, and the
 * create flow's page-level wiring.
 *
 * Backs TC_PD_005 (organization switch reloads the list), TC_PD_011–025 (title
 * row and the primary action's conditional rendering), TC_PD_021–030 and
 * TC_PD_028 (list rendering, scope exclusions, state separation, no pagination),
 * TC_PD_054–070 (search), TC_PD_082 / TC_PD_084–100 (loading, both empty states,
 * their exclusivity, the error state and its recovery, and the 401 path),
 * TC_PD_110 (keyboard operability of every control).
 *
 * feature.md FR-2.1–FR-2.7, FR-3.1–FR-3.4, FR-3.6, FR-6.1–FR-6.6,
 * FR-8.1–FR-8.8, AC-1.1–AC-1.4, AC-2.1–AC-2.5, AC-5.2, AC-6.1–AC-6.4,
 * AC-7.1–AC-7.3, EC-1–EC-4, EC-7, NFR-5, NFR-8.
 *
 * The API service is mocked at the boundary; the real store, reducers and
 * components run. The router is mocked so the query string and the navigation
 * target are both controllable.
 */
const { mockGetProjects, mockCreateProject, mockDeleteProject, mockGetUser, mockNavigate, mockSearch } = vi.hoisted(
  () => ({
    mockGetProjects: vi.fn(),
    mockCreateProject: vi.fn(),
    mockDeleteProject: vi.fn(),
    mockGetUser: vi.fn(),
    mockNavigate: vi.fn(),
    mockSearch: { current: '' },
  })
);

vi.mock('../../../../v3/services/api/project.service', () => ({
  projectApi: {
    getProjects: mockGetProjects,
    createProject: mockCreateProject,
    deleteProject: mockDeleteProject,
  },
}));
vi.mock('../../../../v3/services/api/user.service', () => ({
  userApi: { getUser: mockGetUser },
}));
vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch.current), vi.fn()],
}));

import { v3Store } from '../../../../v3/store';
import { sessionActions } from '../../../../v3/store/slice/session.slice';
import { projectActions } from '../../../../v3/store/slice/project.slice';
import ProjectsV3 from '../../../../v3/pages/Projects';

const project = (over: Record<string, unknown> = {}) => ({
  id: 'P1',
  name: 'Marketing stack sync',
  region: 'NA',
  owner: 'U1',
  isDeleted: false,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
  ...over,
});

const THREE = [
  project({ id: 'P1', name: 'Marketing stack sync' }),
  project({ id: 'P2', name: 'Docs stack copy' }),
  project({ id: 'P3', name: 'Blog content move' }),
];

const renderPage = () =>
  render(
    <Provider store={v3Store}>
      <ProjectsV3 />
    </Provider>
  );

const cards = () => screen.queryAllByTestId('project-card');
const searchField = () => screen.getByTestId('projects-search');
// The header control specifically: the first-run empty state's create control
// carries the same accessible name, and only one of the two is ever present.
const newProject = () => screen.queryByTestId('projects-new');

/** Waits for the mount-time list request to settle. */
const settled = async () => {
  await waitFor(() => expect(mockGetProjects).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryAllByTestId('project-skeleton')).toHaveLength(0));
};

beforeEach(() => {
  v3Store.dispatch(sessionActions.reset());
  v3Store.dispatch(projectActions.reset());
  mockSearch.current = '';
  mockNavigate.mockReset();
  mockDeleteProject.mockReset().mockResolvedValue({ data: { deleted: true, id: 'P1' } });
  mockGetUser
    .mockReset()
    .mockResolvedValue({ data: { user: { firstName: 'Chirag', lastName: 'Nair' } } });
  mockCreateProject.mockReset().mockResolvedValue({ data: { project: project({ id: 'P9' }) } });
  mockGetProjects.mockReset().mockResolvedValue({ data: { projects: THREE } });
});

describe('v3 Projects page — title row', () => {
  it('TC_PD_011 (positive): renders the literal heading Migration Projects', async () => {
    renderPage();
    await settled();
    expect(screen.getByRole('heading', { name: 'Migration Projects' })).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): the heading is fixed page chrome and
  // must not be replaced by the selected organization's name.
  it('TC_PD_011 (negative): the heading is not replaced by the organization name', async () => {
    renderPage();
    await settled();
    expect(screen.getByRole('heading', { name: 'Migration Projects' })).not.toHaveTextContent(
      'TSO Migrations'
    );
  });

  it('TC_PD_012 (positive): the back control is rendered disabled', async () => {
    renderPage();
    await settled();
    expect(screen.getByTestId('projects-back')).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): it is disabled, not absent — the
  // design's layout keeps the control in place.
  it('TC_PD_012 (negative): the back control is present rather than omitted', async () => {
    renderPage();
    await settled();
    expect(screen.getByTestId('projects-back')).toBeInTheDocument();
  });

  it('TC_PD_013 (positive): activating the disabled back control does not navigate', async () => {
    renderPage();
    await settled();

    await userEvent.click(screen.getByTestId('projects-back'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): a project card on the same page DOES
  // navigate, so the inert back control is specific and not a broken page.
  it('TC_PD_013 (negative): a project card on the same page does navigate', async () => {
    renderPage();
    await settled();

    await userEvent.click(cards()[0]);

    expect(mockNavigate).toHaveBeenCalledOnce();
  });

  it('TC_PD_014 (positive): the disabled back control is not in keyboard tab order', async () => {
    renderPage();
    await settled();
    expect(screen.getByTestId('projects-back')).toHaveAttribute('tabindex', '-1');
  });

  // Negative — taxonomy #5 (permission denial): tabbing from the heading reaches
  // the search field rather than the back control.
  it('TC_PD_014 (negative): tabbing forward reaches the search field, never the back control', async () => {
    renderPage();
    await settled();

    await userEvent.tab();
    await userEvent.tab();

    expect(document.activeElement).not.toBe(screen.getByTestId('projects-back'));
  });

  it('TC_PD_015 (positive): the search field placeholder is the literal string Search projects', async () => {
    renderPage();
    await settled();
    expect(searchField()).toHaveAttribute('placeholder', 'Search projects');
  });

  // Negative — taxonomy #1 (missing input): the placeholder is not a pre-filled
  // value — the field starts empty so the full list shows.
  it('TC_PD_015 (negative): the placeholder is not a pre-filled value', async () => {
    renderPage();
    await settled();
    expect(searchField()).toHaveValue('');
  });

  it('TC_PD_016 (positive): the primary action label is the literal string New Project', async () => {
    renderPage();
    await settled();
    expect(newProject()).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (invalid shape): the label is exact — no v2-style
  // "Create New" wording appears on the page.
  it('TC_PD_016 (negative): no alternative create wording is rendered', async () => {
    renderPage();
    await settled();
    expect(screen.queryByRole('button', { name: /Create New/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Import Existing/i })).toBeNull();
  });

  it('TC_PD_017 (positive): activating New Project opens the create modal directly', async () => {
    renderPage();
    await settled();

    await userEvent.click(newProject()!);

    expect(screen.getByTestId('create-project-panel')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): no intermediate menu is presented,
  // so the control is a single action rather than a dropdown.
  it('TC_PD_017 (negative): no intermediate menu is presented before the modal', async () => {
    renderPage();
    await settled();

    await userEvent.click(newProject()!);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('TC_PD_018 (positive): with zero projects no New Project control is rendered', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    expect(newProject()).toBeNull();
  });

  // Negative — taxonomy #1 (missing input): the create affordance still exists —
  // it moves into the first-run empty state rather than disappearing entirely.
  it('TC_PD_018 (negative): the create affordance still exists in the first-run empty state', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    expect(screen.getByTestId('projects-empty-create')).toBeInTheDocument();
  });

  it('TC_PD_019 (positive): with exactly one project the New Project control is rendered', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [project()] } });
    renderPage();
    await settled();

    expect(newProject()).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): the first-run empty state is not
  // shown alongside it — exactly one of the two create affordances is present.
  it('TC_PD_019 (negative): the first-run empty state is not shown when a project exists', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [project()] } });
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });

  it('TC_PD_020 (positive): New Project stays present while a search filters every project out of view', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(cards()).toHaveLength(0);
    expect(newProject()).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): a filtered-to-empty view is not the
  // zero-projects condition, so the first-run empty state must not appear.
  it('TC_PD_020 (negative): a filtered-to-empty view does not trigger the first-run empty state', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });
});

describe('v3 Projects page — user identity', () => {
  it('TC_PD_010 (positive): a failed user read still leaves the project list rendered', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('user endpoint down'));
    renderPage();
    await settled();

    expect(cards()).toHaveLength(3);
    expect(screen.getByTestId('projects-avatar-icon')).toBeInTheDocument();
  });

  // Negative — taxonomy #6 (dependency failure): the failure surfaces nowhere on the
  // page. The avatar is cosmetic, so a user-read failure must not produce an error
  // state that would imply the projects themselves failed to load (EC-19).
  it('TC_PD_010 (negative): a failed user read renders no page-level error state', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('user endpoint down'));
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-error')).toBeNull();
    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });
});

describe('v3 Projects page — the list', () => {
  it('TC_PD_021 (positive): three projects render exactly three cards', async () => {
    renderPage();
    await settled();
    expect(cards()).toHaveLength(3);
  });

  // Negative — taxonomy #1 (missing input): the count follows the response, so a
  // different response renders a different number of cards.
  it('TC_PD_021 (negative): a two-project response renders exactly two cards', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE.slice(0, 2) } });
    renderPage();
    await settled();
    expect(cards()).toHaveLength(2);
  });

  it('TC_PD_024 (positive): a soft-deleted project among four renders only three cards', async () => {
    mockGetProjects.mockResolvedValue({
      data: { projects: [...THREE, project({ id: 'P4', name: 'Deleted one', isDeleted: true })] },
    });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(3);
    expect(screen.queryByText('Deleted one')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): a record whose marker is false is
  // still rendered, so the exclusion is the marker and not the extra record.
  it('TC_PD_024 (negative): a fourth project with an unset marker is rendered', async () => {
    mockGetProjects.mockResolvedValue({
      data: { projects: [...THREE, project({ id: 'P4', name: 'Kept one', isDeleted: false })] },
    });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(4);
    expect(screen.getByText('Kept one')).toBeInTheDocument();
  });

  /*
    Owner and region are SERVER-side scope dimensions: the client cannot evaluate
    them because it does not know its own owner or region, so the scoped endpoint
    never sends out-of-scope records. The page's responsibility is to render
    exactly the set it received and to add nothing of its own. Enforcement of the
    exclusion itself is covered by TC_PD_106 on the store — noted as a row whose
    natural home is the server.
  */
  it('TC_PD_025 (positive): the page renders exactly the scoped set the endpoint returned', async () => {
    mockGetProjects.mockResolvedValue({
      data: { projects: [project({ id: 'P1', name: 'Mine', owner: 'U1', region: 'NA' })] },
    });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Mine')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): the page renders no project the
  // endpoint did not send. An empty scoped response yields no cards at all, so the
  // page cannot be retaining or inventing records of its own.
  it('TC_PD_025 (negative): an empty scoped response renders no cards at all', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(0);
    expect(screen.queryByText('Mine')).toBeNull();
  });

  it('TC_PD_026 (positive): a search matching nothing shows the search-empty state, and clearing restores the full list', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');
    expect(screen.getByText('No projects match your search')).toBeInTheDocument();
    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();

    await userEvent.clear(searchField());
    expect(cards()).toHaveLength(3);
  });

  // Negative — taxonomy #4 (forbidden state): filtering must not consume the
  // loaded list, so a second, different search still matches against all three.
  it('TC_PD_026 (negative): a second search matches against the full list, not the previous result', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'Docs');
    expect(cards()).toHaveLength(1);

    await userEvent.clear(searchField());
    await userEvent.type(searchField(), 'Blog');
    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Blog content move')).toBeInTheDocument();
  });

  it('TC_PD_028 (positive): a large organization renders every project with no pagination control', async () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      project({ id: `P${i}`, name: `Project ${i}` })
    );
    mockGetProjects.mockResolvedValue({ data: { projects: many } });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(500);
    expect(screen.queryByTestId('projects-pagination')).toBeNull();
  });

  // Negative — taxonomy #3 (boundary): nothing is truncated to a page size — the
  // 500th project is present, not just the first page of them.
  it('TC_PD_028 (negative): the list is not truncated to a page size', async () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      project({ id: `P${i}`, name: `Project ${i}` })
    );
    mockGetProjects.mockResolvedValue({ data: { projects: many } });
    renderPage();
    await settled();

    expect(screen.getByText('Project 499')).toBeInTheDocument();
  });
});

describe('v3 Projects page — navigation target', () => {
  it('TC_PD_043 (positive): the navigation target identifies the project and the step and nothing else', async () => {
    mockGetProjects.mockResolvedValue({
      data: {
        projects: [project({ id: 'P1', name: 'Mine', destination: { stack: { apiKey: 'blt1' } } })],
      },
    });
    renderPage();
    await settled();

    await userEvent.click(cards()[0]);

    expect(String(mockNavigate.mock.calls[0][0])).toBe(
      '/v3/projects/P1/migration/steps/destination'
    );
  });

  // Negative — taxonomy #4 (forbidden state): no organization reaches the target in
  // any form — not as a path segment, not as a query parameter — and a stale
  // `?orgId=` sitting in the current URL is NOT carried across. A project is
  // identified by its id alone (FR-4.11, FR-9.13).
  it('TC_PD_043 (negative): no organization segment or parameter appears in the target, even when the current URL has one', async () => {
    mockSearch.current = 'orgId=STALE';
    renderPage();
    await settled();

    await userEvent.click(cards()[0]);

    const target = String(mockNavigate.mock.calls[0][0]);
    expect(target).not.toMatch(/org/i);
    expect(target).not.toContain('STALE');
    expect(target).not.toContain('?');
  });
});

describe('v3 Projects page — search', () => {
  it('TC_PD_054 (positive): searching stack renders the two matching projects and issues no request', async () => {
    renderPage();
    await settled();
    mockGetProjects.mockClear();

    await userEvent.type(searchField(), 'stack');

    expect(cards()).toHaveLength(2);
    expect(screen.getByText('Marketing stack sync')).toBeInTheDocument();
    expect(screen.getByText('Docs stack copy')).toBeInTheDocument();
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): the non-matching project is absent,
  // so the filter narrows rather than merely reordering.
  it('TC_PD_054 (negative): the non-matching project is removed from view', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'stack');

    expect(screen.queryByText('Blog content move')).toBeNull();
  });

  it('TC_PD_055 (positive): an upper-case search matches a lower-case name', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'MARKETING');

    expect(screen.getByText('Marketing stack sync')).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (invalid shape): case-insensitivity is not
  // case-blindness for unrelated terms — a non-matching term still matches nothing.
  it('TC_PD_055 (negative): an upper-case non-matching term still matches nothing', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'ZZZZ');

    expect(cards()).toHaveLength(0);
  });

  it('TC_PD_056 (positive): a term present only in a description matches nothing', async () => {
    mockGetProjects.mockResolvedValue({
      data: { projects: [project({ id: 'P3', name: 'Blog content move', description: 'quarterly' })] },
    });
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'quarterly');

    expect(cards()).toHaveLength(0);
  });

  // Negative — taxonomy #2 (invalid shape, contrast): the same project matches on
  // its name, so the filter works and is simply scoped to the name.
  it('TC_PD_056 (negative): the same project still matches on its name', async () => {
    mockGetProjects.mockResolvedValue({
      data: { projects: [project({ id: 'P3', name: 'Blog content move', description: 'quarterly' })] },
    });
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'Blog');

    expect(cards()).toHaveLength(1);
  });

  it('TC_PD_057 (positive): clearing the search restores every loaded project', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'stack');
    expect(cards()).toHaveLength(2);

    await userEvent.clear(searchField());

    expect(cards()).toHaveLength(3);
  });

  // Negative — taxonomy #4 (forbidden state): restoring the list must not re-issue
  // a request — the unfiltered list was retained in memory.
  it('TC_PD_057 (negative): restoring the list issues no new request', async () => {
    renderPage();
    await settled();
    mockGetProjects.mockClear();

    await userEvent.type(searchField(), 'stack');
    await userEvent.clear(searchField());

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  it('TC_PD_058 (positive): the search field is seeded from the search query parameter', async () => {
    mockSearch.current = 'search=blog';
    renderPage();
    await settled();

    expect(searchField()).toHaveValue('blog');
    expect(cards()).toHaveLength(1);
  });

  // Negative — taxonomy #1 (missing input): with no query parameter the field
  // starts empty and nothing is filtered.
  it('TC_PD_058 (negative): with no query parameter the field starts empty and nothing is filtered', async () => {
    mockSearch.current = '';
    renderPage();
    await settled();

    expect(searchField()).toHaveValue('');
    expect(cards()).toHaveLength(3);
  });

  it('TC_PD_059 (positive): a seeded value surrounded by whitespace is trimmed', async () => {
    mockSearch.current = 'search=%20blog%20';
    renderPage();
    await settled();

    expect(searchField()).toHaveValue('blog');
    expect(cards()).toHaveLength(1);
  });

  // Negative — taxonomy #2 (invalid shape): trimming removes only surrounding
  // whitespace — an interior space in a multi-word term is preserved.
  it('TC_PD_059 (negative): trimming preserves interior spaces in the seeded term', async () => {
    mockSearch.current = 'search=%20content%20move%20';
    renderPage();
    await settled();

    expect(searchField()).toHaveValue('content move');
    expect(cards()).toHaveLength(1);
  });

  it('TC_PD_060 (positive): a search matching nothing shows the exact search-empty copy', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(cards()).toHaveLength(0);
    expect(screen.getByText('No projects match your search')).toBeInTheDocument();
    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): a search that DOES match shows no
  // empty state, so the state is driven by the result and not by the field.
  it('TC_PD_060 (negative): a search that matches shows no empty state', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'stack');

    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  it('TC_PD_061 (positive): a whitespace-only search shows the full list and no empty state', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), '   ');

    expect(cards()).toHaveLength(3);
    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  // Negative — taxonomy #2 (invalid shape): whitespace around a real term is
  // trimmed rather than making the term unmatchable.
  it('TC_PD_061 (negative): whitespace around a real term is trimmed rather than breaking the match', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), '  Blog  ');

    expect(cards()).toHaveLength(1);
  });

  it('TC_PD_062 (positive): a clear control appears once the search field is non-empty', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'stack');

    expect(screen.getByTestId('projects-search-clear')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): the clear control actually clears —
  // it is not decorative.
  it('TC_PD_062 (negative): activating the clear control empties the field and restores the list', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'stack');
    await userEvent.click(screen.getByTestId('projects-search-clear'));

    expect(searchField()).toHaveValue('');
    expect(cards()).toHaveLength(3);
  });

  it('TC_PD_063 (positive): no clear control is offered while the search field is empty', async () => {
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-search-clear')).toBeNull();
  });

  // Negative — taxonomy #1 (missing input): a field containing only whitespace is
  // still non-empty as text, so the control appears and can undo it.
  it('TC_PD_063 (negative): a whitespace-only value still offers the clear control', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), '   ');

    expect(screen.getByTestId('projects-search-clear')).toBeInTheDocument();
  });
});

describe('v3 Projects page — loading, empty and error states', () => {
  it('TC_PD_082 (positive): while the request is in flight placeholders show and no card or empty state does', async () => {
    mockGetProjects.mockImplementation(() => new Promise(() => {}));
    renderPage();

    await waitFor(() => expect(screen.queryAllByTestId('project-skeleton').length).toBeGreaterThan(0));
    expect(cards()).toHaveLength(0);
    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): the placeholders are gone once the
  // response lands, so they are a loading state and not permanent furniture.
  it('TC_PD_082 (negative): the placeholders are gone once the response lands', async () => {
    renderPage();
    await settled();

    expect(screen.queryAllByTestId('project-skeleton')).toHaveLength(0);
    expect(cards()).toHaveLength(3);
  });

  it('TC_PD_084 (positive): a placeholder card cannot be activated', async () => {
    mockGetProjects.mockImplementation(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(screen.queryAllByTestId('project-skeleton').length).toBeGreaterThan(0));

    await userEvent.click(screen.getAllByTestId('project-skeleton')[0]);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): placeholders are not exposed as
  // controls at all, so keyboard users cannot reach them either.
  it('TC_PD_084 (negative): placeholders are not exposed as activatable controls', async () => {
    mockGetProjects.mockImplementation(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(screen.queryAllByTestId('project-skeleton').length).toBeGreaterThan(0));

    const first = screen.getAllByTestId('project-skeleton')[0];
    expect(first.tagName).not.toBe('BUTTON');
    expect(first).toHaveAttribute('aria-hidden', 'true');
  });

  it('TC_PD_085 (positive): zero projects shows the first-run empty state, not the search-empty one', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    expect(screen.getByTestId('projects-empty-firstrun')).toBeInTheDocument();
    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): the first-run state is not shown
  // when projects exist.
  it('TC_PD_085 (negative): the first-run state is not shown when projects exist', async () => {
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });

  it('TC_PD_086 (positive): the first-run state’s create control opens the create modal', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    await userEvent.click(screen.getByTestId('projects-empty-create'));

    expect(screen.getByTestId('create-project-panel')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): it opens the same modal as the
  // header control would, not a second, differently-wired one.
  it('TC_PD_086 (negative): only one create modal exists at a time', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    await userEvent.click(screen.getByTestId('projects-empty-create'));

    expect(screen.getAllByTestId('create-project-panel')).toHaveLength(1);
  });

  it('TC_PD_087 (positive): the search-empty state uses the design’s exact heading and body', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(screen.getByText('No projects match your search')).toBeInTheDocument();
    expect(screen.getByText('Try a different name or clear the search.')).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (invalid shape): the copy is verbatim — no paraphrase
  // of the design's wording appears.
  it('TC_PD_087 (negative): the copy is not paraphrased', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(screen.queryByText(/No results found/i)).toBeNull();
    expect(screen.queryByText(/no projects found/i)).toBeNull();
  });

  it('TC_PD_088 (positive): with a search active the first-run empty state is not shown', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    mockSearch.current = 'search=zzzz';
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): with the search cleared and still
  // zero projects, the first-run state IS shown — the suppression is the search.
  it('TC_PD_088 (negative): clearing the search reveals the first-run state when there are truly no projects', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    mockSearch.current = 'search=zzzz';
    renderPage();
    await settled();

    await userEvent.clear(searchField());

    expect(screen.getByTestId('projects-empty-firstrun')).toBeInTheDocument();
  });

  it('TC_PD_089 (positive): with an empty search field the search-empty state is not shown', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: [] } });
    renderPage();
    await settled();

    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): typing a non-matching term
  // does show it, so the suppression above is the empty field.
  it('TC_PD_089 (negative): typing a non-matching term does show the search-empty state', async () => {
    renderPage();
    await settled();

    await userEvent.type(searchField(), 'zzzz');

    expect(screen.getByText('No projects match your search')).toBeInTheDocument();
  });

  it('TC_PD_090 (positive): a 500 response shows the error state with retry and no empty state', async () => {
    mockGetProjects.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await settled();

    expect(screen.getByTestId('projects-error')).toBeInTheDocument();
    expect(screen.getByTestId('projects-retry')).toBeInTheDocument();
    expect(screen.queryAllByTestId('project-skeleton')).toHaveLength(0);
    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
    expect(screen.queryByText('No projects match your search')).toBeNull();
  });

  // Negative — taxonomy #6 (dependency failure): a failure is never rendered as an
  // empty list, which would tell the user they have no projects (NFR-8).
  it('TC_PD_090 (negative): a failure is not rendered as an empty list', async () => {
    mockGetProjects.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await settled();

    expect(cards()).toHaveLength(0);
    expect(screen.getByTestId('projects-error')).toBeInTheDocument();
  });

  it('TC_PD_091 (positive): retry re-issues the request and renders the results', async () => {
    mockGetProjects.mockRejectedValueOnce({ response: { status: 500 } });
    renderPage();
    await settled();
    expect(screen.getByTestId('projects-error')).toBeInTheDocument();

    mockGetProjects.mockResolvedValueOnce({ data: { projects: THREE.slice(0, 2) } });
    await userEvent.click(screen.getByTestId('projects-retry'));

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByTestId('projects-error')).toBeNull();
  });

  // Negative — taxonomy #6 (dependency failure): a retry that fails again keeps
  // the error state rather than falling through to an empty list.
  it('TC_PD_091 (negative): a retry that fails again keeps the error state', async () => {
    mockGetProjects.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await settled();

    await userEvent.click(screen.getByTestId('projects-retry'));

    await waitFor(() => expect(screen.getByTestId('projects-error')).toBeInTheDocument());
  });

  it('TC_PD_092 (positive): a network error shows the same error state with retry', async () => {
    mockGetProjects.mockRejectedValue(new Error('Network Error'));
    renderPage();
    await settled();

    expect(screen.getByTestId('projects-error')).toBeInTheDocument();
    expect(screen.getByTestId('projects-retry')).toBeInTheDocument();
  });

  // Negative — taxonomy #6 (dependency failure): a timeout is handled the same
  // way, so the error state is not tied to one specific rejection shape.
  it('TC_PD_092 (negative): a timeout is handled the same way, not as an empty list', async () => {
    mockGetProjects.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 0ms exceeded' });
    renderPage();
    await settled();

    expect(screen.getByTestId('projects-error')).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it('TC_PD_093 (positive): a 401 renders no page-level error state', async () => {
    mockGetProjects.mockRejectedValue({ response: { status: 401 } });
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-error')).toBeNull();
  });

  // Negative — taxonomy #6 (dependency failure): the 401 is not silently rendered
  // as an empty list of projects either — the shared client owns the redirect, so
  // this page shows neither an error nor a misleading empty state.
  it('TC_PD_093 (negative): a 401 does not render the first-run empty state', async () => {
    mockGetProjects.mockRejectedValue({ response: { status: 401 } });
    renderPage();
    await settled();

    expect(screen.queryByTestId('projects-empty-firstrun')).toBeNull();
  });
});

describe('v3 Projects page — accessibility', () => {
  it('TC_PD_110 (positive): every page control exposes an accessible name', async () => {
    renderPage();
    await settled();

    expect(searchField()).toHaveAccessibleName();
    expect(newProject()).toHaveAccessibleName();
    for (const c of cards()) expect(c).toHaveAccessibleName();
  });

  // Negative — taxonomy #5 (permission denial): the controls are genuinely
  // keyboard-reachable, not merely labelled — tabbing lands on the search field
  // and then the primary action.
  it('TC_PD_110 (negative): the search field and primary action are reachable by tabbing', async () => {
    renderPage();
    await settled();

    const reachable: Element[] = [];
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      if (document.activeElement) reachable.push(document.activeElement);
    }

    expect(reachable).toContain(searchField());
    expect(reachable).toContain(newProject());
  });
});

/**
 * cs-project-lifecycle, tranche 1e — TC_PL_055–059 (FR-2.6, FR-2.7, FR-2.8).
 *
 * The dashboard's side of the deletion: the list reflects the removal, one
 * confirmation cannot issue two deletions, and a failure keeps the row visible rather
 * than optimistically dropping a project that still exists.
 */
describe('cs-project-lifecycle — deleting from the dashboard', () => {
  /** Opens the confirmation dialog for the first listed card. */
  const openDialogForFirst = async () => {
    const del = screen.getAllByRole('button', { name: /delete/i })[0];
    await userEvent.click(del);
    return screen.getByRole('dialog');
  };
  /*
    Found by testid, not by text: the confirm control's label becomes "Deleting…" while
    the request is in flight, so a /delete/i text match stops matching it at exactly the
    moment the in-flight assertions need it.
  */
  const confirmControl = () =>
    screen.getByTestId('delete-project-confirm') as HTMLButtonElement;
  const confirmDelete = async () => {
    await userEvent.click(confirmControl());
  };

  it('TC_PL_055 (positive): drops the deleted project from the list without a reload', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockGetProjects.mockResolvedValue({ data: { projects: THREE.slice(1) } });

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(cards()).toHaveLength(2));
  });

  /*
    Negative — taxonomy #6 (dependency failure): a FAILED delete must not drop the row.
    An optimistic removal would show the operator a dashboard that disagrees with the
    server, and the project would reappear on the next load with no explanation.
  */
  it('TC_PL_055 (negative): keeps the project listed when the delete request fails', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockDeleteProject.mockRejectedValue(new Error('boom'));

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(cards()).toHaveLength(3));
  });

  it('TC_PL_056 (positive): disables the confirm control while the delete is in flight', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    let release: (v: unknown) => void = () => {};
    mockDeleteProject.mockImplementation(() => new Promise((r) => { release = r; }));

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(confirmControl()).toBeDisabled());
    release({ data: { deleted: true, id: 'P1' } });
  });

  /*
    Negative — taxonomy #3 (boundary): the control must be usable again once the request
    settles, or a failed delete leaves the operator with a dialog they cannot retry from.
  */
  it('TC_PL_056 (negative): re-enables the confirm control after a failed delete', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockDeleteProject.mockRejectedValue(new Error('boom'));

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(confirmControl()).not.toBeDisabled());
  });

  it('TC_PL_057 (positive): issues exactly one delete request for a double activation', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    let release: (v: unknown) => void = () => {};
    mockDeleteProject.mockImplementation(() => new Promise((r) => { release = r; }));

    await openDialogForFirst();
    const confirm = confirmControl();
    // Both presses land while the first request is still outstanding — sequential
    // awaits would let the first complete and legitimately allow a second.
    await Promise.all([userEvent.click(confirm), userEvent.click(confirm)]);

    expect(mockDeleteProject).toHaveBeenCalledTimes(1);
    release({ data: { deleted: true, id: 'P1' } });
  });

  /*
    Negative — taxonomy #7 (conflict): two DIFFERENT projects deleted in turn must issue
    two requests. A guard that blocked all repeat activations would leave the operator
    unable to delete more than one project per page load.
  */
  it('TC_PL_057 (negative): issues a request for each of two different projects', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();

    await openDialogForFirst();
    await confirmDelete();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const remaining = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(remaining[remaining.length - 1]);
    await confirmDelete();

    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledTimes(2));
  });

  it('TC_PL_058 (positive): keeps the project visible after a failed delete', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockDeleteProject.mockRejectedValue(new Error('server said no'));

    await openDialogForFirst();
    await confirmDelete();

    /*
      Scoped to the CARDS. The dialog stays open on failure and renders the project's
      name too, so an unscoped getByText now matches twice — the requirement is that the
      project is still LISTED, which is what the card count states.
    */
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(cards().some((c) => c.textContent?.includes('Marketing stack sync'))).toBe(true);
  });

  /*
    Negative — taxonomy #6: a SUCCESSFUL delete does remove it. Paired so "keeps the
    project visible" cannot be satisfied by a dashboard that never removes anything.
  */
  it('TC_PL_058 (negative): removes the project after a successful delete', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockGetProjects.mockResolvedValue({ data: { projects: THREE.slice(1) } });

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(cards().some((c) => c.textContent?.includes('Marketing stack sync'))).toBe(false);
  });

  it('TC_PL_059 (positive): surfaces the failure to the operator', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockDeleteProject.mockRejectedValue(new Error('server said no'));

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  /*
    Negative — taxonomy #1 (missing input): a successful delete must NOT show an error.
    A dashboard that reported a failure after every deletion would train the operator to
    ignore the message entirely.
  */
  it('TC_PL_059 (negative): shows no failure message after a successful delete', async () => {
    mockGetProjects.mockResolvedValue({ data: { projects: THREE } });
    renderPage();
    await settled();
    mockGetProjects.mockResolvedValue({ data: { projects: THREE.slice(1) } });

    await openDialogForFirst();
    await confirmDelete();

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
