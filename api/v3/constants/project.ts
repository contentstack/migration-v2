/**
 * v3 project field limits (cs-project-dashboard FR-7.3, FR-7.6).
 *
 * These live in constants rather than in the store so that the controller can
 * validate without importing from the data layer — validation and persistence
 * are separate concerns, and coupling them meant every test that mocked the
 * store also had to know about its constants.
 *
 * The same numbers are enforced client-side. The client's are an affordance; the
 * server's are the contract (trd.md API-2).
 */
export const PROJECT_NAME_MAX = 200;
export const PROJECT_DESCRIPTION_MAX = 255;
