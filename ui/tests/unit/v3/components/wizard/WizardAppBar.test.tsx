import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * TDD — v3 WizardAppBar. Backs TC_MWC_001 (product identity), TC_MWC_002 /
 * TC_MWC_003 (step position), TC_MWC_004–007 (source indicator, its empty and
 * failure fallbacks, and long-name truncation).
 * feature.md FR-1.1–1.6, AC-1.1, AC-2.1–2.3, EC-1, EC-7, EC-8.
 */
import WizardAppBar from '../../../../../v3/components/wizard/WizardAppBar';
import { WIZARD_STEPS } from '../../../../../v3/components/wizard/steps';

const stepIndexOf = (id: string) => WIZARD_STEPS.findIndex((s) => s.id === id);

const renderBar = (props: Partial<React.ComponentProps<typeof WizardAppBar>> = {}) =>
  render(
    <WizardAppBar
      activeIndex={stepIndexOf('destination')}
      sourceName={undefined}
      {...props}
    />
  );

describe('v3 WizardAppBar — identity and step position', () => {
  it('TC_MWC_001 (positive): renders the product mark and the product title', () => {
    renderBar();
    expect(screen.getByText('Migrate to Contentstack')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-product-mark')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): the product title is fixed chrome, so it
  // must NOT change with the step — a step-dependent title would mean the app bar had
  // been wired to the wrong source.
  it('TC_MWC_001 (negative): the product title does not change with the step', () => {
    const { unmount } = renderBar({ activeIndex: stepIndexOf('source') });
    expect(screen.getByText('Migrate to Contentstack')).toBeInTheDocument();
    unmount();

    renderBar({ activeIndex: stepIndexOf('preview') });
    expect(screen.getByText('Migrate to Contentstack')).toBeInTheDocument();
  });

  it('TC_MWC_002 (positive): shows the 1-based position of the current step out of seven', () => {
    renderBar({ activeIndex: stepIndexOf('destination') });
    // The Destination step is index 3 of 7 (AC-1.1). Its app-bar title is still
    // undecided (feature.md Q-4), so only the position prefix is asserted.
    expect(screen.getByTestId('wizard-step-position')).toHaveTextContent('Step 3 of 7');
  });

  // Negative — taxonomy #3 (boundary): the first step must read "Step 1 of 7", not
  // "Step 0 of 7" — an off-by-one here is the single most likely defect in this label.
  it('TC_MWC_002 (negative): the first step reads "Step 1 of 7", never zero-indexed', () => {
    renderBar({ activeIndex: stepIndexOf('source') });
    const label = screen.getByTestId('wizard-step-position');
    expect(label).toHaveTextContent('Step 1 of 7');
    expect(label).not.toHaveTextContent('Step 0');
  });

  it('TC_MWC_003 (positive): the position label reflects the step it is given', () => {
    renderBar({ activeIndex: stepIndexOf('content-mapping') });
    expect(screen.getByTestId('wizard-step-position')).toHaveTextContent('Step 4 of 7');
  });

  it('TC_MWC_003 (negative): the last step reads "Step 7 of 7", not beyond the total', () => {
    renderBar({ activeIndex: stepIndexOf('verify') });
    const label = screen.getByTestId('wizard-step-position');
    expect(label).toHaveTextContent('Step 7 of 7');
    expect(label).not.toHaveTextContent('Step 8');
  });
});

describe('v3 WizardAppBar — source indicator', () => {
  it('TC_MWC_004 (positive): shows the persisted source stack name', () => {
    renderBar({ sourceName: 'marketing-prod' });
    expect(screen.getByTestId('wizard-source-indicator')).toHaveTextContent(
      'Source: marketing-prod (Contentstack)'
    );
  });

  // Negative — taxonomy #1 (missing input): with no persisted source the indicator
  // must read the defined placeholder, never a blank or a stray "(Contentstack)".
  it('TC_MWC_004 (negative): no persisted source shows the defined placeholder, not a blank name', () => {
    renderBar({ sourceName: undefined });
    const el = screen.getByTestId('wizard-source-indicator');
    expect(el).toHaveTextContent('Source: Not selected');
    expect(el).not.toHaveTextContent('(Contentstack)');
  });

  it('TC_MWC_005 (positive): renders "Source: Not selected" when nothing is persisted', () => {
    renderBar({ sourceName: undefined });
    expect(screen.getByTestId('wizard-source-indicator')).toHaveTextContent('Source: Not selected');
  });

  // Negative — taxonomy #1 (empty input): an empty-string name is not a name; it must
  // fall back to the placeholder rather than render "Source:  (Contentstack)".
  it('TC_MWC_005 (negative): an empty-string source name falls back to the placeholder', () => {
    renderBar({ sourceName: '' });
    expect(screen.getByTestId('wizard-source-indicator')).toHaveTextContent('Source: Not selected');
  });

  it('TC_MWC_006 (positive): a failed source read still renders the app bar, with the placeholder', () => {
    // The read failing is surfaced to this component as an absent name (EC-8).
    renderBar({ sourceName: undefined });
    expect(screen.getByText('Migrate to Contentstack')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-position')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-source-indicator')).toHaveTextContent('Source: Not selected');
  });

  // Negative — taxonomy #6 (dependency failure, contrast): when the read succeeds the
  // same app bar shows the real name, proving the fallback is the failure path and not
  // a permanently stuck placeholder.
  it('TC_MWC_006 (negative): a successful read shows the real name instead of the placeholder', () => {
    renderBar({ sourceName: 'marketing-prod' });
    const el = screen.getByTestId('wizard-source-indicator');
    expect(el).toHaveTextContent('marketing-prod');
    expect(el).not.toHaveTextContent('Not selected');
  });

  it('TC_MWC_007 (positive): a long source name is marked for single-line ellipsis truncation', () => {
    renderBar({ sourceName: 'a-really-long-destination-stack-name-that-will-not-fit-in-the-app-bar' });
    const name = screen.getByTestId('wizard-source-name');
    expect(name).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  });

  // Negative — taxonomy #4 (forbidden state): truncation must not be achieved by
  // cutting the string, which would put a lie in the DOM and break copy/paste — the
  // full name stays in the markup and CSS does the truncating.
  it('TC_MWC_007 (negative): the name is not truncated in the DOM, only visually', () => {
    const long = 'a-really-long-destination-stack-name-that-will-not-fit-in-the-app-bar';
    renderBar({ sourceName: long });
    expect(screen.getByTestId('wizard-source-name')).toHaveTextContent(long);
  });
});
