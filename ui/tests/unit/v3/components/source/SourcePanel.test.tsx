import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 SourcePanel component. Backs TC_SRC_001 (default mode = stack),
 * TC_SRC_003 (segmented toggle switches the panel), TC_SRC_004 (header + status
 * badge), TC_SRC_031 (graph empty-state / rendered when present; also TC_SRC_037
 * restore). Child panels mocked to markers so this isolates SourcePanel.
 */
vi.mock('../../../../../v3/components/source/StackPanel', () => ({
  default: () => <div data-testid="stack-panel" />,
}));
vi.mock('../../../../../v3/components/source/FilePanel', () => ({
  default: () => <div data-testid="file-panel" />,
}));
vi.mock('../../../../../v3/components/source/GraphView', () => ({
  default: ({ fullscreen, onToggleFullscreen }: any) => (
    <div data-testid="graph-view">
      <button onClick={onToggleFullscreen}>{fullscreen ? 'exit-fs' : 'enter-fs'}</button>
    </div>
  ),
}));
// Inert the restore-on-mount thunk so tests don't hit the network.
vi.mock('../../../../../v3/store/thunks/source.thunks', () => ({
  loadPersistedGraph: () => () => {},
}));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';
import SourcePanel from '../../../../../v3/components/source/SourcePanel';

const EMPTY = /Relationship between content types will be shown here once the export completes\./i;

const renderPanel = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { source: sourceReducer } });
  setup?.(store);
  return render(
    <Provider store={store}>
      <SourcePanel projectId="P1" />
    </Provider>
  );
};

const graphState = (store: any) =>
  store.dispatch(sourceActions.setGraph({ counts: { contentTypes: 1 }, nodes: [], edges: [] }));

describe('v3 SourcePanel', () => {
  it('TC_SRC_001 (positive): defaults to the stack panel', () => {
    renderPanel();
    expect(screen.getByTestId('stack-panel')).toBeInTheDocument();
  });

  // Negative — the file panel is not shown by default.
  it('TC_SRC_001 (negative): the file panel is not shown by default', () => {
    renderPanel();
    expect(screen.queryByTestId('file-panel')).toBeNull();
  });

  it('TC_SRC_003 (positive): switching to "From a file" renders the file panel', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'From a file' }));
    expect(screen.getByTestId('file-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('stack-panel')).toBeNull();
  });

  // Negative — switching back to "From a stack" restores the stack panel.
  it('TC_SRC_003 (negative): switching back restores the stack panel', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'From a file' }));
    fireEvent.click(screen.getByRole('button', { name: 'From a stack' }));
    expect(screen.getByTestId('stack-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('file-panel')).toBeNull();
  });

  it('TC_SRC_004 (positive): shows the Source header and an initial "Not started" badge', () => {
    renderPanel();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText(/Not started/i)).toBeInTheDocument();
  });

  // Negative — once a graph exists the badge reflects "Ready".
  it('TC_SRC_004 (negative): the badge reads "Ready" once a graph is present', () => {
    renderPanel((store) => graphState(store));
    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
  });

  it('TC_SRC_031 (positive): shows the graph empty-state text before any export completes', () => {
    renderPanel();
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByTestId('graph-view')).toBeNull();
  });

  // Negative — with a graph present, the visualizer renders and the empty state is gone.
  it('TC_SRC_031 (negative): renders the graph visualizer when a graph is present', () => {
    renderPanel((store) => graphState(store));
    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('TC_SRC_029 (positive): an upload size-limit error is surfaced in the panel', () => {
    renderPanel((store) => store.dispatch(sourceActions.setError('File exceeds the 100 MB limit.')));
    expect(screen.getByText(/exceeds the 100 MB limit/i)).toBeInTheDocument();
  });

  // Negative — no error text when there is no error.
  it('TC_SRC_029 (negative): no error text is shown when there is no error', () => {
    renderPanel();
    expect(screen.queryByText(/exceeds the 100 MB limit/i)).toBeNull();
  });

  it('(live tiles, positive) shows live-updating stat tiles while running, using jobLiveCounts', () => {
    renderPanel((store) => {
      store.dispatch(sourceActions.setRunning(true));
      store.dispatch(
        sourceActions.setJobLiveCounts({ contentTypes: 3, assets: 1, entries: 7, globalFields: 0, references: 0 })
      );
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-view')).toBeNull();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  // Negative — once the final graph exists, the live tiles are gone and the real graph shows instead.
  it('(live tiles, negative) the live tiles disappear once the final graph is set', () => {
    renderPanel((store) => {
      store.dispatch(sourceActions.setRunning(true));
      store.dispatch(sourceActions.setJobLiveCounts({ contentTypes: 3, assets: 1, entries: 7, globalFields: 0, references: 0 }));
      store.dispatch(sourceActions.setRunning(false));
      graphState(store);
    });
    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
    expect(screen.queryByText('Reading source…')).toBeNull();
  });

  // These mount first, then dispatch — unlike renderPanel() above, which
  // dispatches BEFORE mount — so the false→true / undefined→defined
  // transitions this feature depends on actually happen during the component's
  // lifecycle, matching real usage.
  const mountLive = () => {
    const store = configureStore({ reducer: { source: sourceReducer } });
    render(
      <Provider store={store}>
        <SourcePanel projectId="P1" />
      </Provider>
    );
    return store;
  };

  it('(scroll, positive) starting an export scrolls the activity log into view', () => {
    const store = mountLive();
    const scrollMock = vi.mocked(Element.prototype.scrollIntoView);
    scrollMock.mockClear();

    act(() => {
      store.dispatch(sourceActions.setRunning(true));
    });

    expect(scrollMock).toHaveBeenCalled();
  });

  // Negative — mounting fresh with nothing running triggers no auto-scroll at all.
  it('(scroll, negative) mounting fresh with nothing running does not scroll anywhere', () => {
    const scrollMock = vi.mocked(Element.prototype.scrollIntoView);
    scrollMock.mockClear();
    mountLive();
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('(scroll, positive) finishing an export that was started this session scrolls to the content graph', () => {
    const store = mountLive();
    const scrollMock = vi.mocked(Element.prototype.scrollIntoView);

    act(() => {
      store.dispatch(sourceActions.setRunning(true)); // scrolls to logs
    });
    scrollMock.mockClear();
    act(() => {
      store.dispatch(sourceActions.setRunning(false));
      graphState(store); // job completes -> should scroll to the graph
    });

    expect(scrollMock).toHaveBeenCalledTimes(1);
  });

  // Negative — a graph appearing WITHOUT an export having been started this
  // session (e.g. restoring a persisted graph) must NOT trigger an auto-scroll;
  // only a graph that follows an active run should move the viewport.
  it('(scroll, negative) a graph appearing without an export started this session does not auto-scroll', () => {
    const store = mountLive();
    const scrollMock = vi.mocked(Element.prototype.scrollIntoView);
    scrollMock.mockClear();

    act(() => {
      graphState(store);
    });

    expect(scrollMock).not.toHaveBeenCalled();
  });

  // Fullscreen graph: clicking the toggle must hide the configuration column
  // (segmented toggle + Stack/File panel) and give the graph the full width.
  it('(fullscreen, positive) toggling fullscreen on the graph hides the source configuration column', () => {
    renderPanel((store) => graphState(store));
    expect(screen.getByTestId('stack-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('enter-fs'));

    expect(screen.queryByTestId('stack-panel')).toBeNull();
    expect(screen.getByText('exit-fs')).toBeInTheDocument();
  });

  // Negative — toggling back out of fullscreen restores the configuration column.
  it('(fullscreen, negative) toggling fullscreen off again restores the configuration column', () => {
    renderPanel((store) => graphState(store));
    fireEvent.click(screen.getByText('enter-fs'));
    fireEvent.click(screen.getByText('exit-fs'));

    expect(screen.getByTestId('stack-panel')).toBeInTheDocument();
    expect(screen.getByText('enter-fs')).toBeInTheDocument();
  });

  // Starting a fresh export while a stale graph's fullscreen view is still
  // open must not leave the user stuck viewing outdated data full-screen.
  it('(fullscreen, positive) starting a new export exits fullscreen automatically', () => {
    const store = mountLive();
    act(() => {
      graphState(store);
    });
    fireEvent.click(screen.getByText('enter-fs'));
    expect(screen.queryByTestId('stack-panel')).toBeNull();

    act(() => {
      store.dispatch(sourceActions.setRunning(true));
    });

    expect(screen.getByTestId('stack-panel')).toBeInTheDocument();
  });
});
