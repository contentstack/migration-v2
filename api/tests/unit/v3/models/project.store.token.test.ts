import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — v3 project.store, destination management-token secret:
 * `setV3DestinationToken`, `getV3DestinationToken`, and the sanitisation of
 * `listV3Projects`.
 *
 * Where the encrypted secret lives, and why it is NOT inside `destination`:
 *
 * The token is created BEFORE the destination document is persisted — that
 * ordering is deliberate (cs-destination-selection FR-3.3 / AC-3.5: a failed
 * token creation must leave nothing persisted). `upsertV3Destination` then
 * REPLACES `project.destination` wholesale with the client's document. So a
 * secret written under `destination.importAuth` would be overwritten and lost
 * moments after being stored. Keeping it in a server-owned top-level field makes
 * that impossible by construction rather than by remembering to merge.
 *
 * It carries `stackApiKey` so the record is self-describing: a stored secret is
 * only usable against the stack it was minted on, and the destination stack can
 * still be changed after the token exists.
 *
 * Isolation: the store reads its data dir from V3_DATA_DIR; each test points it
 * at a fresh temp dir and re-imports the module.
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SCOPE = { region: "NA", owner: "U1" };

const seed = (projects: any[]) => {
  fs.writeFileSync(
    path.join(tmpDir, "projects.json"),
    JSON.stringify({ projects }, null, 2)
  );
};

const readFile = (): any =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, "projects.json"), "utf8"));

const record = (over: Record<string, unknown> = {}) => ({
  id: "P1",
  name: "Marketing stack sync",
  region: "NA",
  owner: "U1",
  isDeleted: false,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  ...over,
});

const TOKEN = {
  uid: "tok1",
  name: "eu-marketing-import",
  stackApiKey: "blt-dest",
  secretEncrypted: "enc:aa:bb:cc",
  createdAt: "2026-08-06T10:00:00.000Z",
};

const DESTINATION = {
  region: "EU",
  orgId: "o1",
  stack: { apiKey: "blt-dest", name: "Production — EU", wasCreated: true },
  importAuth: {
    method: "management",
    managementToken: { name: "eu-marketing-import", uid: "tok1" },
  },
  branchMapping: { srcBranch: "main", destBranch: "main" },
  masterLocaleMapping: { srcLocale: "en-us", destLocale: "en-us" },
  additionalLanguageMappings: [],
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-store-token-"));
  vi.stubEnv("V3_DATA_DIR", tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 project.store — setV3DestinationToken", () => {
  it("(set, positive) writes the token onto the project and survives a subsequent destination replace", async () => {
    seed([record()]);
    const { setV3DestinationToken, upsertV3Destination, getV3DestinationToken } =
      await importStore();

    await setV3DestinationToken("P1", TOKEN, "2026-08-06T10:00:00.000Z");
    expect(readFile().projects[0].destinationToken).toEqual(TOKEN);

    // The real ordering: the client persists its destination document straight
    // after the token is minted. That write replaces `destination` entirely — and
    // must leave the server-owned token untouched.
    await upsertV3Destination("P1", DESTINATION as any, "2026-08-06T10:00:01.000Z");

    const after = readFile().projects[0];
    expect(after.destinationToken).toEqual(TOKEN);
    expect(after.destination.importAuth.managementToken).toEqual({
      name: "eu-marketing-import",
      uid: "tok1",
    });
    // And the readable-only-by-the-server accessor still resolves it.
    expect(await getV3DestinationToken("P1", SCOPE)).toEqual(TOKEN);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the project the token is being
    attached to does not exist. It throws a 404-carrying error rather than
    creating a record, which is the same rule the two upserts follow
    (cs-project-dashboard FR-9.9/FR-9.10 — creation has exactly one entry point).

    Storing a secret is the last thing that should be allowed to conjure a
    nameless, ownerless project into existence.
  */
  it("(set, negative) an unknown project id throws 404 and writes nothing", async () => {
    seed([record()]);
    const { setV3DestinationToken } = await importStore();

    await expect(
      setV3DestinationToken("does-not-exist", TOKEN, "2026-08-06T10:00:00.000Z")
    ).rejects.toMatchObject({ status: 404 });

    expect(readFile().projects).toHaveLength(1);
    expect(readFile().projects[0].destinationToken).toBeUndefined();
  });
});

describe("v3 project.store — getV3DestinationToken", () => {
  it("(get, positive) returns the stored token for a caller in scope", async () => {
    seed([record({ destinationToken: TOKEN })]);
    const { getV3DestinationToken } = await importStore();

    expect(await getV3DestinationToken("P1", SCOPE)).toEqual(TOKEN);
  });

  /*
    Negative — taxonomy #5 (permission denial): a caller outside the project's
    scope gets `undefined`, exactly as `getV3Project` does — not the token, and
    not a distinguishable "forbidden" that would confirm the project exists.

    A stored credential is the single most important thing in this store to keep
    behind the same scope predicate as everything else, so this read is
    implemented in terms of `getV3Project` rather than reaching into the file.
  */
  it("(get, negative) a caller in another region or another owner gets undefined", async () => {
    seed([record({ destinationToken: TOKEN })]);
    const { getV3DestinationToken } = await importStore();

    expect(await getV3DestinationToken("P1", { region: "EU", owner: "U1" })).toBeUndefined();
    expect(await getV3DestinationToken("P1", { region: "NA", owner: "U2" })).toBeUndefined();
    expect(
      await getV3DestinationToken("P1", { region: "NA", owner: "U1" })
    ).toEqual(TOKEN);
  });
});

describe("v3 project.store — listV3Projects never returns the secret", () => {
  it("(list, positive) the listing keeps every other field, including the token name and uid", async () => {
    seed([record({ destinationToken: TOKEN, destination: DESTINATION })]);
    const { listV3Projects } = await importStore();

    const [project] = await listV3Projects(SCOPE);

    // The name and uid the dashboard may legitimately show are untouched — only
    // the secret-bearing field is withheld.
    expect(project.destination?.importAuth.managementToken).toEqual({
      name: "eu-marketing-import",
      uid: "tok1",
    });
    expect(project).toMatchObject({ id: "P1", name: "Marketing stack sync", region: "NA" });
  });

  /*
    Negative — taxonomy #5 (permission denial / information disclosure):
    `listV3Projects` is the one read that ships whole project records to the
    browser, so the encrypted secret must be stripped from it — encryption is
    protection at rest, not a licence to hand the ciphertext to a client that has
    no use for it.

    Sanitising must not corrupt the store: lowdb hands back live object
    references, so a sanitiser that DELETED the field would erase the credential
    from disk on the next write. The second assertion is what catches that.
  */
  it("(list, negative) the encrypted secret is absent from the listing and still present on disk", async () => {
    seed([record({ destinationToken: TOKEN })]);
    const { listV3Projects } = await importStore();

    const [project] = await listV3Projects(SCOPE);

    expect(project).not.toHaveProperty("destinationToken");
    expect(JSON.stringify(project)).not.toContain("enc:aa:bb:cc");

    // The sanitiser returned a copy; the record itself is intact.
    expect(readFile().projects[0].destinationToken).toEqual(TOKEN);
  });
});
