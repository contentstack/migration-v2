import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * TDD — v3 ProjectsTopBar: the product mark, the product name and the user avatar.
 *
 * Backs TC_PD_001 (layout, and the absence of an organization block), TC_PD_002
 * (the product name), TC_PD_003 (this is not the wizard chrome's app bar),
 * TC_PD_004 and TC_PD_006–009 (the avatar and its four-rung fallback).
 *
 * feature.md FR-1.1, FR-1.2, FR-1.4–FR-1.6, EC-16, EC-17, EC-18.
 *
 * Revised 2026-08-05: the organization block and its switcher are gone, so the
 * seven cases covering them are gone with them. What replaces the block is the
 * product name, which is a drafted deviation from the design (Q-16) — the design
 * has no version of this bar without an organization.
 */
import ProjectsTopBar from '../../../../../v3/components/projects/ProjectsTopBar';

const renderBar = (over: Record<string, unknown> = {}) =>
  render(
    <ProjectsTopBar
      user={{ firstName: 'Chirag', lastName: 'Nair', email: 'chirag.chavan@example.com' }}
      {...(over as never)}
    />
  );

const avatar = () => screen.getByTestId('projects-avatar');

describe('v3 ProjectsTopBar — layout', () => {
  it('TC_PD_001 (positive): renders a product mark, the product name and a user avatar', () => {
    renderBar();
    expect(screen.getByTestId('projects-topbar-mark')).toBeInTheDocument();
    expect(screen.getByTestId('projects-topbar-name')).toBeInTheDocument();
    expect(avatar()).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): no organization block or control
  // survives anywhere in the bar. A project is not organization-specific, so a
  // control implying otherwise would be actively misleading (FR-1.1).
  it('TC_PD_001 (negative): no organization block or switcher is rendered', () => {
    renderBar();
    expect(screen.queryByTestId('projects-org-block')).toBeNull();
    expect(screen.queryByTestId('projects-org-trigger')).toBeNull();
    expect(screen.queryByTestId('projects-org-list')).toBeNull();
    expect(screen.queryByText('Organization')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('TC_PD_002 (positive): the product name reads the literal string Migrate to Contentstack', () => {
    renderBar();
    expect(screen.getByTestId('projects-topbar-name')).toHaveTextContent('Migrate to Contentstack');
  });

  // Negative — taxonomy #1 (missing input): the product name is fixed chrome, so it
  // does not vary with the signed-in user.
  it('TC_PD_002 (negative): the product name does not vary with the user', () => {
    const { unmount } = renderBar({ user: { firstName: 'Chirag', lastName: 'Nair' } });
    expect(screen.getByTestId('projects-topbar-name')).toHaveTextContent('Migrate to Contentstack');
    unmount();

    renderBar({ user: {} });
    expect(screen.getByTestId('projects-topbar-name')).toHaveTextContent('Migrate to Contentstack');
  });

  it('TC_PD_003 (positive): this bar carries an avatar and no wizard step indicators', () => {
    renderBar();
    expect(avatar()).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-step-position')).toBeNull();
    expect(screen.queryByTestId('wizard-source-indicator')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): it renders no wizard step tracker or
  // app bar either — the two bars serve different pages even though they now show
  // the same product name (FR-1.6).
  it('TC_PD_003 (negative): this bar renders no wizard tracker or app bar', () => {
    renderBar();
    expect(screen.queryByTestId('wizard-tracker')).toBeNull();
    expect(screen.queryByTestId('wizard-appbar')).toBeNull();
  });
});

describe('v3 ProjectsTopBar — avatar', () => {
  it('TC_PD_004 (positive): both names present renders two uppercase initials', () => {
    renderBar({ user: { firstName: 'Chirag', lastName: 'Nair' } });
    expect(avatar()).toHaveTextContent('CN');
  });

  // Negative — taxonomy #2 (invalid shape): lower-case input is uppercased, so the
  // initials are not passed through verbatim.
  it('TC_PD_004 (negative): lower-case names are uppercased rather than passed through', () => {
    renderBar({ user: { firstName: 'chirag', lastName: 'nair' } });
    const el = avatar();
    expect(el).toHaveTextContent('CN');
    expect(el).not.toHaveTextContent('cn');
  });

  it('TC_PD_006 (positive): a first name with no last name renders its first two characters uppercased', () => {
    renderBar({ user: { firstName: 'Chirag' } });
    expect(avatar()).toHaveTextContent('CH');
  });

  // Negative — taxonomy #1 (missing input): a single initial is not the defined
  // fallback — the rung is two characters of the one available name.
  it('TC_PD_006 (negative): a first name with no last name does not fall back to one initial', () => {
    renderBar({ user: { firstName: 'Chirag' } });
    expect(avatar().textContent?.trim()).toHaveLength(2);
  });

  it('TC_PD_007 (positive): no names but an email renders the first character of the local part', () => {
    renderBar({ user: { email: 'chirag.chavan@example.com' } });
    expect(avatar()).toHaveTextContent('C');
  });

  // Negative — taxonomy #2 (invalid shape): the domain is not part of the local
  // part, so a leading character from the domain must never be used.
  it('TC_PD_007 (negative): the email fallback ignores the domain', () => {
    renderBar({ user: { email: 'zeta@alpha.com' } });
    const el = avatar();
    expect(el).toHaveTextContent('Z');
    expect(el).not.toHaveTextContent('A');
  });

  it('TC_PD_008 (positive): no name and no email renders a person icon', () => {
    renderBar({ user: {} });
    expect(screen.getByTestId('projects-avatar-icon')).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing input): the icon rung is the last resort — it
  // must not appear when an email is available to derive a character from.
  it('TC_PD_008 (negative): the person icon is not used when an email is available', () => {
    renderBar({ user: { email: 'chirag.chavan@example.com' } });
    expect(screen.queryByTestId('projects-avatar-icon')).toBeNull();
  });

  it('TC_PD_009 (positive): the avatar is never empty in any of the four identity conditions', () => {
    const conditions = [
      { firstName: 'Chirag', lastName: 'Nair' },
      { firstName: 'Chirag' },
      { email: 'chirag.chavan@example.com' },
      {},
    ];

    for (const user of conditions) {
      const { unmount } = renderBar({ user });
      const el = avatar();
      const hasText = (el.textContent ?? '').trim().length > 0;
      const hasIcon = el.querySelector('[data-testid="projects-avatar-icon"]') !== null;
      expect(hasText || hasIcon).toBe(true);
      unmount();
    }
  });

  // Negative — taxonomy #1 (missing input): an entirely absent user object is also
  // covered — it must not produce an empty circle either (FR-1.5). This is the
  // state the page is in while the user read is still in flight, or after it
  // failed (EC-19).
  it('TC_PD_009 (negative): an absent user object still renders the icon rather than an empty circle', () => {
    renderBar({ user: undefined });

    const el = avatar();
    const hasText = (el.textContent ?? '').trim().length > 0;
    const hasIcon = el.querySelector('[data-testid="projects-avatar-icon"]') !== null;
    expect(hasText || hasIcon).toBe(true);
  });
});
