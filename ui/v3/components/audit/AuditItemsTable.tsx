import { CSSProperties, FC } from 'react';

import type {
  AuditCategory,
  AuditDecisionsView,
  AuditFilter,
  AuditItemView,
} from '../../store/slice/audit.slice';
import { isExcludable, isItemExcluded } from '../../utils/auditDecisions';

/**
 * The flagged-items table (cs-audit-report FR-6.1 … FR-6.13, TR-18).
 *
 * ⚠️ **This component does not filter, search or paginate.** It renders exactly the page
 * it was handed and reports intent upward; the server does the selecting (FR-6.4).
 * Filtering locally would hide rows the server already chose and make the pill counts
 * disagree with what is shown — and the pills describe the WHOLE set, which the client
 * never holds.
 *
 * **A deliberate structural divergence from the design.** The reference prototype builds
 * this as a CSS grid of `<div>`s. A real `<table>` is used here instead, because the grid
 * carries no table semantics: a screen-reader user gets no row/column relationships, and
 * `display: grid` on a `<table>` strips the roles in Chrome and Firefox. The design's
 * column widths (140 / 72 / 1fr / 116 / 60 / 96) are reproduced with `table-layout:
 * fixed`, so the result is visually the same and semantically correct.
 */
const PILLS: { id: AuditFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'entries', label: 'Entries' },
  { id: 'assets', label: 'Assets' },
  { id: 'contentTypes', label: 'Content types' },
  { id: 'globalFields', label: 'Global fields' },
  { id: 'taxonomies', label: 'Taxonomies' },
];

/*
  Widened from the design's 72 / 60 / 96 on Type, Locale and Status.

  Those three are the design's own grid values, and at the design's own content they are
  correct. They clip against real data: the Type cell needs 80px for a padded "Asset"
  pill, "en-us" does not fit 60px, and "Not referenced" needs 115px. Because the table is
  `table-layout: fixed`, the overflow is silently clipped rather than pushed — a status a
  user cannot read is worse than a column a few pixels off the design.

  The extra 90px comes out of Title / UID, which had 566px for content needing ~360.
*/
const COLUMNS: { label: string; width: string }[] = [
  { label: 'Include?', width: '140px' },
  { label: 'Type', width: '96px' },
  { label: 'Title / UID', width: 'auto' },
  { label: 'Content type', width: '116px' },
  { label: 'Locale', width: '78px' },
  { label: 'Status', width: '128px' },
];

/** Type-pill colouring, per the design's `typeStyle` map. */
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  Asset: { bg: 'var(--info-surface)', color: 'var(--info)' },
  Entry: { bg: 'var(--brand-subtle-2)', color: 'var(--brand-stronger)' },
  'Content type': { bg: 'var(--surface-inset)', color: 'var(--text-body)' },
  'Global field': { bg: 'var(--surface-inset)', color: 'var(--text-body)' },
  Taxonomy: { bg: 'var(--surface-inset)', color: 'var(--text-body)' },
};

const shell: CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
  marginTop: 20,
};

const headRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  // Wraps rather than overflowing: the heading, the flagged count, the bulk button and the
  // collapse control need ~380px on one line, so at 375px the collapse control was pushed
  // past the viewport edge. On the design's width this row never wraps.
  flexWrap: 'wrap',
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-subtle)',
};

const linkButton: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--brand-stronger)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const bulkButton = (anyExclusion: boolean): CSSProperties => ({
  marginLeft: 'auto',
  fontSize: 12.5,
  fontWeight: 700,
  padding: '7px 13px',
  borderRadius: 'var(--radius-md)',
  border: `1.5px solid ${anyExclusion ? 'var(--danger)' : 'var(--border-default)'}`,
  color: anyExclusion ? 'var(--danger)' : 'var(--text-body)',
  background: anyExclusion ? 'var(--danger-surface)' : 'transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const pill = (selected: boolean): CSSProperties => ({
  fontSize: 12,
  fontWeight: selected ? 800 : 600,
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  cursor: 'pointer',
  background: selected ? 'var(--gray-800)' : 'var(--surface-sunken)',
  color: selected ? '#fff' : 'var(--text-body)',
});

const th: CSSProperties = {
  textAlign: 'left',
  padding: '9px 18px',
  background: 'var(--surface-page)',
  // The design scrolls the ROW area beneath a header that stays put. Here the thead lives
  // inside the same 340px scroller (it has to — a table cannot be split across two
  // scrollers without losing its row/column semantics), so sticky reproduces that: the
  // header holds its position while the rows move under it. The opaque background above
  // is what stops rows showing through.
  position: 'sticky',
  top: 0,
  zIndex: 1,
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const td: CSSProperties = {
  padding: '10px 18px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 12,
  color: 'var(--text-body)',
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const box = (excluded: boolean, locked: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: 5,
  border: `1.5px solid ${excluded ? 'var(--border-default)' : 'var(--brand-strong)'}`,
  background: excluded ? 'var(--surface-card)' : 'var(--brand-strong)',
  flex: 'none',
  cursor: locked ? 'default' : 'pointer',
  opacity: locked ? 0.5 : 1,
  color: '#fff',
  fontSize: 11,
  lineHeight: '15px',
  padding: 0,
});

const AuditItemsTable: FC<{
  open: boolean;
  items: AuditItemView[];
  page: number;
  pageCount: number;
  total: number;
  counts: Record<AuditFilter, number>;
  filter: AuditFilter;
  search: string;
  decisions: AuditDecisionsView;
  anyExclusion: boolean;
  bulkAvailable: boolean;
  onToggleOpen: () => void;
  onFilter: (next: AuditFilter) => void;
  onSearch: (next: string) => void;
  onPage: (next: number) => void;
  onToggleItem: (key: string, category: AuditCategory) => void;
  onBulk: () => void;
}> = ({
  open, items, page, pageCount, total, counts, filter, search, decisions,
  anyExclusion, bulkAvailable, onToggleOpen, onFilter, onSearch, onPage,
  onToggleItem, onBulk,
}) => (
  <section style={shell} aria-label="All flagged items">
    <div style={headRow}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)' }}>
        All flagged items
      </h3>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} flagged</span>
      {bulkAvailable && (
        <button type="button" style={bulkButton(anyExclusion)} onClick={onBulk}>
          {anyExclusion ? 'Include everything' : 'Exclude all flagged'}
        </button>
      )}
      <button
        type="button"
        style={{ ...linkButton, marginLeft: bulkAvailable ? 0 : 'auto' }}
        onClick={onToggleOpen}
      >
        {open ? 'Hide table' : 'Show table'}
      </button>
    </div>

    {open && (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
          }}
        >
          {PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={filter === p.id}
              style={pill(filter === p.id)}
              onClick={() => onFilter(p.id)}
            >
              {p.label} {counts[p.id] ?? 0}
            </button>
          ))}
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 11px',
              minWidth: 210,
            }}
          >
            <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              ⌕
            </span>
            <input
              type="search"
              role="searchbox"
              aria-label="Search UID, title, type"
              placeholder="Search UID, title, type…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                border: 'none',
                /*
                  No `outline: none` here. The design draws the border on the wrapper and
                  none on the input, which is why the border is dropped — but suppressing
                  the outline too left this the only control on the page with no focus
                  indicator at all. Inline styles beat the `.v3-scope :focus-visible` rule
                  in theme.css, so the suppression was silently winning over the shared
                  ring. Leaving it off lets that ring apply.
                */
                fontSize: 12.5,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-strong)',
                background: 'transparent',
                flex: 1,
                minWidth: 0,
              }}
            />
          </span>
        </div>

        {/* The design's row area scrolls at 340px; the table keeps its own semantics. */}
        {/*
          overflowX matters as much as overflowY. The six fixed columns need ~700px; below
          that the table would otherwise push the whole PAGE into horizontal scroll, which
          drags the header, cards and footer sideways with it. Scrolling inside its own box
          keeps the overflow where it belongs.
        */}
        <div style={{ maxHeight: 340, overflowY: 'auto', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 700,
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.label} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.label} scope="col" style={th}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const locked = !isExcludable(item.category);
                const excluded = isItemExcluded(item.key, item.category, decisions);
                const type = TYPE_STYLE[item.type] ?? TYPE_STYLE['Content type'];
                return (
                  <tr
                    key={item.key}
                    style={{
                      opacity: excluded ? 0.5 : 1,
                      background: excluded ? 'var(--danger-surface)' : 'transparent',
                    }}
                  >
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={!excluded}
                          disabled={locked}
                          // Names the ITEM, not just its state: fifty checkboxes reading
                          // "Included" tell a screen-reader user nothing (NFR-8).
                          aria-label={
                            locked
                              ? `Always included — ${item.title}`
                              : `${excluded ? 'Excluded' : 'Included'} — ${item.title}`
                          }
                          title={locked ? 'Always included' : undefined}
                          style={box(excluded, locked)}
                          onClick={() => onToggleItem(item.key, item.category)}
                        >
                          {!excluded ? '✓' : ''}
                        </button>
                        {/* Text as well as colour, so an excluded row is distinguishable
                            without colour perception (NFR-9). */}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: excluded ? 'var(--danger)' : 'var(--text-muted)',
                          }}
                        >
                          {excluded ? 'Excluded' : 'Included'}
                        </span>
                      </span>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: type.bg,
                          color: type.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-strong)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-subtle)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {item.uid}
                      </span>
                    </td>
                    {/* Empty for items that have no such field — never a neighbour's
                        value (DM-3, TC_AR_091). */}
                    <td style={td}>{item.contentType ?? ''}</td>
                    <td style={td}>{item.locale ?? ''}</td>
                    <td style={td}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            flex: 'none',
                            background:
                              item.status === 'Never published'
                                ? 'var(--warning)'
                                : 'var(--text-muted)',
                          }}
                        />
                        <span style={{ fontSize: 11.5 }}>{item.status}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <p
            style={{
              padding: '34px 18px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}
          >
            No items match your filters.
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 18px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 11.5,
            color: 'var(--text-muted)',
          }}
        >
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            style={{ ...linkButton, opacity: page <= 1 ? 0.4 : 1 }}
            onClick={() => onPage(page - 1)}
          >
            ‹ Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            style={{ ...linkButton, opacity: page >= pageCount ? 0.4 : 1 }}
            onClick={() => onPage(page + 1)}
          >
            Next ›
          </button>
          <span style={{ marginLeft: 'auto' }}>
            items in a switched-off group are locked
          </span>
        </div>
      </>
    )}
  </section>
);

export default AuditItemsTable;
