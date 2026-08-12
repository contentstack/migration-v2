import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Source Export Revamp, Phase 1c — region + credential injection for the CLI.
 *
 * Backs `docs/plans/source-export-revamp.md` Impact 4 and Impact 4b (R-9).
 *
 * The CLI is authenticated by writing into its OWN config store rather than by
 * passing anything on the command line, which is what keeps the credential out of
 * argv, out of a process listing, and out of the log the operator reads. Mirrors
 * v2's `setOAuthConfig` / `setBasicAuthConfig` but standalone: v3 imports nothing
 * from `api/src` (plan C-1).
 *
 * The region half is the part that carries real risk. `cs.ts` resolves a staging
 * host outside production while the CLI's region map is production-only, so a
 * naive `config:set:region NA` would point the CLI at a DIFFERENT Contentstack
 * than the UI listed — and because the same api key exists in both, it would
 * succeed and return the wrong stack's content. Hence the verification.
 */
/*
  ⚠️ Only `configHandler` is mocked, and that is deliberate.

  An earlier version of this file also mocked `@contentstack/cli-config` for its
  `regionHandler`. Every test passed — while the real module could not be imported
  at all: `@contentstack/cli-config` is an oclif PLUGIN whose package.json declares
  no `main`, `module` or `exports`. The mock stood in for something that would have
  thrown on import, so a green suite here sat on top of an export path that could
  never run. It surfaced only when the ROUTE tests loaded the export service
  transitively and failed to resolve the package.

  The lesson is encoded in the structure: the region map now runs REAL
  (`@contentstack/utils`), because it is pure data with no side effects and nothing
  about mocking it was ever load-bearing. `configHandler` stays mocked — it writes
  to the developer's actual CLI config on disk, which a test must not touch.
*/
const { mockSet, mockGet } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock("@contentstack/cli-utilities", () => ({
  configHandler: { set: mockSet, get: mockGet },
}));

import {
  cliRegionName,
  applyCliRegion,
  applyCliAuth,
  CliRegionMismatchError,
} from "../../../../v3/utils/cliAuth.util.js";
import { CS_REGIONS } from "../../../../v3/config/cs.js";
// Imported REAL, on purpose — see the note on the mocks above.
import { getContentstackEndpoint } from "@contentstack/utils";

/*
  The real production host for NA. Tests must pass `ourHost` explicitly rather
  than letting it default: `cs.ts` resolves STAGING hosts whenever NODE_ENV is not
  "production", and vitest does not set it, so the default would legitimately
  refuse. (Every npm start script — `dev` included — sets NODE_ENV=production, so
  real runs compare production against production.)
*/
const NA_PROD = "https://api.contentstack.io/v3";

beforeEach(() => {
  mockSet.mockReset();
  mockGet.mockReset();
});

// ───────────────────────── region names (Impact 4b) ─────────────────────────

describe("v3 CLI region names", () => {
  it("converts our underscored names to the CLI's hyphenated ones", () => {
    expect(cliRegionName("AZURE_NA")).toBe("AZURE-NA");
    expect(cliRegionName("GCP_EU")).toBe("GCP-EU");
  });

  it("leaves a name that needs no conversion alone", () => {
    expect(cliRegionName("NA")).toBe("NA");
    expect(cliRegionName("EU")).toBe("EU");
  });

  /*
    Every region this app offers must map to a name the CLI actually knows. This
    list is the CLI's own `regions` map. If someone adds a region to `cs.ts`
    without a CLI counterpart, THIS is the test that catches it — otherwise the
    failure arrives as an unresolvable region mid-export.
  */
  /*
    Every region this app offers must resolve against the CLI's REAL endpoint map,
    not against a hand-copied list of names. The previous version of this test
    compared to a literal set, which could only ever confirm that two copies of the
    same list agreed. Resolving for real means adding a region to `cs.ts` without a
    CLI counterpart fails HERE, rather than as an unresolvable region mid-export.
  */
  it("resolves every region cs.ts offers against the CLI's real endpoint map", () => {
    for (const region of CS_REGIONS) {
      const name = cliRegionName(region);
      expect(() => getContentstackEndpoint(name), `cs.ts offers "${region}" but the CLI has no such region`).not.toThrow();
    }
  });
});

// ───────────────────────── region verification (R-9) ─────────────────────────

describe("v3 CLI region — verified against cs.ts, never assumed", () => {
  it("writes the resolved region into the CLI's config store", () => {
    applyCliRegion("NA", NA_PROD);

    expect(mockSet).toHaveBeenCalledWith(
      "region",
      expect.objectContaining({ name: "NA", cma: "https://api.contentstack.io" })
    );
  });

  it("accepts a region whose CLI host matches the host this app uses", () => {
    expect(() => applyCliRegion("NA", NA_PROD)).not.toThrow();
  });

  /*
    The whole point of Impact 4b. If the CLI resolved a different Contentstack
    than `cs.ts` did, exporting would silently produce the WRONG stack's content —
    the same api key exists in both instances, so nothing would error and the
    operator would have no way to tell from the screen. Refusing loudly is the
    only safe response.
  */
  it("refuses to export when the CLI would use a different Contentstack", () => {
    expect(() => applyCliRegion("NA", "https://stag-api.csnonprod.com/v3")).toThrow(
      CliRegionMismatchError
    );
  });

  /*
    A refused region must leave the CLI's config UNTOUCHED. Writing the region and
    then throwing would hand the mismatch to the NEXT export, which has no reason
    to re-check it — turning one loudly refused export into a silently misdirected
    one.
  */
  it("writes nothing to the CLI config when it refuses", () => {
    expect(() => applyCliRegion("NA", "https://stag-api.csnonprod.com/v3")).toThrow();

    expect(mockSet).not.toHaveBeenCalled();
  });

  /*
    The error has to name BOTH hosts. "Region mismatch" alone would leave someone
    guessing which side is wrong; the two hostnames make the cause obvious and the
    fix (NODE_ENV) findable.
  */
  it("names both hosts in the refusal so the cause is obvious", () => {
    expect(() => applyCliRegion("NA", "https://stag-api.csnonprod.com/v3")).toThrow(
      /api\.contentstack\.io[\s\S]*stag-api\.csnonprod\.com|stag-api\.csnonprod\.com[\s\S]*api\.contentstack\.io/
    );
  });

  /*
    Comparison must survive a trailing `/v3` and a trailing slash. `cs.ts` stores
    hosts WITH the `/v3` segment and the CLI stores them without, so a naive
    string equality would report a mismatch on every single export and block all
    of them — turning a safety check into an outage.
  */
  it("treats hosts that differ only by the /v3 segment or a trailing slash as equal", () => {
    expect(() => applyCliRegion("NA", "https://api.contentstack.io/v3/")).not.toThrow();
  });

  /*
    An unresolvable region must fail before any export runs. Continuing with
    whatever region happened to be left in the shared config from a previous
    export is exactly the silent-wrong-stack outcome this guard exists to prevent.
  */
  it("refuses when the CLI cannot resolve the region at all", () => {
    expect(() => applyCliRegion("NOT_A_REGION", NA_PROD)).toThrow(/NOT-A-REGION/);
  });
});

// ───────────────────────── credentials (Impact 4) ─────────────────────────

describe("v3 CLI auth injection", () => {
  it("writes a basic authtoken with its authorisation type", () => {
    applyCliAuth({ authtoken: "AUTH_123", email: "a@b.com" });

    expect(mockSet).toHaveBeenCalledWith("authtoken", "AUTH_123");
    expect(mockSet).toHaveBeenCalledWith("authorisationType", "BASIC");
  });

  it("writes an OAuth access token with its authorisation type", () => {
    applyCliAuth({
      accessToken: "OAUTH_123",
      refreshToken: "REFRESH_123",
      email: "a@b.com",
      userUid: "u1",
    });

    expect(mockSet).toHaveBeenCalledWith("oauthAccessToken", "OAUTH_123");
    expect(mockSet).toHaveBeenCalledWith("authorisationType", "OAUTH");
  });

  /*
    OAuth must win when both are present. The export reads
    `authorisationType === 'OAUTH'` to decide how to authenticate
    (`export-config-handler.js:64`), so writing BASIC alongside an OAuth token
    would have it authenticate with a token it is not using.
  */
  it("prefers OAuth over a basic authtoken when both are supplied", () => {
    applyCliAuth({ accessToken: "OAUTH_123", authtoken: "AUTH_123", email: "a@b.com" });

    expect(mockSet).toHaveBeenCalledWith("authorisationType", "OAUTH");
    expect(mockSet).not.toHaveBeenCalledWith("authorisationType", "BASIC");
  });

  /*
    No credential at all must throw rather than proceed. The CLI would otherwise
    fall back to whatever token a PREVIOUS export left in the shared config and
    export as the wrong user — the failure mode the mutex and this check both
    guard from different directions.
  */
  it("throws when no credential is supplied rather than falling back to a stale one", () => {
    expect(() => applyCliAuth({ email: "a@b.com" })).toThrow(/credential|token/i);
  });

  it("writes nothing at all when it throws for a missing credential", () => {
    expect(() => applyCliAuth({})).toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  /*
    The token must never be logged. Injection is the reason the credential stays
    out of argv, so a stray console line here would undo the whole point.
  */
  it("logs nothing when injecting a credential", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    applyCliAuth({ authtoken: "AUTH_123", email: "a@b.com" });

    const written = [...log.mock.calls, ...err.mock.calls].flat().map(String).join(" ");
    expect(written).not.toContain("AUTH_123");
    log.mockRestore();
    err.mockRestore();
  });
});
