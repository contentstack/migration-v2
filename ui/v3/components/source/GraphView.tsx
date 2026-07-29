import { FC, useMemo, useRef, useState } from 'react';

import StatTiles from './StatTiles';

interface GraphNode { uid: string; title: string; tier: number }
interface GraphEdge { from: string; to: string }
interface Graph { counts: Record<string, number>; nodes: GraphNode[]; edges: GraphEdge[] }

const NODE_W = 176;
const NODE_H = 48;
const COL_GAP = 60;
const ROW_GAP = 100;
const PAD = 36;
const BAND_W = 4000; // generous fixed width so tier bands always span past the rightmost node

const NODE_TINTS = ['var(--violet-500)', 'var(--blue-500)', 'var(--green-500,#16A06E)', 'var(--amber-500,#E29208)'];

interface GraphViewProps {
  graph: Graph;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const GraphView: FC<GraphViewProps> = ({ graph, fullscreen = false, onToggleFullscreen }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: PAD, y: PAD });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [animated, setAnimated] = useState(false);
  const animTimer = useRef<ReturnType<typeof setTimeout>>();
  const [hovered, setHovered] = useState<string | null>(null);

  // Lay tiers top-to-bottom (most dependencies at top), nodes spread across each row.
  const { positions, tiers } = useMemo(() => {
    const byTier = new Map<number, GraphNode[]>();
    for (const n of graph.nodes) {
      const a = byTier.get(n.tier) ?? [];
      a.push(n);
      byTier.set(n.tier, a);
    }
    const tierKeys = [...byTier.keys()].sort((a, b) => b - a);
    const pos = new Map<string, { x: number; y: number }>();
    const rows: { tier: number; y: number }[] = [];
    tierKeys.forEach((tier, row) => {
      const y = row * ROW_GAP + PAD;
      rows.push({ tier, y });
      byTier.get(tier)!.forEach((n, col) => {
        pos.set(n.uid, { x: col * (NODE_W + COL_GAP) + PAD, y });
      });
    });
    return { positions: pos, tiers: rows };
  }, [graph]);

  const connected = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    graph.edges.forEach((e) => {
      if (e.from === hovered) s.add(e.to);
      if (e.to === hovered) s.add(e.from);
    });
    return s;
  }, [hovered, graph.edges]);

  const animateThen = (fn: () => void) => {
    setAnimated(true);
    fn();
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAnimated(false), 240);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setAnimated(false);
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
    setAnimated(false);
    setScale((s) => Math.min(2.5, Math.max(0.35, s - e.deltaY * 0.0015)));
  };

  const zoomBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
    background: 'var(--surface-card)', color: 'var(--text-body)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', fontSize: 15,
    transition: 'background .12s, transform .08s',
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {graph.nodes.length} type{graph.nodes.length === 1 ? '' : 's'} across {tiers.length} dependency level{tiers.length === 1 ? '' : 's'}
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <b style={{ width: 14, height: 0, borderTop: '2px solid var(--violet-500)', display: 'inline-block' }} />
          {graph.edges.length} ref{graph.edges.length === 1 ? '' : 's'}
        </span>
        {onToggleFullscreen && (
          <button
            type="button"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={onToggleFullscreen}
            style={{
              width: 28, height: 28, flex: 'none', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)', background: 'var(--surface-card)',
              color: 'var(--text-body)', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: 'var(--shadow-sm)',
            }}
          >
            {fullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M15 21v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg>
            )}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <StatTiles counts={graph.counts} />
      </div>

      {/* canvas */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
        style={{
          position: 'relative', height: fullscreen ? '74vh' : 440, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)', overflow: 'hidden', touchAction: 'none',
          background:
            'radial-gradient(circle at 1px 1px, var(--border-subtle) 1px, transparent 0) 0 0/22px 22px, linear-gradient(180deg, var(--brand-subtle), transparent 42%), var(--surface-card)',
          cursor: grabbing ? 'grabbing' : 'grab',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0', willChange: 'transform',
            transition: animated ? 'transform .22s cubic-bezier(.2,0,0,1)' : 'none',
          }}
        >
          {/* dependency-tier bands, drawn first so nodes/edges paint over them */}
          {tiers.map((row, i) => (
            <div
              key={row.tier}
              style={{
                position: 'absolute', left: -PAD, top: row.y - (PAD - 10), width: BAND_W, height: ROW_GAP,
                background: i % 2 === 0 ? 'color-mix(in oklch, var(--brand-subtle) 55%, transparent)' : 'transparent',
              }}
            >
              <span style={{ position: 'absolute', left: 10, top: 6, fontSize: 9, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                Depth {row.tier}
              </span>
            </div>
          ))}

          <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {graph.edges.map((e, i) => {
              const a = positions.get(e.from); const b = positions.get(e.to);
              if (!a || !b) return null;
              const dim = hovered ? !(connected?.has(e.from) && connected?.has(e.to)) : false;
              const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
              const my = (y1 + y2) / 2;
              return (
                <path
                  key={i}
                  d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--violet-500)"
                  strokeWidth={dim ? 1.5 : 2}
                  opacity={dim ? 0.15 : 0.8}
                  style={{ transition: 'opacity .15s, stroke-width .15s' }}
                />
              );
            })}
          </svg>

          {graph.nodes.map((n) => {
            const p = positions.get(n.uid)!;
            const dim = hovered ? !connected?.has(n.uid) : false;
            const tint = NODE_TINTS[n.tier % NODE_TINTS.length];
            return (
              <div
                key={n.uid}
                title={n.uid}
                onPointerEnter={() => setHovered(n.uid)}
                onPointerLeave={() => setHovered(null)}
                style={{
                  position: 'absolute', left: p.x, top: p.y, width: NODE_W, height: NODE_H,
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-card)',
                  boxShadow: dim ? 'none' : 'var(--shadow-sm)',
                  opacity: dim ? 0.35 : 1,
                  display: 'flex', alignItems: 'stretch', overflow: 'hidden',
                  transition: 'opacity .15s, box-shadow .15s, transform .1s',
                  transform: hovered === n.uid ? 'translateY(-1px)' : 'none',
                }}
              >
                <span style={{ width: 4, flex: 'none', background: tint }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.title}
                  </span>
                </div>
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
          style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)', padding: '2px 7px', marginBottom: 2 }}>
            {Math.round(scale * 100)}%
          </span>
          <button type="button" aria-label="Zoom in" style={zoomBtn} onClick={() => animateThen(() => setScale((s) => Math.min(2.5, s + 0.2)))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" aria-label="Zoom out" style={zoomBtn} onClick={() => animateThen(() => setScale((s) => Math.max(0.35, s - 0.2)))}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button
            type="button"
            aria-label="Reset view"
            style={zoomBtn}
            onClick={() => animateThen(() => { setScale(1); setOffset({ x: PAD, y: PAD }); })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
