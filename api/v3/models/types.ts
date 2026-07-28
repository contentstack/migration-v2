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

export interface V3Project {
  id: string;
  org_id: string;
  source?: V3Source;
  created_at: string;
  updated_at: string;
}
