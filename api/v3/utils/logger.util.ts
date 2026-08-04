/**
 * v3 structured log line — standalone (no import from `api/src`).
 *
 * Deliberately thin: this repository has no logging or metrics backend, so this
 * writes one JSON line to stdout and nothing more (cs-project-dashboard trd.md
 * §11). It exists so that call sites have a single place to log through, and so
 * that the "never log customer content" rule has one place to be enforced.
 *
 * Callers MUST pass identifiers only. A project's name and description are
 * customer-supplied content and must never be handed to this function
 * (cs-project-dashboard NFR-10).
 */
export const v3Log = (
  event: string,
  fields: Record<string, string | number | boolean | undefined> = {}
): void => {
  const line = { api: "v3", event, ...fields };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
};
