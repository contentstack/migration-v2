/**
 * v3 constants. Self-contained — v3 does not import from ui/src.
 */

/** URL prefix for every v3 route. All v3 navigation must build paths from this. */
export const V3_BASE = '/v3';

/**
 * API version segment for v3 service calls (paths are built as
 * `${API_VERSION_V3}/...`). Overridable via env; defaults to 'v3'.
 * This is intentionally separate from v2's API_VERSION so both coexist.
 */
export const API_VERSION_V3 = import.meta.env.VITE_API_VERSION_V3 ?? 'v3';
