/**
 * v3 data types — standalone (no import from `api/src`). Mirrors trd.md DM-1.
 * No source secret is persisted: `stackApiKey` is a public stack identifier.
 */
export type V3SourceMode = "stack" | "file";
export type V3StackScope = "whole" | "specific";
export type V3FileScope = "all" | "specific";

export interface V3StackSource {
  region: string;
  orgId: string;
  stackApiKey: string;
  branch: string;
  scope: V3StackScope;
  selectedModules: string[];
}

export interface V3FileSource {
  sourceId: string;
  fileName: string;
  sizeBytes: number;
  manifestSummary?: Record<string, number>;
  scope: V3FileScope;
  selectedModules: string[];
}

export interface V3GraphSummary {
  counts: {
    contentTypes: number;
    assets: number;
    entries: number;
    globalFields: number;
    references: number;
  };
  nodes: unknown[];
  edges: unknown[];
}

export interface V3LastExport {
  jobId: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface V3Source {
  mode: V3SourceMode;
  stack?: V3StackSource;
  file?: V3FileSource;
  /** Server-owned; set by the export job, not the persist endpoint. */
  graph?: V3GraphSummary;
  lastExport?: V3LastExport;
}

// ---- Destination (Content Map & Audit — Destination panel), trd.md DM-1 ----

export type V3ImportAuthMethod = "management" | "authToken";

export interface V3DestinationStack {
  apiKey: string;
  name: string;
  /** Distinguishes a stack created via API-4 from one picked off the existing list. */
  wasCreated: boolean;
  description?: string;
}

/**
 * How the later import authenticates against the destination stack. For
 * `authToken` no fields are stored — it is a deferred, per-region credential
 * lookup at migrate time (feature.md FR-3.7). For `management` only the token's
 * NAME and uid are persisted here; the secret lives in the server-owned
 * `V3Project.destinationToken`, never in this client-supplied document.
 */
export interface V3ImportAuth {
  method: V3ImportAuthMethod;
  managementToken?: { name: string; uid?: string };
}

/**
 * The destination stack's management-token secret, encrypted at rest (2026-08-06).
 *
 * ── Why this is a top-level, server-owned field and NOT part of `destination`
 * The token is minted BEFORE the destination document is persisted — deliberately,
 * so that a failed mint leaves nothing persisted (cs-destination-selection
 * FR-3.3 / AC-3.5). `upsertV3Destination` then REPLACES `destination` wholesale
 * with the client's document. A secret stored under `destination.importAuth` would
 * therefore be overwritten moments after being written. Keeping it out here makes
 * that impossible by construction rather than by remembering to merge.
 *
 * ── Why it carries `stackApiKey`
 * A management token is only valid against the stack it was minted on, and the
 * user can still change the destination stack afterwards. Storing the stack makes
 * the record self-describing, so Migrate can tell a usable secret from a stale one
 * instead of authenticating with the wrong credential.
 *
 * ── Caveat worth knowing
 * These tokens are created with `is_never_expires: true`. If this record is lost
 * (the store is deleted, or the encryption key rotates) the token still exists on
 * the customer's stack and can only be removed through the Contentstack UI. v3 has
 * no revocation path yet.
 */
export interface V3StoredManagementToken {
  uid: string;
  name: string;
  /** The stack the token is valid against — see the note above. */
  stackApiKey: string;
  /** `enc:<iv>:<authTag>:<ciphertext>`; see `utils/secret.util.ts`. */
  secretEncrypted: string;
  createdAt: string;
}

export interface V3LocaleMapping {
  srcLocale: string;
  destLocale: string;
}

export interface V3Destination {
  region: string;
  orgId: string;
  stack: V3DestinationStack;
  importAuth: V3ImportAuth;
  /** Singular, not a list — there is only ever one selected source branch. */
  branchMapping: { srcBranch: string; destBranch: string };
  masterLocaleMapping: V3LocaleMapping;
  additionalLanguageMappings: V3LocaleMapping[];
}

/**
 * The persisted v3 project record (cs-project-dashboard trd.md DM-1).
 *
 * `name`, `region`, `owner` and `isDeleted` are **required, not optional**, and
 * that is the enforcement mechanism rather than a style choice: optional fields
 * are what previously let `upsertV3Source` bring a nameless, ownerless project
 * into existence as a side effect. Required makes that a compile error
 * (cs-project-dashboard FR-9.9).
 *
 * There is deliberately NO organization field. A project belongs to a user in a
 * region, not to an organization (FR-9.7, 2026-08-05). The old `org_id` field was
 * removed rather than renamed — nothing reads it, and a field nothing validates
 * would be assumed authoritative by the next reader.
 */
export interface V3Project {
  id: string;
  /** Human-readable, supplied at creation. */
  name: string;
  description?: string;
  /** The Contentstack region the project was created in. */
  region: string;
  /** The id of the user who created and owns it. */
  owner: string;
  /** Soft-delete marker; excluded from both listings and single reads when set. */
  isDeleted: boolean;
  source?: V3Source;
  destination?: V3Destination;
  /**
   * Server-owned, never accepted from a client and never returned to one. Written
   * only by `setV3DestinationToken` and read only by `getV3DestinationToken`.
   */
  destinationToken?: V3StoredManagementToken;
  /**
   * The Audit step's decisions. Absent means "never audited", which resolves to
   * everything included — the same default a new project gets (FR-7.1).
   */
  audit?: V3AuditDecisions;
  created_at: string;
  updated_at: string;
}

/**
 * The user's include/exclude choices from the Audit step (cs-audit-report DM-2).
 *
 * The ONLY part of the audit that lives on the project record. The findings — the
 * computed inventory — live beside the export they derive from, because they are
 * potentially megabytes, must die when the export is replaced, and this record is
 * returned whole to the browser by the project listing (FR-7.9).
 *
 * Deliberately loose about which categories may appear: validation happens at the
 * endpoint and resolution ignores anything non-excludable, so a hand-edited record
 * cannot make the audit act on a category the UI never offered.
 */
export interface V3AuditDecisions {
  /** Category-level standing policy — `unpublishedEntries` / `unusedAssets`. */
  categories: Record<string, "include" | "exclude">;
  /** Per-item overrides, keyed `entry:<ct>:<uid>:<locale>` or `asset:<uid>`. */
  itemOverrides: Record<string, "include" | "exclude">;
  updatedAt?: string;
}

/**
 * A project as it may be sent to a client: everything except the credential.
 *
 * Expressed as a type rather than enforced only at runtime so that a future
 * controller handing a listing to `res.json` cannot leak the secret even by
 * accident — the field is not on the type it receives.
 */
export type V3ProjectPublic = Omit<V3Project, "destinationToken">;

/**
 * The dimensions every project read is scoped by. Both come from the verified
 * token only, never from the request path, body or query string (FR-9.6, FR-9.11,
 * NFR-3) — which is what makes the scope untamperable by a caller.
 */
export interface V3ProjectScope {
  region: string;
  owner: string;
}

/** The only fields a client may supply when creating a project (FR-7.8). */
export interface V3ProjectInput {
  name: string;
  description?: string;
}
