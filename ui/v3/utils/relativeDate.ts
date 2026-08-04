/**
 * Last-modified formatting (cs-project-dashboard trd.md TR-11, FR-4.6).
 *
 * Relative under 7 days, absolute `MMM D, YYYY` at or beyond it — the same rule
 * v2's project cards use, so the two versions read identically.
 *
 * `now` is an argument, never read from the clock inside, so every caller and
 * every test is deterministic.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RELATIVE_WINDOW = 7 * DAY;

const plural = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export const formatLastModified = (
  iso: string | number | Date,
  now: Date | number
): string => {
  const then = new Date(iso).getTime();
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(then)) return '';

  const elapsed = nowMs - then;

  if (elapsed < RELATIVE_WINDOW) {
    // A clock skew that puts the timestamp slightly in the future reads as
    // "1 second ago" rather than a negative count.
    const seconds = Math.max(1, Math.round(elapsed / 1000));
    if (seconds < 60) return plural(seconds, 'second');

    const minutes = Math.round(elapsed / MINUTE);
    if (minutes < 60) return plural(minutes, 'minute');

    const hours = Math.round(elapsed / HOUR);
    if (hours < 24) return plural(hours, 'hour');

    return plural(Math.round(elapsed / DAY), 'day');
  }

  return new Date(then).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
