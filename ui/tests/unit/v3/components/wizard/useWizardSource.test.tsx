import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FC } from 'react';

/**
 * The chrome's view of persisted state — and the bug it had.
 *
 * Reported: after a successful export, moving to the Audit step left the Source step
 * WITHOUT its green tick. A page refresh made the tick appear.
 *
 * The tick is derived from the server, which is right:
 *
 *     sourceReady: src.lastExport?.status === 'succeeded' || !!src.graph
 *
 * …but the effect depended on `[projectId]` alone, so it read once and never again. The
 * export then changed the server state and nothing re-read it. Refreshing remounted the
 * hook, which is why refreshing "fixed" it.
 *
 * The fix is to re-read when the STEP changes as well. That keeps the chrome's single
 * source of truth — the persisted documents — rather than mixing in in-memory slice state,
 * which would give completion two definitions that could disagree.
 */
const { mockApi } = vi.hoisted(() => ({
  mockApi: { getSource: vi.fn(), getDestination: vi.fn() },
}));
vi.mock('../../../../../v3/services/api/wizard.service', () => ({ wizardApi: mockApi }));

import { useWizardSource } from '../../../../../v3/components/wizard/useWizardSource';

/** Renders the hook's result so each field is observable. */
const Harness: FC<{ projectId: string; activeIndex: number }> = ({ projectId, activeIndex }) => {
  const { sourceReady, sourceName, destinationPersisted } = useWizardSource(projectId, activeIndex);
  return (
    <div>
      <span data-testid="ready">{String(sourceReady)}</span>
      <span data-testid="name">{sourceName ?? '—'}</span>
      <span data-testid="dest">{String(destinationPersisted)}</span>
    </div>
  );
};

const ready = () => screen.getByTestId('ready').textContent;

beforeEach(() => {
  mockApi.getSource.mockReset();
  mockApi.getDestination.mockReset();
  mockApi.getDestination.mockRejectedValue(Object.assign(new Error('none'), { status: 404 }));
});

describe('v3 useWizardSource — the chrome re-reads when the step changes', () => {
  it('picks up an export that succeeded since the last read', async () => {
    // First read: nothing exported yet. Second: the export has succeeded.
    mockApi.getSource
      .mockResolvedValueOnce({ data: { source: { stack: { stackApiKey: 'blt1' } } } })
      .mockResolvedValueOnce({
        data: { source: { stack: { stackApiKey: 'blt1' }, lastExport: { status: 'succeeded' } } },
      });

    const view = render(<Harness projectId="P1" activeIndex={0} />);
    await waitFor(() => expect(ready()).toBe('false'));

    // Proceeding to the audit step is the navigation the operator actually makes.
    view.rerender(<Harness projectId="P1" activeIndex={1} />);

    await waitFor(() => expect(ready()).toBe('true'));
  });

  /*
    Negative — taxonomy #4 (forbidden state): an unrelated re-render must NOT re-read. The
    hook sets state on every read, so a dependency that changes each render would loop
    forever — a fix worse than the bug.
  */
  it('does not re-read when neither the project nor the step changed', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: { stack: { stackApiKey: 'blt1' } } } });

    const view = render(<Harness projectId="P1" activeIndex={0} />);
    await waitFor(() => expect(mockApi.getSource).toHaveBeenCalledTimes(1));

    view.rerender(<Harness projectId="P1" activeIndex={0} />);
    view.rerender(<Harness projectId="P1" activeIndex={0} />);

    expect(mockApi.getSource).toHaveBeenCalledTimes(1);
  });

  it('re-reads when the project changes', async () => {
    mockApi.getSource
      .mockResolvedValueOnce({ data: { source: { stack: { stackApiKey: 'blt1' } } } })
      .mockResolvedValueOnce({ data: { source: { graph: { counts: {} } } } });

    const view = render(<Harness projectId="P1" activeIndex={0} />);
    await waitFor(() => expect(ready()).toBe('false'));

    view.rerender(<Harness projectId="P2" activeIndex={0} />);

    await waitFor(() => expect(ready()).toBe('true'));
  });

  /*
    Negative — taxonomy #1 (missing input): no project id means no read at all. A route in
    transition must not fire a request against an undefined project.
  */
  it('reads nothing when there is no project id', () => {
    render(<Harness projectId="" activeIndex={0} />);

    expect(mockApi.getSource).not.toHaveBeenCalled();
  });

  it('treats a persisted graph as a ready source even with no export record', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: { graph: { counts: { contentTypes: 3 } } } } });

    render(<Harness projectId="P1" activeIndex={0} />);

    await waitFor(() => expect(ready()).toBe('true'));
  });

  /*
    Negative — taxonomy #6 (dependency failure): a 404 is the normal first visit, not an
    error. The step must read incomplete and the app bar fall back, rather than the chrome
    surfacing a fault (feature.md EC-8).
  */
  it('reports an incomplete step when no source is persisted', async () => {
    mockApi.getSource.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));

    render(<Harness projectId="P1" activeIndex={0} />);

    await waitFor(() => expect(ready()).toBe('false'));
    expect(screen.getByTestId('name').textContent).toBe('—');
  });

  it('reports a failed export as an incomplete source step', async () => {
    mockApi.getSource.mockResolvedValue({
      data: { source: { stack: { stackApiKey: 'blt1' }, lastExport: { status: 'failed' } } },
    });

    render(<Harness projectId="P1" activeIndex={0} />);

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('blt1'));
    expect(ready()).toBe('false');
  });
});
