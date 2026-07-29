import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import StatTiles from '../../../../../v3/components/source/StatTiles';

/**
 * TDD — v3 StatTiles component. Shared between the live (in-progress) count
 * display and the final persisted graph, so both read identically.
 */
describe('v3 StatTiles', () => {
  it('(positive) renders all five labels with their counts', () => {
    render(<StatTiles counts={{ contentTypes: 4, assets: 2, entries: 11, globalFields: 1, references: 3 }} />);
    expect(screen.getByText('Content types')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing/empty): missing keys render as 0, not blank/NaN.
  it('(negative) missing counts render as 0 rather than blank or NaN', () => {
    render(<StatTiles counts={{}} />);
    expect(screen.getAllByText('0')).toHaveLength(5);
  });

  it('(live, positive) live=true renders without crashing and still shows real counts', () => {
    render(<StatTiles counts={{ contentTypes: 2, assets: 0, entries: 0, globalFields: 0, references: 0 }} live />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
