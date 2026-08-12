import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Source Export Revamp, Phase 3 — resolving the CLI's credential.
 *
 * Backs `docs/plans/source-export-revamp.md` Impact 4.
 *
 * `TokenPayload` carries only `{region, user_id, is_sso}` — never a token — so
 * the CLI export has to resolve the real credential from the shared auth store,
 * exactly as `csManagement`'s `authHeaders` already does for its HTTP calls.
 * This is that resolver.
 *
 * The part that carries real risk is the SSO split. A single stored row holds
 * BOTH `authtoken` and `access_token`, and `applyCliAuth` prefers OAuth whenever
 * an access token is present. So returning the whole row would make a NON-SSO
 * user authenticate over OAuth with a stale access token — a wrong-credential
 * export rather than a clean failure. The resolver must therefore return only the
 * credential that matches `is_sso`.
 *
 * Isolation: the store resolves its path from V3_AUTH_STORE at module load, so
 * each test points it at a fresh temp file and re-imports.
 */
let tmpDir: string;
let storeFile: string;

const importStore = async () => {
  vi.resetModules();
  vi.stubEnv("V3_AUTH_STORE", storeFile);
  return import("../../../../v3/models/auth.store.js");
};

const seed = (users: unknown[]) => {
  fs.writeFileSync(storeFile, JSON.stringify({ users }));
};

/** A stored row as the shared login really writes it — both token fields set. */
const row = (over: Record<string, unknown> = {}) => ({
  user_id: "u1",
  email: "a@b.com",
  region: "NA",
  authtoken: "AUTH_BASIC",
  access_token: "ACCESS_OAUTH",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-02-02T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-cli-cred-"));
  storeFile = path.join(tmpDir, "authentication.json");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 auth store — the CLI credential", () => {
  it("returns the authtoken for a non-SSO user", async () => {
    seed([row()]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", false);

    expect(cred?.authtoken).toBe("AUTH_BASIC");
  });

  /*
    The load-bearing case. The row holds an access token too, and `applyCliAuth`
    prefers OAuth whenever one is present — so leaking it here would have a
    non-SSO user authenticate over OAuth with a credential their session never
    used. That fails as a confusing CLI auth error at best, and as an export
    running under the wrong identity at worst.
  */
  it("does NOT return an access token for a non-SSO user, even when the row holds one", async () => {
    seed([row()]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", false);

    expect(cred?.accessToken).toBeUndefined();
  });

  it("returns the access token for an SSO user", async () => {
    seed([row()]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", true);

    expect(cred?.accessToken).toBe("ACCESS_OAUTH");
  });

  /* The mirror image: an SSO session must not fall back to the basic authtoken. */
  it("does NOT return an authtoken for an SSO user", async () => {
    seed([row()]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", true);

    expect(cred?.authtoken).toBeUndefined();
  });

  /*
    `updated_at` is carried because the CLI uses it to decide whether an OAuth
    token needs refreshing. Sending `created_at` instead would have it refresh a
    token that is already fresh (the reasoning v2's setOAuthConfig records).
  */
  it("carries the identity fields the CLI stores alongside the token", async () => {
    seed([row()]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", true);

    expect(cred).toMatchObject({
      email: "a@b.com",
      userUid: "u1",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
  });

  // Negative — taxonomy #1 (missing input): no row for that user at all.
  it("returns null when the store holds no row for that region and user", async () => {
    seed([row({ region: "EU" })]);
    const { getCliCredential } = await importStore();

    expect(await getCliCredential("NA", "u1", false)).toBeNull();
  });

  /*
    Negative — taxonomy #1 (empty value): the row exists but its token is empty.

    Returning a credential object with an empty token would have `applyCliAuth`
    write `""` into the CLI config and the export fail with an opaque CLI auth
    error. Returning null instead produces the explicit "no credential" refusal.
  */
  it("returns null when the row exists but the needed token is empty", async () => {
    seed([row({ access_token: "" })]);
    const { getCliCredential } = await importStore();

    expect(await getCliCredential("NA", "u1", true)).toBeNull();
  });

  // Negative — taxonomy #7 (conflict): rows for several regions must not cross over.
  it("does not return another region's credential for the same user", async () => {
    seed([row({ region: "EU", authtoken: "EU_TOKEN" }), row({ region: "NA", authtoken: "NA_TOKEN" })]);
    const { getCliCredential } = await importStore();

    const cred = await getCliCredential("NA", "u1", false);

    expect(cred?.authtoken).toBe("NA_TOKEN");
  });
});
