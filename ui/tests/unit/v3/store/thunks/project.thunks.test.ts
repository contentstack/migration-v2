import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * TDD — v3 project and session thunks.
 *
 * Backs TC_PD_005 (the user's identity comes from a dedicated endpoint),
 * TC_PD_022 (the list request carries no organization parameter of any kind),
 * TC_PD_023 (one list request), TC_PD_073 (the create body carries only the name
 * and the description), TC_PD_074 (leftover wizard state is discarded before the
 * new project is reported), TC_PD_078 (a second submission cannot start a second
 * creation).
 *
 * feature.md FR-1.3, FR-3.1, FR-3.2, FR-7.8, FR-7.9, FR-7.12, FR-9.7, AC-4.6,
 * AC-4.7, AC-4.9, EC-13, EC-19, NFR-2. trd.md TR-6, TR-15, TR-16.
 *
 * Revised 2026-08-05: no organization anywhere. The pair that covered discarding a
 * response for an organization the user had switched away from is gone — with no
 * organization to switch there is no such race, and the guard was deleted rather
 * than kept as dead code.
 *
 * The API services are mocked at the boundary; the real store and reducers run, so
 * the single-flight guard is exercised through actual state.
 */
const { mockGetProjects, mockCreateProject, mockGetUser } = vi.hoisted(() => ({
  mockGetProjects: vi.fn(),
  mockCreateProject: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('../../../../../v3/services/api/project.service', () => ({
  projectApi: { getProjects: mockGetProjects, createProject: mockCreateProject },
}));
vi.mock('../../../../../v3/services/api/user.service', () => ({
  userApi: { getUser: mockGetUser },
}));

import { v3Store } from '../../../../../v3/store';
import { createProject, loadProjects } from '../../../../../v3/store/thunks/project.thunks';
import { loadUser } from '../../../../../v3/store/thunks/session.thunks';
import { sessionActions } from '../../../../../v3/store/slice/session.slice';
import { projectActions } from '../../../../../v3/store/slice/project.slice';

const project = (over: Record<string, unknown> = {}) => ({
  id: 'P1',
  name: 'Marketing stack sync',
  region: 'NA',
  owner: 'U1',
  isDeleted: false,
  created_at: 't',
  updated_at: 't',
  ...over,
});

beforeEach(() => {
  v3Store.dispatch(sessionActions.reset());
  v3Store.dispatch(projectActions.reset());
  mockGetProjects.mockReset().mockResolvedValue({ data: { projects: [] } });
  mockCreateProject.mockReset().mockResolvedValue({ data: { project: project({ id: 'P9' }) } });
  mockGetUser
    .mockReset()
    .mockResolvedValue({ data: { user: { firstName: 'Chirag', lastName: 'Nair' } } });
});

describe('v3 session thunks — user identity', () => {
  it('TC_PD_005 (positive): the user identity comes from the dedicated user endpoint', async () => {
    await v3Store.dispatch(loadUser() as never);

    expect(mockGetUser).toHaveBeenCalledOnce();
    expect(v3Store.getState().session.user).toMatchObject({
      firstName: 'Chirag',
      lastName: 'Nair',
    });
  });

  // Negative — taxonomy #6 (dependency failure): a failed user read leaves the
  // identity empty — so the avatar takes its icon fallback — and does NOT touch the
  // project list, because the two reads are independent (EC-19).
  it('TC_PD_005 (negative): a failed user read leaves the identity empty and the project list untouched', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('boom'));
    v3Store.dispatch(projectActions.listLoaded([project({ id: 'KEPT' })]));

    await v3Store.dispatch(loadUser() as never);

    expect(v3Store.getState().session.user).toEqual({});
    expect(v3Store.getState().session.userError).toBe('boom');
    expect(v3Store.getState().project.items.map((p) => p.id)).toEqual(['KEPT']);
  });
});

describe('v3 project thunks — loading the list', () => {
  it('TC_PD_022 (positive): the list request is issued with no arguments at all', async () => {
    await v3Store.dispatch(loadProjects() as never);

    expect(mockGetProjects).toHaveBeenCalledOnce();
    expect(mockGetProjects).toHaveBeenCalledWith();
  });

  // Negative — taxonomy #4 (forbidden state): no organization reaches the service
  // under any name. The scope is derived server-side from the token, so anything the
  // client sent would either be ignored or — worse — trusted (FR-3.1, FR-9.7).
  it('TC_PD_022 (negative): no organization value is passed to the service', async () => {
    await v3Store.dispatch(loadProjects() as never);

    const args = mockGetProjects.mock.calls[0] ?? [];
    expect(args).toHaveLength(0);
    expect(JSON.stringify(args)).not.toMatch(/org/i);
  });

  it('TC_PD_023 (positive): loading the list issues exactly one request', async () => {
    await v3Store.dispatch(loadProjects() as never);

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    expect(v3Store.getState().project.loading).toBe(false);
  });

  // Negative — taxonomy #6 (dependency failure): a failure records the error and
  // leaves the previously loaded items alone, so the page can render an error state
  // instead of an empty list (NFR-7).
  it('TC_PD_023 (negative): a failed request records the error without clearing the items', async () => {
    v3Store.dispatch(projectActions.listLoaded([project({ id: 'KEPT' })]));
    mockGetProjects.mockRejectedValueOnce({ response: { status: 500 } });

    await v3Store.dispatch(loadProjects() as never);

    expect(v3Store.getState().project.error).toBeTruthy();
    expect(v3Store.getState().project.items.map((p) => p.id)).toEqual(['KEPT']);
  });
});

describe('v3 project thunks — creating a project', () => {
  it('TC_PD_073 (positive): the create request body carries only the name and the description', async () => {
    await v3Store.dispatch(
      createProject({ name: 'EU region migration', description: '' }) as never
    );

    expect(mockCreateProject).toHaveBeenCalledWith({
      name: 'EU region migration',
      description: '',
    });
  });

  // Negative — taxonomy #4 (forbidden state): server-owned fields must never be
  // sent, even if a caller supplies them. Accepting an owner or region from the
  // client would let a caller create a project attributed to someone else; an
  // organization is not a project property at all (FR-7.8, FR-9.7).
  it('TC_PD_073 (negative): server-owned fields supplied by a caller are not sent', async () => {
    await v3Store.dispatch(
      createProject({
        name: 'EU region migration',
        description: '',
        id: 'FORGED',
        owner: 'U2',
        region: 'EU',
        orgId: 'O2',
      } as never) as never
    );

    const [body] = mockCreateProject.mock.calls[0];
    expect(Object.keys(body).sort()).toEqual(['description', 'name']);
  });

  it('TC_PD_074 (positive): a successful creation resets leftover wizard state before reporting the new project', async () => {
    // Leftover state from a previously open project.
    v3Store.dispatch(projectActions.listLoaded([project({ id: 'OLD' })]));

    const created = await v3Store.dispatch(
      createProject({ name: 'EU region migration', description: '' }) as never
    );

    expect(created).toMatchObject({ id: 'P9' });
    expect(v3Store.getState().destination.stackApiKey).toBe('');
    expect(v3Store.getState().source.projectId ?? '').toBe('');
  });

  // Negative — taxonomy #6 (dependency failure): a failed creation reports no
  // project and must NOT discard wizard state — resetting on failure would destroy
  // the state of whatever the user still has open.
  it('TC_PD_074 (negative): a failed creation reports no project and records the failure', async () => {
    mockCreateProject.mockRejectedValueOnce({ response: { data: { error: { message: 'Boom' } } } });

    const created = await v3Store.dispatch(
      createProject({ name: 'EU region migration', description: '' }) as never
    );

    expect(created).toBeNull();
    expect(v3Store.getState().project.createError).toBe('Boom');
  });

  it('TC_PD_078 (positive): a second submission while one is in flight issues exactly one request', async () => {
    let release: (v: unknown) => void = () => {};
    mockCreateProject.mockImplementationOnce(() => new Promise((res) => { release = res; }));

    const first = v3Store.dispatch(
      createProject({ name: 'EU region migration', description: '' }) as never
    );
    const second = v3Store.dispatch(
      createProject({ name: 'EU region migration', description: '' }) as never
    );

    expect(mockCreateProject).toHaveBeenCalledOnce();
    expect(await second).toBeNull();

    release({ data: { project: project({ id: 'P9' }) } });
    await first;
  });

  // Negative — taxonomy #4 (forbidden state): the guard clears once the first
  // creation settles, so it does not latch and block every later creation.
  it('TC_PD_078 (negative): the guard clears once the first creation settles', async () => {
    await v3Store.dispatch(createProject({ name: 'One', description: '' }) as never);
    await v3Store.dispatch(createProject({ name: 'Two', description: '' }) as never);

    expect(mockCreateProject).toHaveBeenCalledTimes(2);
  });
});
