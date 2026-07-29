import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

  // Regression test for a real bug: the canvas calls setPointerCapture on
  // pointerdown for panning, which (in a real browser) retargets the click
  // event to the canvas instead of a nested button, silently breaking the
  // zoom controls. Fixed by stopping propagation on the button cluster's
  // pointerdown. jsdom's fireEvent.click bypasses real pointer-capture
  // retargeting, so this only guards the onClick wiring itself — not the
  // capture-retargeting behavior, which is real-browser-only.
  const getScale = (el: HTMLElement): number => {
    const m = el.style.transform.match(/scale\(([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  };

  it('(regression) clicking Zoom in/out/reset updates the canvas transform', () => {
    const { container } = render(<GraphView graph={graph} />);
    const canvas = container.querySelector('div[style*="translate"]') as HTMLElement;
    expect(getScale(canvas)).toBe(1);

    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(getScale(canvas)).toBeCloseTo(1.2);

    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(getScale(canvas)).toBeCloseTo(1.0);

    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Reset view'));
    expect(getScale(canvas)).toBe(1);
  });

  // Fullscreen toggle — bird's-eye view of the whole graph. GraphView itself
  // only owns the button + its own label/height reaction; SourcePanel owns
  // actually hiding the form column (covered in SourcePanel.test.tsx).
  it('(fullscreen, positive) renders an "Enter fullscreen" control that calls onToggleFullscreen', () => {
    const onToggle = vi.fn();
    render(<GraphView graph={graph} fullscreen={false} onToggleFullscreen={onToggle} />);
    fireEvent.click(screen.getByLabelText('Enter fullscreen'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // Negative — once fullscreen is active, the SAME control flips to an "Exit
  // fullscreen" label (not a second, separate button) and still wires to the callback.
  it('(fullscreen, negative) when fullscreen=true the control instead reads "Exit fullscreen"', () => {
    const onToggle = vi.fn();
    render(<GraphView graph={graph} fullscreen onToggleFullscreen={onToggle} />);
    expect(screen.queryByLabelText('Enter fullscreen')).toBeNull();
    fireEvent.click(screen.getByLabelText('Exit fullscreen'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('(fullscreen, positive) the canvas grows taller while fullscreen is active', () => {
    const { container, rerender } = render(<GraphView graph={graph} fullscreen={false} onToggleFullscreen={() => {}} />);
    const canvasNormal = container.querySelector('div[style*="touch-action"]') as HTMLElement;
    expect(canvasNormal.style.height).toBe('440px');

    rerender(<GraphView graph={graph} fullscreen onToggleFullscreen={() => {}} />);
    const canvasFull = container.querySelector('div[style*="touch-action"]') as HTMLElement;
    expect(canvasFull.style.height).not.toBe('440px');
  });

  // Regression: dragging to pan the canvas was also selecting the node
  // labels' text (browser default drag-select), which highlights every node
  // title blue mid-drag — bad UX. The canvas must opt out of text selection.
  it('(regression) the pannable canvas disables text selection so dragging never highlights node labels', () => {
    const { container } = render(<GraphView graph={graph} />);
    const canvas = container.querySelector('div[style*="touch-action"]') as HTMLElement;
    expect(canvas.style.userSelect).toBe('none');
  });

  // Regression: the "Reset view" icon's arc and arrowhead paths didn't
  // geometrically connect, rendering as a broken/garbled glyph instead of a
  // recognizable reset icon. Guard the known-correct path data.
  it('(regression) the Reset view icon uses the connected arc+arrowhead path (not a disjoint shape)', () => {
    render(<GraphView graph={graph} />);
    const btn = screen.getByLabelText('Reset view');
    const paths = [...btn.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(paths).toContain('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8');
    expect(paths).toContain('M3 3v5h5');
  });
});
