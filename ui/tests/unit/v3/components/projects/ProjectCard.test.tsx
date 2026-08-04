import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * TDD — v3 ProjectCard.
 *
 * Backs TC_PD_029–048 and TC_PD_044–052 (card content, the two date forms,
 * truncation, single-control activation, the derived resume step, the empty-id
 * guard, keyboard activation, output encoding) and TC_PD_046–057, TC_PD_052–060
 * (the derived status badge, its icon, its fallback, and its text-first
 * accessibility).
 *
 * feature.md FR-4.1–FR-4.10, FR-4.12, FR-5.1–FR-5.6, AC-1.5, AC-1.6, AC-3.1,
 * AC-3.2, AC-3.3, AC-3.5, AC-3.6, EC-12, EC-13, EC-14, NFR-4, NFR-6.
 *
 * `now` is passed in rather than read from the clock, so every date assertion is
 * deterministic (trd.md TR-11).
 */
import ProjectCard from '../../../../../v3/components/projects/ProjectCard';

/** 25 May 2026, 12:00 UTC — the fixed reference point for every date case. */
const NOW = new Date('2026-05-25T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const mockOpen = vi.fn();

const project = (over: Record<string, unknown> = {}) => ({
  id: 'P1',
  orgId: 'O1',
  name: 'Marketing stack sync',
  region: 'NA',
  owner: 'U1',
  isDeleted: false,
  created_at: ago(30 * DAY),
  updated_at: ago(10 * DAY),
  ...over,
});

/** A source document whose export succeeded — the Audit-step condition. */
const READY_SOURCE = { mode: 'stack', lastExport: { status: 'succeeded' } };
const DESTINATION = { region: 'NA', orgId: 'O1', stack: { apiKey: 'blt1', name: 'Prod' } };

const renderCard = (over: Record<string, unknown> = {}) =>
  render(<ProjectCard project={project(over) as never} now={NOW} onOpen={mockOpen} />);

const card = () => screen.getByTestId('project-card');
const badge = () => screen.getByTestId('project-card-status');

beforeEach(() => mockOpen.mockClear());

describe('v3 ProjectCard — content', () => {
  it('TC_PD_029 (positive): renders the project name', () => {
    renderCard({ name: 'Blog content move' });
    expect(screen.getByTestId('project-card-name')).toHaveTextContent('Blog content move');
  });

  // Negative — taxonomy #1 (missing input): the name comes from the project, so a
  // different project renders a different name. A hardcoded label would pass the
  // positive above and fail this.
  it('TC_PD_029 (negative): a different project renders its own name, not a fixed one', () => {
    renderCard({ name: 'Sandbox refresh' });
    const el = screen.getByTestId('project-card-name');
    expect(el).toHaveTextContent('Sandbox refresh');
    expect(el).not.toHaveTextContent('Blog content move');
  });

  it('TC_PD_030 (positive): a draft project 10 days old shows its name, source, status and an absolute date', () => {
    renderCard({ name: 'Marketing stack sync', updated_at: ago(10 * DAY) });

    expect(screen.getByTestId('project-card-name')).toHaveTextContent('Marketing stack sync');
    expect(screen.getByTestId('project-card-source')).toHaveTextContent('Source');
    expect(screen.getByTestId('project-card-source')).toHaveTextContent('Contentstack');
    expect(badge()).toHaveTextContent('Project Status');
    expect(badge()).toHaveTextContent('Draft');
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('May 15, 2026');
  });

  // Negative — taxonomy #4 (forbidden state): the same card must not also show a
  // relative description — the two date forms are exclusive, not layered.
  it('TC_PD_030 (negative): the absolute date is not accompanied by a relative description', () => {
    renderCard({ updated_at: ago(10 * DAY) });
    expect(screen.getByTestId('project-card-date')).not.toHaveTextContent('ago');
  });

  it('TC_PD_035 (positive): renders the literal label Source above the literal value Contentstack', () => {
    renderCard();
    const col = screen.getByTestId('project-card-source');
    expect(col).toHaveTextContent('Source');
    expect(col).toHaveTextContent('Contentstack');
  });

  // Negative — taxonomy #4 (forbidden state): the value is fixed for this
  // feature, so a project carrying some other source hint must not change it.
  it('TC_PD_035 (negative): the source value stays Contentstack regardless of the project', () => {
    renderCard({ legacy_cms: { cms: 'wordpress' } });
    const col = screen.getByTestId('project-card-source');
    expect(col).toHaveTextContent('Contentstack');
    expect(col).not.toHaveTextContent('wordpress');
  });

  it('TC_PD_036 (positive): renders the literal label Project Status above the badge', () => {
    renderCard();
    expect(badge()).toHaveTextContent('Project Status');
    expect(screen.getByTestId('project-card-status-value')).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing input): the label is fixed chrome and must
  // not be replaced by the status value itself.
  it('TC_PD_036 (negative): the status value does not replace the Project Status label', () => {
    renderCard();
    expect(screen.getByTestId('project-card-status-value')).not.toHaveTextContent('Project Status');
  });

  it('TC_PD_037 (positive): the footer contains a clock indicator and the last-modified time', () => {
    renderCard({ updated_at: ago(3 * HOUR) });
    const footer = screen.getByTestId('project-card-footer');
    expect(footer.querySelector('[data-testid="project-card-clock"]')).not.toBeNull();
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('3 hours ago');
  });

  // Negative — taxonomy #1 (missing input): the footer shows the last-modified
  // time, not the creation time. Those differ here by 20 days, so reading the
  // wrong field is detectable.
  it('TC_PD_037 (negative): the footer shows the last-modified time, not the creation time', () => {
    renderCard({ created_at: ago(30 * DAY), updated_at: ago(3 * HOUR) });
    const el = screen.getByTestId('project-card-date');
    expect(el).toHaveTextContent('3 hours ago');
    expect(el).not.toHaveTextContent('Apr');
  });
});

describe('v3 ProjectCard — date formatting', () => {
  it('TC_PD_031 (positive): a project modified 3 hours ago reads as a relative description', () => {
    renderCard({ updated_at: ago(3 * HOUR) });
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('3 hours ago');
  });

  // Negative — taxonomy #3 (boundary): the relative form applies strictly under
  // 7 days, so at exactly 7 days it must switch to the absolute form.
  it('TC_PD_031 (negative): at exactly 7 days the date switches to the absolute form', () => {
    renderCard({ updated_at: ago(7 * DAY) });
    const el = screen.getByTestId('project-card-date');
    expect(el).toHaveTextContent('May 18, 2026');
    expect(el).not.toHaveTextContent('ago');
  });

  it('TC_PD_032 (positive): a project modified 10 days ago reads as MMM D, YYYY', () => {
    renderCard({ updated_at: ago(10 * DAY) });
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('May 15, 2026');
  });

  // Negative — taxonomy #3 (boundary): just inside 7 days is still relative, so
  // the absolute form is not applied to everything older than a day.
  it('TC_PD_032 (negative): just under 7 days is still a relative description', () => {
    renderCard({ updated_at: ago(6 * DAY) });
    const el = screen.getByTestId('project-card-date');
    expect(el).toHaveTextContent('6 days ago');
    expect(el).not.toHaveTextContent('May 19, 2026');
  });

  it('TC_PD_033 (positive): plural forms read correctly for 2 days and 2 hours', () => {
    const { unmount } = renderCard({ updated_at: ago(2 * DAY) });
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('2 days ago');
    unmount();

    renderCard({ updated_at: ago(2 * HOUR) });
    expect(screen.getByTestId('project-card-date')).toHaveTextContent('2 hours ago');
  });

  // Negative — taxonomy #3 (boundary): a count of one takes the singular, so the
  // plural suffix is not applied unconditionally.
  it('TC_PD_033 (negative): a count of one takes the singular form, not the plural', () => {
    const { unmount } = renderCard({ updated_at: ago(DAY) });
    const first = screen.getByTestId('project-card-date');
    expect(first).toHaveTextContent('1 day ago');
    expect(first).not.toHaveTextContent('1 days ago');
    unmount();

    renderCard({ updated_at: ago(HOUR) });
    const second = screen.getByTestId('project-card-date');
    expect(second).toHaveTextContent('1 hour ago');
    expect(second).not.toHaveTextContent('1 hours ago');
  });
});

describe('v3 ProjectCard — truncation and encoding', () => {
  const LONG = 'a-really-long-project-name-that-will-not-fit-inside-one-card';

  it('TC_PD_034 (positive): a long name is marked for single-line ellipsis truncation', () => {
    renderCard({ name: LONG });
    expect(screen.getByTestId('project-card-name')).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });

  // Negative — taxonomy #4 (forbidden state): truncation must not be achieved by
  // cutting the string, which would put a lie in the document and break copying.
  it('TC_PD_034 (negative): the long name is not truncated in the document, only visually', () => {
    renderCard({ name: LONG });
    expect(screen.getByTestId('project-card-name')).toHaveTextContent(LONG);
  });

  it('TC_PD_045 (positive): a name containing markup characters renders as literal text', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    renderCard({ name: hostile });

    const el = screen.getByTestId('project-card-name');
    expect(el).toHaveTextContent(hostile);
    expect(el.querySelector('img')).toBeNull();
  });

  // Negative — taxonomy #2 (invalid shape): no element is created from the
  // supplied markup anywhere in the card, not merely inside the name node.
  it('TC_PD_045 (negative): no element is created from the supplied markup anywhere in the card', () => {
    renderCard({ name: '<img src=x onerror=alert(1)><script>bad()</script>' });

    expect(card().querySelector('img')).toBeNull();
    expect(card().querySelector('script')).toBeNull();
  });
});

describe('v3 ProjectCard — activation', () => {
  it('TC_PD_038 (positive): the card is a single activatable control with no nested controls', () => {
    renderCard();

    expect(card().tagName).toBe('BUTTON');
    expect(card().querySelectorAll('button, a, [role="button"]')).toHaveLength(0);
  });

  // Negative — taxonomy #4 (forbidden state): activating any inner region still
  // produces exactly one open, so no sub-region intercepts the activation.
  it('TC_PD_038 (negative): activating an inner region produces exactly one open, not two', async () => {
    renderCard();

    await userEvent.click(screen.getByTestId('project-card-name'));

    expect(mockOpen).toHaveBeenCalledOnce();
  });

  it('TC_PD_039 (positive): a project with a persisted destination opens the Destination step', async () => {
    renderCard({ id: 'P1', destination: DESTINATION });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P1', 'destination');
  });

  // Negative — taxonomy #4 (forbidden state): a persisted destination outranks a
  // ready source, so the presence of both must not resolve to the Audit step.
  it('TC_PD_039 (negative): a destination outranks a ready source rather than opening Audit', async () => {
    renderCard({ id: 'P1', source: READY_SOURCE, destination: DESTINATION });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P1', 'destination');
  });

  it('TC_PD_040 (positive): a project with nothing persisted opens the first step', async () => {
    renderCard({ id: 'P2', source: undefined, destination: undefined });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P2', 'source');
  });

  // Negative — taxonomy #2 (invalid shape): a source that exists but has NOT
  // succeeded is not progress past the first step, so it must not open Audit.
  it('TC_PD_040 (negative): a source whose export has not succeeded still opens the first step', async () => {
    renderCard({ id: 'P2', source: { mode: 'stack', lastExport: { status: 'running' } } });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P2', 'source');
  });

  it('TC_PD_041 (positive): a project whose source export succeeded opens the Audit step', async () => {
    renderCard({ id: 'P3', source: READY_SOURCE, destination: undefined });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P3', 'audit');
  });

  // Negative — taxonomy #2 (invalid shape): a failed export is not a succeeded
  // one, so it must not be treated as progress.
  it('TC_PD_041 (negative): a project whose source export failed does not open the Audit step', async () => {
    renderCard({ id: 'P3', source: { mode: 'stack', lastExport: { status: 'failed' } } });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P3', 'source');
  });

  it('TC_PD_042 (positive): a card whose project has an empty id does not navigate', async () => {
    renderCard({ id: '' });

    await userEvent.click(card());

    expect(mockOpen).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #1 (missing input, contrast): the same card with a real
  // id does navigate, so the refusal above is the guard and not a dead control.
  it('TC_PD_042 (negative): the same card with a real id does navigate', async () => {
    renderCard({ id: 'P7' });

    await userEvent.click(card());

    expect(mockOpen).toHaveBeenCalledWith('P7', 'source');
  });

  it('TC_PD_044 (positive): the card can be activated from the keyboard with Enter', async () => {
    renderCard({ id: 'P8' });

    card().focus();
    await userEvent.keyboard('{Enter}');

    expect(mockOpen).toHaveBeenCalledWith('P8', 'source');
  });

  // Negative — taxonomy #4 (forbidden state): the card must be in tab order at
  // all. A control reachable only by pointer fails NFR-5 regardless of whether
  // Enter works once focus is forced onto it.
  it('TC_PD_044 (negative): the card is not removed from keyboard tab order', () => {
    renderCard();
    expect(card()).not.toHaveAttribute('tabindex', '-1');
  });
});

describe('v3 ProjectCard — status badge', () => {
  it('TC_PD_046 (positive): a project with neither source nor destination renders Draft', () => {
    renderCard({ source: undefined, destination: undefined });
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('Draft');
  });

  // Negative — taxonomy #4 (forbidden state): Draft is specific to "nothing
  // persisted", so a project with a source must not also read Draft.
  it('TC_PD_046 (negative): a project with a persisted source does not read Draft', () => {
    renderCard({ source: READY_SOURCE });
    expect(screen.getByTestId('project-card-status-value')).not.toHaveTextContent('Draft');
  });

  it('TC_PD_047 (positive): a project with a persisted source renders In Progress', () => {
    renderCard({ source: READY_SOURCE, destination: undefined });
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('In Progress');
  });

  // Negative — taxonomy #2 (invalid shape): the design's copy is `In Progress`
  // with a capital P. v2 renders `In progress`, so this guards against the
  // wrong casing being carried over.
  it('TC_PD_047 (negative): the badge does not use v2 lower-case wording', () => {
    renderCard({ source: READY_SOURCE });
    expect(screen.getByTestId('project-card-status-value')).not.toHaveTextContent('In progress');
  });

  it('TC_PD_048 (positive): a project with a persisted destination renders In Progress', () => {
    renderCard({ source: undefined, destination: DESTINATION });
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('In Progress');
  });

  // Negative — taxonomy #1 (missing input): a destination alone is enough, so
  // In Progress must not require a source to be present as well.
  it('TC_PD_048 (negative): a destination alone is enough — In Progress does not require a source', () => {
    renderCard({ source: undefined, destination: DESTINATION });
    expect(screen.getByTestId('project-card-status-value')).not.toHaveTextContent('Draft');
  });

  it('TC_PD_049 (positive): a stored status contradicting the documents is ignored', () => {
    renderCard({ status: 'Completed', source: undefined, destination: undefined } as never);
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('Draft');
  });

  // Negative — taxonomy #4 (forbidden state): the stored value must not appear
  // at all, not merely be outranked.
  it('TC_PD_049 (negative): the stored status value is not rendered anywhere on the card', () => {
    renderCard({ status: 'Completed', source: undefined, destination: undefined } as never);
    expect(card()).not.toHaveTextContent('Completed');
  });

  it('TC_PD_050 (positive): each status renders an icon alongside its text', () => {
    const { unmount } = renderCard({ source: undefined, destination: undefined });
    expect(screen.getByTestId('project-card-status-icon')).toBeInTheDocument();
    const draftIcon = screen.getByTestId('project-card-status-icon').getAttribute('data-icon');
    unmount();

    renderCard({ source: READY_SOURCE });
    expect(screen.getByTestId('project-card-status-icon')).toBeInTheDocument();
    expect(screen.getByTestId('project-card-status-icon').getAttribute('data-icon')).not.toBe(draftIcon);
  });

  // Negative — taxonomy #4 (forbidden state): the icon is decorative, so it must
  // be hidden from assistive technology — the text is the signal (NFR-6).
  it('TC_PD_050 (negative): the status icon is hidden from assistive technology', () => {
    renderCard();
    expect(screen.getByTestId('project-card-status-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('TC_PD_052 (positive): a project whose status cannot be determined renders Draft', () => {
    renderCard({ source: null, destination: null } as never);
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('Draft');
  });

  // Negative — taxonomy #1 (missing input): the fallback must be the Draft badge
  // and not an empty or absent one.
  it('TC_PD_052 (negative): the fallback badge is not empty', () => {
    renderCard({ source: null, destination: null } as never);
    expect(screen.getByTestId('project-card-status-value').textContent?.trim()).not.toBe('');
  });

  it('TC_PD_053 (positive): the status is conveyed by text, so it survives without colour', () => {
    renderCard({ source: READY_SOURCE });
    expect(screen.getByTestId('project-card-status-value')).toHaveTextContent('In Progress');
  });

  // Negative — taxonomy #4 (forbidden state): the status must not be encoded only
  // in a colour attribute with no readable text alongside it.
  it('TC_PD_053 (negative): the badge is not an empty coloured element', () => {
    renderCard({ source: READY_SOURCE });
    const value = screen.getByTestId('project-card-status-value');
    expect(value.textContent?.trim().length).toBeGreaterThan(0);
  });
});
