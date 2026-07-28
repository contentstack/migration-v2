/**
 * v3 content-graph builder — standalone. Turns Contentstack content-type schemas
 * into the graph the Source panel renders: nodes (content types), edges
 * (reference relationships), a dependency tier per node, and the five counts.
 */
export interface GraphNode {
  uid: string;
  title: string;
  tier: number;
}
export interface GraphEdge {
  from: string;
  to: string;
}
export interface ContentGraph {
  counts: {
    contentTypes: number;
    assets: number;
    entries: number;
    globalFields: number;
    references: number;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Recursively collect reference-target uids from a CS field schema. */
const collectRefs = (schema: any[], acc: string[]): void => {
  for (const f of schema ?? []) {
    if (f?.data_type === "reference") {
      const to = Array.isArray(f.reference_to)
        ? f.reference_to
        : f.reference_to
        ? [f.reference_to]
        : [];
      for (const t of to) if (typeof t === "string") acc.push(t);
    }
    if (Array.isArray(f?.schema)) collectRefs(f.schema, acc); // group / global_field
    if (Array.isArray(f?.blocks)) {
      for (const b of f.blocks) collectRefs(b?.schema ?? [], acc); // modular blocks
    }
  }
};

export const buildGraph = (
  contentTypes: any[],
  moduleCounts: Record<string, number> = {}
): ContentGraph => {
  const cts = contentTypes ?? [];
  const nodes0 = cts.map((ct: any) => ({
    uid: ct?.uid,
    title: ct?.title ?? ct?.uid,
  }));
  const uidSet = new Set(nodes0.map((n) => n.uid));

  const edges: GraphEdge[] = [];
  const seenEdge = new Set<string>();
  for (const ct of cts) {
    const refs: string[] = [];
    collectRefs(ct?.schema ?? [], refs);
    for (const to of refs) {
      if (uidSet.has(to) && to !== ct?.uid) {
        const key = `${ct.uid}->${to}`;
        if (!seenEdge.has(key)) {
          seenEdge.add(key);
          edges.push({ from: ct.uid, to });
        }
      }
    }
  }

  // Dependency tier = longest outgoing reference chain (cycle-guarded).
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const arr = out.get(e.from) ?? [];
    arr.push(e.to);
    out.set(e.from, arr);
  }
  const memo = new Map<string, number>();
  const tierOf = (uid: string, seen: Set<string>): number => {
    if (memo.has(uid)) return memo.get(uid)!;
    if (seen.has(uid)) return 0;
    seen.add(uid);
    const outs = out.get(uid) ?? [];
    const t = outs.length ? 1 + Math.max(...outs.map((o) => tierOf(o, seen))) : 0;
    seen.delete(uid);
    memo.set(uid, t);
    return t;
  };

  const nodes: GraphNode[] = nodes0.map((n) => ({
    ...n,
    tier: tierOf(n.uid, new Set()),
  }));

  return {
    counts: {
      contentTypes: nodes.length,
      assets: moduleCounts.assets ?? 0,
      entries: moduleCounts.entries ?? 0,
      globalFields: moduleCounts.globalFields ?? 0,
      references: edges.length,
    },
    nodes,
    edges,
  };
};
