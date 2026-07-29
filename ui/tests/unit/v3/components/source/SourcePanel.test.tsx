import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  default: () => <div data-testid="graph-view" />,
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
});
