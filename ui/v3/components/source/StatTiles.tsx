import { FC } from 'react';

const TILES = [
  { key: 'contentTypes', label: 'Content types' },
  { key: 'assets', label: 'Assets' },
  { key: 'entries', label: 'Entries' },
  { key: 'globalFields', label: 'Global fields' },
  { key: 'references', label: 'References' },
];

/**
 * The 5 stat tiles shared between the live (in-progress) count display and the
 * final persisted content graph, so the numbers read identically in both
 * places. When `live` is true, tiles get a subtle pulse to signal the values
 * are actively changing rather than final.
 */
const StatTiles: FC<{ counts: Record<string, number>; live?: boolean }> = ({ counts, live }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7 }}>
    {TILES.map((t) => (
      <div
        key={t.key}
        style={{
          background: 'var(--surface-card)',
          border: `1px solid ${live ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '9px 11px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {live && (
          <span
            style={{
              position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%',
              background: 'var(--brand-strong)', animation: 'v3-pulse 1.4s ease-in-out infinite',
            }}
          />
        )}
        <div
          key={counts?.[t.key] ?? 0}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 800, color: 'var(--text-strong)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            animation: live ? 'v3-tile-in .25s ease-out' : undefined,
          }}
        >
          {counts?.[t.key] ?? 0}
        </div>
        <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>
          {t.label}
        </div>
      </div>
    ))}
  </div>
);

export default StatTiles;
