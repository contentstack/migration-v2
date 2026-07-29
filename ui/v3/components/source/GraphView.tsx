import { FC, useMemo, useRef, useState } from 'react';

interface GraphNode { uid: string; title: string; tier: number }
interface GraphEdge { from: string; to: string }
interface Graph { counts: Record<string, number>; nodes: GraphNode[]; edges: GraphEdge[] }

const NODE_W = 168;
const NODE_H = 46;
const COL_GAP = 56;
const ROW_GAP = 96;
const PAD = 32;

const TILES = [
  { key: 'contentTypes', label: 'Content types' },
  { key: 'assets', label: 'Assets' },
  { key: 'entries', label: 'Entries' },
  { key: 'globalFields', label: 'Global fields' },
  { key: 'references', label: 'References' },
];

const GraphView: FC<{ graph: Graph }> = ({ graph }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: PAD, y: PAD });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  // Lay tiers top-to-bottom (most dependencies at top), nodes spread across each row.
  const positions = useMemo(() => {
    const byTier = new Map<number, GraphNode[]>();
    for (const n of graph.nodes) {
      const a = byTier.get(n.tier) ?? [];
      a.push(n);
      byTier.set(n.tier, a);
    }
    const tiers = [...byTier.keys()].sort((a, b) => b - a);
    const pos = new Map<string, { x: number; y: number }>();
    tiers.forEach((tier, row) => {
      byTier.get(tier)!.forEach((n, col) => {
        pos.set(n.uid, { x: col * (NODE_W + COL_GAP) + PAD, y: row * ROW_GAP + PAD });
      });
    });
    return pos;
  }, [graph]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setGrabbing(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const endDrag = () => { drag.current = null; setGrabbing(false); };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(2.5, Math.max(0.35, s - e.deltaY * 0.0015)));
  };

  const zoomBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
    background: 'var(--surface-card)', color: 'var(--text-body)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', fontSize: 15,
  };

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--brand-subtle)', color: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 6h5a3 3 0 0 1 3 3v.5M7 18h5a3 3 0 0 0 3-3v-.5" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Content graph</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Types in dependency order, top to bottom</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <b style={{ width: 14, height: 0, borderTop: '2px solid var(--violet-500)', display: 'inline-block' }} />ref
        </span>
      </div>

      {/* stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 12 }}>
        {TILES.map((t) => (
          <div key={t.key} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '9px 11px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {graph.counts?.[t.key] ?? 0}
            </div>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* canvas */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
        style={{
          position: 'relative', height: 440, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)', overflow: 'hidden', touchAction: 'none',
          background: 'linear-gradient(180deg, var(--brand-subtle), transparent 42%), var(--surface-card)',
          cursor: grabbing ? 'grabbing' : 'grab',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
          <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {graph.edges.map((e, i) => {
              const a = positions.get(e.from); const b = positions.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
              const my = (y1 + y2) / 2;
              return <path key={i} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} fill="none" stroke="var(--violet-500)" strokeWidth={1.5} opacity={0.75} />;
            })}
          </svg>
          {graph.nodes.map((n) => {
            const p = positions.get(n.uid)!;
            return (
              <div key={n.uid} title={n.uid} style={{
                position: 'absolute', left: p.x, top: p.y, width: NODE_W, height: NODE_H,
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', display: 'flex',
                alignItems: 'center', gap: 8, padding: '0 11px',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-strong)', flex: 'none' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
              </div>
            );
          })}
        </div>

        {/*
          stopPropagation on pointerdown: the canvas above calls
          setPointerCapture(pointerId) on itself for panning. Per the Pointer
          Events spec, once a pointer is captured, the browser retargets that
          pointer's subsequent events (including the derived click) to the
          capturing element — so a button nested inside the canvas would never
          receive its own click. Stopping the pointerdown here before it
          reaches the canvas handler keeps these buttons clickable.
        */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <button type="button" aria-label="Zoom in" style={zoomBtn} onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" aria-label="Zoom out" style={zoomBtn} onClick={() => setScale((s) => Math.max(0.35, s - 0.2))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" aria-label="Reset view" style={zoomBtn} onClick={() => { setScale(1); setOffset({ x: PAD, y: PAD }); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
