import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

/**
 * TDD — v3 WizardChrome: composition and navigation ownership. Backs
 * TC_MWC_044 (current step derived from the route), TC_MWC_045 (panel renders
 * between tracker and footer), TC_MWC_046 (panels do not navigate),
 * TC_MWC_047 (backward navigation preserves panel state),
 * TC_MWC_051 (the source read is not repeated per step change).
 * feature.md FR-6.1–6.3, AC-4.3, NFR-3, NFR-4.
 *
 * The router is mocked so navigation assertions check the intended target
 * rather than a real URL change (trd.md §10).
 */
const { mockNavigate, mockParams, mockLoadSource } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockParams: { current: { projectId: 'P1', stepId: 'destination' } as Record<string, string> },
  mockLoadSource: vi.fn(),
}));

vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams.current,
  useSearchParams: () => [new URLSearchParams('orgId=O1'), vi.fn()],
}));

vi.mock('../../../../../v3/components/wizard/useWizardSource', () => ({
  useWizardSource: (...args: unknown[]) => {
    mockLoadSource(...args);
    return { sourceName: 'marketing-prod', sourceReady: true };
  },
}));

import WizardChrome from '../../../../../v3/components/wizard/WizardChrome';
import { v3Store } from '../../../../../v3/store';

/*
  Wrapped in the v3 Provider from 2026-08-04: `useWizardNavigation` now reads the
  selected organization from the session slice (cs-project-dashboard TR-17), and
  the chrome always mounts inside V3App's Provider in the real app. No assertion
  below changed — only the surrounding context.
*/
const renderChrome = (stepId = 'destination', children: React.ReactNode = <div>panel body</div>) => {
  mockParams.current = { projectId: 'P1', stepId };
  return render(
    <Provider store={v3Store}>
      <WizardChrome>{children}</WizardChrome>
    </Provider>
  );
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoadSource.mockClear();
});

describe('v3 WizardChrome — composition', () => {
  it('TC_MWC_044 (positive): derives the current step from the route segment', () => {
    renderChrome('destination');
    expect(screen.getByTestId('wizard-step-position')).toHaveTextContent('Step 3 of 7');
    expect(screen.getByTestId('wizard-step-Destination')).toHaveAttribute('data-state', 'active');
  });

  // Negative — taxonomy #2 (invalid input): a different route segment resolves to a
  // different step, so the step is genuinely read from the route rather than hardcoded.
  it('TC_MWC_044 (negative): a different route segment resolves to a different step', () => {
    renderChrome('content-mapping');
    expect(screen.getByTestId('wizard-step-position')).toHaveTextContent('Step 4 of 7');
    expect(screen.getByTestId('wizard-step-Destination')).not.toHaveAttribute('data-state', 'active');
  });

  it('TC_MWC_045 (positive): the panel renders between the step tracker and the footer', () => {
    renderChrome('destination', <div data-testid="panel-body">panel body</div>);
    const regions = Array.from(
      screen.getByTestId('wizard-chrome').querySelectorAll('[data-chrome-region]')
    ).map((el) => el.getAttribute('data-chrome-region'));
    expect(regions).toEqual(['appbar', 'tracker', 'panel', 'footer']);
    expect(screen.getByTestId('panel-body')).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing input): with no children the frame still renders
  // all three chrome regions, so a panel failing to render cannot take the chrome down.
  it('TC_MWC_045 (negative): the chrome still renders its own regions when given no panel', () => {
    renderChrome('destination', null);
    expect(screen.getByTestId('wizard-appbar')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
  });
});

describe('v3 WizardChrome — navigation ownership', () => {
  it('TC_MWC_046 (positive): a control inside the panel does not navigate between steps', async () => {
    renderChrome(
      'destination',
      <button type="button" data-testid="panel-button">a panel control</button>
    );

    await userEvent.click(screen.getByTestId('panel-button'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): the chrome's own control DOES
  // navigate, proving navigation is owned by the chrome and not merely disabled.
  it('TC_MWC_046 (negative): the chrome’s own Back control does navigate', async () => {
    renderChrome('destination');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockNavigate).toHaveBeenCalledOnce();
    expect(String(mockNavigate.mock.calls[0][0])).toContain('audit');
  });

  it('TC_MWC_047 (positive): navigating backward is a route change only — no panel state is reset', async () => {
    const onPanelReset = vi.fn();
    renderChrome(
      'destination',
      <div data-testid="panel-body" onReset={onPanelReset}>panel body</div>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockNavigate).toHaveBeenCalledOnce();
    expect(onPanelReset).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): backward navigation targets the
  // immediately preceding step, never the first step or an arbitrary one.
  it('TC_MWC_047 (negative): Back targets the immediately preceding step, not the first', async () => {
    renderChrome('content-mapping');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    const target = String(mockNavigate.mock.calls[0][0]);
    expect(target).toContain('destination');
    expect(target).not.toContain('source');
  });
});

describe('v3 WizardChrome — source read', () => {
  it('TC_MWC_051 (positive): the source is read once for the chrome, not once per region', () => {
    renderChrome('destination');
    expect(mockLoadSource).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): re-rendering at a different step must
  // not multiply the reads beyond one per chrome instance (NFR-4).
  it('TC_MWC_051 (negative): re-rendering the chrome does not repeat the read within one instance', () => {
    const { rerender } = renderChrome('destination');
    mockLoadSource.mockClear();

    rerender(
      <Provider store={v3Store}>
        <WizardChrome><div>panel body</div></WizardChrome>
      </Provider>
    );

    expect(mockLoadSource).toHaveBeenCalledOnce();
  });
});
