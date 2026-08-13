import { CSSProperties, FC } from 'react';

import type { AuditCategory } from '../../store/slice/audit.slice';

/**
 * A "Worth a look" card — one of the two categories a user may act on
 * (cs-audit-report FR-4.1 … FR-4.6).
 *
 * The switch's state is carried by `aria-checked` AND by a visible word, because NFR-9
 * requires text as well as colour: the reference design conveys this largely through the
 * track's fill, which is exactly what a user who cannot distinguish it needs the word
 * for. Its accessible name names the category, since two switches sit on this page and
 * "toggle" would leave a screen-reader user unable to tell which content they are about
 * to drop (NFR-8).
 *
 * The switch is a real `<button role="switch">` rather than the design's clickable
 * `<span>`, so it is keyboard-operable and focusable without extra work — a deliberate
 * upgrade on the prototype, which has no keyboard story at all.
 */
const card = (excluded: boolean): CSSProperties => ({
  background: 'var(--surface-card)',
  // The danger border is the design's loudest signal that content is being dropped.
  border: `1px solid ${excluded ? 'var(--danger)' : 'var(--border-subtle)'}`,
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)',
  padding: '15px 18px',
  marginBottom: 10,
});

const iconTile: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--warning-surface)',
  color: 'var(--warning)',
  fontSize: 17,
};

const reviewLink: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--brand-stronger)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const track = (excluded: boolean): CSSProperties => ({
  width: 40,
  height: 23,
  borderRadius: 'var(--radius-pill)',
  background: excluded ? 'var(--border-default)' : 'var(--brand-strong)',
  position: 'relative',
  transition: 'background var(--dur-fast) var(--ease-standard)',
  flex: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
});

const knob = (excluded: boolean): CSSProperties => ({
  position: 'absolute',
  top: 2.5,
  left: excluded ? 3 : 20,
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#fff',
  boxShadow: 'var(--shadow-sm)',
  transition: 'left var(--dur-fast) var(--ease-standard)',
});

const strip: CSSProperties = {
  marginTop: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: 'var(--danger)',
  background: 'var(--danger-surface)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
};

const AuditCategoryCard: FC<{
  id: AuditCategory;
  title: string;
  count: number;
  noun: string;
  guidance: string;
  excluded: boolean;
  variantCaveat: boolean;
  onToggle: () => void;
  onReview: () => void;
  /**
   * Freezes the include/exclude switch. "Review items ↓" stays live — jumping to the
   * table is navigation, not a decision, and reading the findings is still useful once
   * they can no longer be changed.
   */
  readOnly?: boolean;
}> = ({
  id,
  title,
  count,
  noun,
  guidance,
  excluded,
  variantCaveat,
  onToggle,
  onReview,
  readOnly,
}) => (
  <div style={card(excluded)} role="group" aria-label={title} data-category={id}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <span style={iconTile} aria-hidden="true">
        {id === 'unusedAssets' ? '🖼' : '📄'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</p>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-body)',
            lineHeight: 1.5,
            marginTop: 2,
          }}
        >
          {guidance}
          {variantCaveat && ' Variant content was not inspected in this export.'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 'none' }}>
        <button type="button" style={reviewLink} onClick={onReview}>
          Review items ↓
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: excluded ? 'var(--danger)' : 'var(--brand-stronger)',
              minWidth: 62,
              textAlign: 'right',
            }}
          >
            {excluded ? 'Excluded' : 'Included'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!excluded}
            aria-label={`${excluded ? 'Excluded' : 'Included'} — ${title}`}
            disabled={readOnly}
            style={readOnly ? { ...track(excluded), cursor: 'default', opacity: 0.55 } : track(excluded)}
            onClick={onToggle}
          >
            <span style={knob(excluded)} />
          </button>
        </span>
      </div>
    </div>
    {/*
      DELIBERATE DEVIATION from the design, recorded in the Phase 3 report.

      The design renders this as "**6 entries** will **not** be migrated." — bolding
      "not" as well as the count. Emphasising a word *inside* the phrase splits it across
      elements, which makes the sentence unreadable as prose to anything walking the DOM:
      a text matcher, and more importantly a screen reader announcing it in fragments.

      The count keeps its emphasis (it is a separate clause); the tail stays one text
      node. The strip is already the loudest element on an excluded card — danger colour,
      danger background, an ✕ — so the lost bold costs very little, and the sentence
      being legible costs nothing.
    */}
    {excluded && (
      <p style={strip}>
        <span aria-hidden="true">✕</span>
        <span>
          <strong>
            {count} {noun}
          </strong>{' '}
          <span>will not be migrated.</span>
        </span>
      </p>
    )}
  </div>
);

export default AuditCategoryCard;
