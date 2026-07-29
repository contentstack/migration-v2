import { FC, useMemo, useRef, useState } from 'react';

interface GraphNode {
  uid: string;
  title: string;
  tier: number;
}
interface GraphEdge {
  from: string;
  to: string;
}
interface Graph {
  counts: Record<string, number>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_W = 160;
const NODE_H = 44;
const COL_GAP = 220;
const ROW_GAP = 74;

const TILES: { key: string; label: string }[] = [
  { key: 'contentTypes', label: 'Content types' },
  { key: 'assets', label: 'Assets' },
  { key: 'entries', label: 'Entries' },
  { key: 'globalFields', label: 'Global fields' },
  { key: 'references', label: 'References' },
];

const GraphView: FC<{ graph: Graph }> = ({ graph }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const positions = useMemo(() => {
    const byTier = new Map<number, GraphNode[]>();
    for (const n of graph.nodes) {
      const arr = byTier.get(n.tier) ?? [];
      arr.push(n);
      byTier.set(n.tier, arr);
    }
    const pos = new Map<string, { x: number; y: number }>();
    [...byTier.keys()]
      .sort((a, b) => b - a)
      .forEach((tier, col) => {
        byTier.get(tier)!.forEach((n, row) => {
          pos.set(n.uid, { x: col * COL_GAP + 20, y: row * ROW_GAP + 20 });
        });
      });
    return pos;
  }, [graph]);

  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onUp = () => {
    drag.current = null;
  };

  const zoomBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15,
  };

  return (
    <div>
      {/* stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
        {TILES.map((t) => (
          <div key={t.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {graph.counts?.[t.key] ?? 0}
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: '#6b7280' }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {/* canvas */}
      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        style={{
          position: 'relative',
          height: 380,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fafafa',
          cursor: drag.current ? 'grabbing' : 'grab',
        }}
      >
        <div
          style={{
            position: 'absolute',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }} width={1} height={1}>
            {graph.edges.map((e, i) => {
              const a = positions.get(e.from);
              const b = positions.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x + NODE_W}
                  y1={a.y + NODE_H / 2}
                  x2={b.x}
                  y2={b.y + NODE_H / 2}
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>
          {graph.nodes.map((n) => {
            const p = positions.get(n.uid)!;
            return (
              <div
                key={n.uid}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
                  width: NODE_W,
                  height: NODE_H,
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={n.uid}
              >
                {n.title}
              </div>
            );
          })}
        </div>

        {/* zoom controls */}
        <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button aria-label="Zoom in" style={zoomBtn} onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}>
            +
          </button>
          <button aria-label="Zoom out" style={zoomBtn} onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}>
            −
          </button>
          <button aria-label="Reset view" style={{ ...zoomBtn, fontSize: 11 }} onClick={() => { setScale(1); setOffset({ x: 20, y: 20 }); }}>
            ⟲
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphView;
