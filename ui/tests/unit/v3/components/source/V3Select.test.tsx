import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * TDD — v3 V3Select. A native `<select>`'s OPEN dropdown list is rendered by
 * the OS/browser chrome, not by our CSS — on macOS Chrome this shows the
 * OS's own (dark) popup background regardless of the app's light theme.
 * V3Select renders its own option list entirely in our DOM so it can be
 * themed like the rest of the app.
 */
import V3Select from '../../../../../v3/components/source/V3Select';

const OPTIONS = [
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
];

describe('v3 V3Select', () => {
  it('(positive) shows the placeholder when nothing is selected, and opens the option list on click', () => {
    render(<V3Select ariaLabel="Region" value="" placeholder="Select a region…" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText('Region')).toHaveTextContent('Select a region…');
    expect(screen.queryByRole('option', { name: 'Europe' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Region'));
    expect(screen.getByRole('option', { name: 'North America' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Europe' })).toBeInTheDocument();
  });

  // Negative — a selected value shows its label on the closed trigger, not the placeholder.
  it('(positive) shows the selected option label on the closed trigger', () => {
    render(<V3Select ariaLabel="Region" value="EU" placeholder="Select a region…" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText('Region')).toHaveTextContent('Europe');
  });

  it('(positive) clicking an option calls onChange with its value and closes the list', () => {
    const onChange = vi.fn();
    render(<V3Select ariaLabel="Region" value="" placeholder="Select a region…" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Region'));
    fireEvent.click(screen.getByRole('option', { name: 'Europe' }));

    expect(onChange).toHaveBeenCalledWith('EU');
    expect(screen.queryByRole('option', { name: 'Europe' })).toBeNull();
  });

  // Negative — a disabled select cannot be opened at all.
  it('(negative) a disabled select does not open on click', () => {
    render(<V3Select ariaLabel="Region" value="" placeholder="Select a region…" options={OPTIONS} onChange={() => {}} disabled />);
    expect(screen.getByLabelText('Region')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Region'));
    expect(screen.queryByRole('option', { name: 'Europe' })).toBeNull();
  });

  it('(positive) pressing Escape closes an open list', () => {
    render(<V3Select ariaLabel="Region" value="" placeholder="Select a region…" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText('Region'));
    expect(screen.getByRole('option', { name: 'Europe' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('option', { name: 'Europe' })).toBeNull();
  });

  // Negative — clicking somewhere outside the select also closes it.
  it('(negative) clicking outside the select closes an open list', () => {
    render(
      <div>
        <V3Select ariaLabel="Region" value="" placeholder="Select a region…" options={OPTIONS} onChange={() => {}} />
        <button type="button">elsewhere</button>
      </div>
    );
    fireEvent.click(screen.getByLabelText('Region'));
    expect(screen.getByRole('option', { name: 'Europe' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('option', { name: 'Europe' })).toBeNull();
  });
});

/**
 * Showing a stored value whose option list has not loaded — row TC_SRC_068.
 *
 * Added 2026-08-12. When a finished project is reopened, its saved selection is restored
 * as an ID before the org/stack lists arrive (or at all, if that fetch fails). With no
 * matching option the select used to fall through to its placeholder, so a disabled
 * control read "Select an organization…" — which states the opposite of the truth.
 */
describe('v3 V3Select — a value with no matching option', () => {
  it('TC_SRC_068 (positive): shows the raw value rather than the placeholder', () => {
    render(
      <V3Select
        ariaLabel="Stack"
        value="bltef5ad9f8875c3145"
        placeholder="Select a stack…"
        options={[]}
        onChange={() => {}}
      />
    );

    const btn = screen.getByRole('button', { name: 'Stack' });
    expect(btn).toHaveTextContent('bltef5ad9f8875c3145');
    expect(btn).not.toHaveTextContent('Select a stack…');
  });

  /*
    Negative — taxonomy #1 (missing input): with NO value the placeholder is still
    correct, because nothing has been chosen. Paired so the fallback cannot swallow the
    genuinely-empty case, which is what every fresh project starts in.
  */
  it('TC_SRC_068 (negative): still shows the placeholder when there is no value', () => {
    render(
      <V3Select
        ariaLabel="Stack"
        value=""
        placeholder="Select a stack…"
        options={[]}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Stack' })).toHaveTextContent('Select a stack…');
  });

  it('TC_SRC_069 (positive): prefers the option label once the list has loaded', () => {
    render(
      <V3Select
        ariaLabel="Stack"
        value="bltef5ad9f8875c3145"
        placeholder="Select a stack…"
        options={[{ value: 'bltef5ad9f8875c3145', label: 'Blog stack' }]}
        onChange={() => {}}
      />
    );

    const btn = screen.getByRole('button', { name: 'Stack' });
    expect(btn).toHaveTextContent('Blog stack');
    expect(btn).not.toHaveTextContent('bltef5ad9f8875c3145');
  });

  /*
    Negative — taxonomy #2 (invalid shape): a value matching NO option in a non-empty
    list still falls back to the id. This is the stale-list case — the saved stack is
    gone, or the operator lost access to it — and showing the placeholder there would
    imply the project has no source at all.
  */
  it('TC_SRC_069 (negative): falls back to the id when the loaded list does not contain it', () => {
    render(
      <V3Select
        ariaLabel="Stack"
        value="blt-missing"
        placeholder="Select a stack…"
        options={[{ value: 'blt-other', label: 'Some other stack' }]}
        onChange={() => {}}
      />
    );

    const btn = screen.getByRole('button', { name: 'Stack' });
    expect(btn).toHaveTextContent('blt-missing');
    expect(btn).not.toHaveTextContent('Select a stack…');
  });
});
