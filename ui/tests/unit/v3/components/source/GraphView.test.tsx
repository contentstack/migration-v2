import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import GraphView from '../../../../../v3/components/source/GraphView';

/**
 * TDD — v3 GraphView component (FIRST `ui/` component test — new `.test.tsx`
 * pattern, flagged for ratification). Backs TC_SRC_052 (zoom controls expose
 * aria-labels — NFR-4) and TC_SRC_032 UI (stat tiles render the counts).
 */
const graph = {
  counts: { contentTypes: 2, assets: 0, entries: 0, globalFields: 0, references: 1 },
  nodes: [
    { uid: 'a', title: 'Alpha', tier: 1 },
    { uid: 'b', title: 'Beta', tier: 0 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

describe('v3 GraphView', () => {
  it('TC_SRC_032 (positive): stat tiles render the graph counts', () => {
    render(<GraphView graph={graph} />);
    expect(screen.getByText('Content types')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // content types count
    expect(screen.getByText('References')).toBeTruthy();
    // both listed content types render as nodes
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  // Negative — taxonomy #1 (empty/zero): a zero-count graph renders a valid zero-state (EC-7 UI).
  it('TC_SRC_032 (negative): a zero-count graph renders all five tiles at 0', () => {
    const zero = {
      counts: { contentTypes: 0, assets: 0, entries: 0, globalFields: 0, references: 0 },
      nodes: [],
      edges: [],
    };
    render(<GraphView graph={zero} />);
    expect(screen.getAllByText('0')).toHaveLength(5);
  });

  it('TC_SRC_052 (positive): zoom controls expose aria-labels', () => {
    render(<GraphView graph={graph} />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    expect(screen.getByLabelText('Reset view')).toBeTruthy();
  });

  // Negative — taxonomy #3 (boundary): controls exist even for an empty graph (not tied to node presence).
  it('TC_SRC_052 (negative): zoom controls still render for an empty graph', () => {
    const empty = {
      counts: { contentTypes: 0, assets: 0, entries: 0, globalFields: 0, references: 0 },
      nodes: [],
      edges: [],
    };
    render(<GraphView graph={empty} />);
    expect(screen.getByLabelText('Reset view')).toBeTruthy();
  });
});
