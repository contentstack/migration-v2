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
 * NAME and uid are persisted; the secret is never written here (NFR-1 / TQ-2).
 */
export interface V3ImportAuth {
  method: V3ImportAuthMethod;
  managementToken?: { name: string; uid?: string };
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

export interface V3Project {
  id: string;
  org_id: string;
  source?: V3Source;
  destination?: V3Destination;
  created_at: string;
  updated_at: string;
}
