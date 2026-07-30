import { FC } from 'react';

import { useV3Selector } from '../../store/hooks';
import { destStackLabel } from '../../store/slice/destination.slice';

/**
 * "Stack contents" sidebar card (UC-9 / FR-10.1–10.3).
 *
 * Informational only — it never gates Proceed. An empty stack shows the
 * empty-state copy instead of a grid of zeroes; a stack this panel just created
 * is empty by definition (UC-9a), so it needs no fetch to say so.
 */
const EMPTY_MSG = 'This stack is empty — everything you migrate will be created fresh.';

const StackContents: FC = () => {
  const d = useV3Selector((s) => s.destination);
  const name = destStackLabel(d);
  const stats = d.stackStats;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            color: 'var(--text-subtle)',
          }}
        >
          Stack contents
        </div>
        {name && (
          <span
            data-testid="stack-contents-name"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 190,
            }}
          >
            {name}
          </span>
        )}
      </div>

      {!name ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Choose a destination stack to see what it already contains.
        </div>
      ) : d.statsLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span
            style={{
              width: 13,
              height: 13,
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--brand-strong)',
              borderRadius: '50%',
              animation: 'v3-spin .7s linear infinite',
            }}
          />
          Reading stack contents…
        </div>
      ) : !stats ? null : stats.isEmpty ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{EMPTY_MSG}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {stats.stats.map((st) => (
            <div
              key={st.label}
              data-testid="stack-stat-tile"
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-sunken)',
                padding: '9px 11px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text-strong)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {st.value}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                  color: 'var(--text-subtle)',
                }}
              >
                {st.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StackContents;
