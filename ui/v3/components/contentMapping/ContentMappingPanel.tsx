import { CSSProperties, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { V3Dispatch, V3RootState } from '../../store';
import {
  contentMappingActions,
  matchingContentTypes,
  referencingSelected,
  statusLineFor,
  visibleContentTypes,
  ConflictMode,
  ContentTypeInventoryItem,
} from '../../store/slice/contentMapping.slice';
import {
  loadContentTypeInventory,
  persistContentTypeSelection,
  proceedFromContentMapping,
} from '../../store/thunks/contentMapping.thunks';
import { useRegisterStepGate } from '../wizard/StepGateContext';

/**
 * v3 Content mapping panel, interface 1 — the content type selection
 * (cs-content-type-selection trd.md TR-6 … TR-20).
 *
 * The footer is the CHROME's. This panel publishes a step gate — whether it may
 * advance, the work to do, and the status line only it can resolve — and renders
 * no footer, no primary action and no Back control of its own (FR-8.5). That is
 * trd.md TRR-2, and it is the shape the audit step got wrong: it drew its own
 * footer, so the chrome's action navigated without persisting.
 *
 * Everything visible is derived per render from the slice. Nothing about the
 * rendered rows, the counts, or which content types would be orphaned by an
 * untick is stored.
 */
export interface ContentMappingPanelProps {
  projectId: string;
}

/** FR-5.9 — verbatim, and load-bearing: this copy is the only mitigation for R-1. */
const CONFLICT_OPTIONS: { id: ConflictMode; label: string; explanation: string }[] = [
  {
    id: 'source',
    label: 'Use source',
    explanation: 'Replace the destination schema with the source content type',
  },
  {
    id: 'dest',
    label: 'Keep destination',
    explanation: 'Leave the destination schema untouched — only entries migrate',
  },
  {
    id: 'merge',
    label: 'Merge',
    explanation: 'Keep destination fields and add the new fields from the source',
  },
];


/*
  Styling values are the reference design's own, read from the rendered prototype
  and expressed through this project's tokens — which are a byte-for-byte match of
  the design system's, so nothing here is a one-off hex. Inline style objects
  rather than a stylesheet, because that is what Source, Destination and Audit
  already do; a stylesheet here would be a second convention.
*/
const page: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '22px 24px 72px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-body)',
};

const card: CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden',
};

const cardHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '16px 24px',
  borderBottom: '1px solid var(--border-subtle)',
  flexWrap: 'wrap',
};

const headingStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--text-strong)',
};

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const primaryButton = (disabled: boolean): CSSProperties => ({
  marginLeft: 'auto',
  height: 32,
  padding: '0 12px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'var(--font-sans)',
  letterSpacing: '-.01em',
  borderRadius: 'var(--radius-md)',
  border: '1px solid transparent',
  background: disabled ? 'var(--surface-inset)' : 'var(--brand-strong)',
  color: disabled ? 'var(--text-subtle)' : '#fff',
  boxShadow: disabled ? 'none' : 'var(--shadow-sm)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
});

const secondaryButton: CSSProperties = {
  height: 32,
  padding: '0 12px',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  letterSpacing: '-.01em',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-card)',
  color: 'var(--text-strong)',
  boxShadow: 'var(--shadow-sm)',
  cursor: 'pointer',
};

const searchWrap: CSSProperties = {
  margin: '14px 24px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 40,
  padding: '0 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
};

const searchInput: CSSProperties = {
  border: 'none',
  /* No `outline: none` — inline styles beat the shared :focus-visible ring, and
     suppressing it here would leave this the only control with no focus cue. */
  background: 'transparent',
  fontSize: 13.5,
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-strong)',
  flex: 1,
  minWidth: 0,
};

const checkboxStyle: CSSProperties = {
  width: 18,
  height: 18,
  flex: 'none',
  borderRadius: 5,
  /* Keeps a real <input type="checkbox"> — accent-color gives the design's brand
     fill without replacing the control, so it stays keyboard- and AT-native. */
  accentColor: 'var(--brand-strong)',
  cursor: 'pointer',
  margin: 0,
};

const selectAllRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 24px',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--text-body)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
};

const rowStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '11px 24px',
  background: selected ? 'var(--brand-subtle)' : 'transparent',
  borderBottom: '1px solid var(--border-subtle)',
  flexWrap: 'wrap',
});

const rowTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-strong)',
  // 1.5 gives the reference's 21px text box, which is what makes the row 43px
  // rather than 41px. Without it every row is 2px short of the design.
  lineHeight: 1.5,
};

const uidStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
};

const destBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--info-surface)',
  color: 'var(--info)',
  whiteSpace: 'nowrap',
};

const drillLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  color: 'var(--brand-stronger)',
  background: 'none',
  border: 'none',
  padding: 0,
  opacity: 0.45,
  cursor: 'not-allowed',
  whiteSpace: 'nowrap',
};

const conflictGroup: CSSProperties = {
  flexBasis: '100%',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 10,
  paddingTop: 10,
  borderTop: '1px dashed var(--border-default)',
};

const conflictOption = (checked: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 7,
  flex: '1 1 220px',
  padding: '8px 10px',
  borderRadius: 'var(--radius-md)',
  border: `1px solid ${checked ? 'var(--brand-strong)' : 'var(--border-default)'}`,
  background: checked ? 'var(--surface-card)' : 'transparent',
  cursor: 'pointer',
});

const footerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '12px 24px',
  fontSize: 12,
  color: 'var(--text-muted)',
};

const emptyState: CSSProperties = {
  padding: '40px 24px',
  textAlign: 'center',
  fontSize: 13.5,
  color: 'var(--text-muted)',
};

const alertStyle: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--danger)',
};

const ackStyle: CSSProperties = {
  margin: '12px 0 0',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--success)',
};

const dialogBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(22,19,32,.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
};

const dialogCard: CSSProperties = {
  width: 'min(460px, calc(100vw - 32px))',
  background: 'var(--surface-card)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-lg)',
  padding: '22px 24px',
};

const ContentMappingPanel: FC<ContentMappingPanelProps> = ({ projectId }) => {
  const dispatch = useDispatch<V3Dispatch>();
  const s = useSelector((st: V3RootState) => st.contentMapping);
  const {
    phase,
    contentTypes,
    destinationRead,
    selection,
    search,
    shown,
    saving,
    saveError,
    pendingUntick,
  } = s;

  /** Focus returns here when the confirmation closes (NFR-7). */
  const untickOrigin = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /*
    Owned here rather than read from the slice. `persistContentTypeSelection`
    sets slice state on its way through, but a caller that mocks the thunk — every
    component test, and any future one — would never see it. Driving the
    acknowledgement from the resolved value makes the panel responsible for saying
    whether the save worked.
  */
  const [saveOutcome, setSaveOutcome] = useState<'none' | 'ok' | 'failed'>('none');

  useEffect(() => {
    if (phase === 'idle') dispatch(loadContentTypeInventory(projectId) as never);
  }, [dispatch, phase, projectId]);

  const selectedUids = Object.keys(selection.contentTypes);
  const selectedCount = selectedUids.length;

  const matches = useMemo(
    () => matchingContentTypes(contentTypes, search),
    [contentTypes, search]
  );
  const visible = useMemo(
    () => visibleContentTypes(contentTypes, search, shown),
    [contentTypes, search, shown]
  );

  const searching = !!search.trim();
  const allShown = searching || shown >= matches.length;

  // Select-all reflects the scope it ACTS on, which is the matches while a search
  // is active and the whole export otherwise (FR-4.5, FR-4.6).
  const scope = searching ? matches : contentTypes;
  const scopeAllSelected =
    scope.length > 0 && scope.every((c) => !!selection.contentTypes[c.uid]);

  const ready = phase === 'ready';
  const gateOpen = ready && contentTypes.length > 0 && !saving;

  // ───────────────────────── interactions ─────────────────────────

  const applyUntick = useCallback(
    (uid: string) => {
      const item = contentTypes.find((c) => c.uid === uid);
      dispatch(
        contentMappingActions.toggleContentType({
          uid,
          existsInDestination: !!item?.existsInDestination,
        })
      );
    },
    [contentTypes, dispatch]
  );

  const onToggle = (item: ContentTypeInventoryItem, el: HTMLInputElement) => {
    const isSelected = !!selection.contentTypes[item.uid];
    if (isSelected) {
      const referrers = referencingSelected(contentTypes, selection, item.uid);
      if (referrers.length > 0) {
        untickOrigin.current = el;
        dispatch(contentMappingActions.askUntickConfirmation(item.uid));
        setDialogOpen(true);
        return;
      }
    }
    dispatch(
      contentMappingActions.toggleContentType({
        uid: item.uid,
        existsInDestination: item.existsInDestination,
      })
    );
  };

  const closeDialog = useCallback(
    (confirmed: boolean) => {
      const uid = pendingUntick;
      dispatch(contentMappingActions.dismissUntickConfirmation());
      setDialogOpen(false);
      if (confirmed && uid) applyUntick(uid);
      // Focus returns to the checkbox that raised it, not to the body (NFR-7).
      window.setTimeout(() => untickOrigin.current?.focus(), 0);
    },
    [applyUntick, dispatch, pendingUntick]
  );

  useEffect(() => {
    if (!dialogOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Escape cancels, never confirms — a reflex must not perform the
      // destructive half of a confirmation.
      if (e.key === 'Escape') closeDialog(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDialog, dialogOpen]);

  const onSelectAll = () => {
    if (scopeAllSelected) {
      // Clearing raises no confirmation, by design: otherwise the operator would
      // face one dialog per dependent content type (FR-6.7).
      const next = { ...selection.contentTypes };
      for (const c of scope) delete next[c.uid];
      dispatch(contentMappingActions.setSelection({ contentTypes: next }));
      return;
    }
    const next = { ...selection.contentTypes };
    for (const c of scope) {
      if (!next[c.uid]) next[c.uid] = c.existsInDestination ? { conflictMode: 'source' } : {};
    }
    dispatch(contentMappingActions.setSelection({ contentTypes: next }));
  };

  // ───────────────────────── the step gate ─────────────────────────

  const advance = useCallback(async () => {
    return (await dispatch(
      proceedFromContentMapping(projectId) as never
    )) as unknown as boolean;
  }, [dispatch, projectId]);

  useRegisterStepGate({
    satisfied: gateOpen,
    // Deliberately worded differently from the panel's empty-export sentence: the
    // chrome renders the blocked reason as visible text, so identical copy would
    // appear twice on the same screen.
    blockedReason:
      ready && contentTypes.length === 0 ? 'Nothing in this export to migrate' : undefined,
    advance,
    statusLine: statusLineFor(selectedCount),
  });

  // ───────────────────────── error and empty states ─────────────────────────

  if (phase === 'error') {
    return (
      <div style={page}>
        <div style={{ ...card, padding: '28px 24px' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>
            We could not read your exported content types
          </p>
          <p role="alert" style={{ ...hintStyle, fontSize: 13.5, marginTop: 6, lineHeight: 1.55 }}>
            We could not read your exported content types. Re-export your source and this
            step will load again.
          </p>
          <button
            type="button"
            style={{ ...secondaryButton, marginTop: 16 }}
            onClick={() => dispatch(contentMappingActions.reset())}
          >
            Back to Source
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────── the list ─────────────────────────

  const selectAllLabel = searching
    ? `Select all (${matches.length} matching)`
    : `Select all (${contentTypes.length})`;

  return (
    <div style={page}>
      <div style={card}>
        <div style={cardHead}>
          <h2 style={headingStyle}>Content types</h2>
          <span style={hintStyle}>— check a type to migrate it</span>
          <button
            type="button"
            disabled={saving}
            style={primaryButton(saving)}
            onClick={async () => {
              setSaveOutcome('none');
              const ok = (await dispatch(
                persistContentTypeSelection(projectId) as never
              )) as unknown as boolean;
              setSaveOutcome(ok ? 'ok' : 'failed');
            }}
          >
            Save selection ({selectedCount})
          </button>
        </div>

        {ready && contentTypes.length === 0 ? (
          <p data-testid="cts-empty-export" style={emptyState}>
            This export contains no content types.
          </p>
        ) : (
          <>
            <div style={searchWrap}>
              <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                ⌕
              </span>
              <input
                type="search"
                role="searchbox"
                aria-label="Search content types"
                placeholder={`Search ${contentTypes.length} content types…`}
                value={search}
                style={searchInput}
                onChange={(e) => dispatch(contentMappingActions.setSearch(e.target.value))}
              />
            </div>

            <label style={selectAllRow}>
              <input
                type="checkbox"
                aria-label={selectAllLabel}
                checked={scopeAllSelected}
                style={checkboxStyle}
                onChange={onSelectAll}
              />
              {selectAllLabel}
            </label>

            {visible.length === 0 ? (
              <p data-testid="cts-no-results" style={emptyState}>
                No content types match that search.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visible.map((item) => {
                  const entry = selection.contentTypes[item.uid];
                  const isSelected = !!entry;
                  const conflicting = item.existsInDestination && destinationRead;
                  return (
                    <li
                      key={item.uid}
                      data-testid={`cts-row-${item.uid}`}
                      style={rowStyle(isSelected)}
                    >
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          aria-label={item.title}
                          checked={isSelected}
                          style={checkboxStyle}
                          onChange={(e) => onToggle(item, e.target)}
                        />
                        <span style={rowTitle}>{item.title}</span>
                      </label>

                      {conflicting && <span style={destBadge}>already in destination</span>}

                      {isSelected && (
                        <>
                          {/*
                            Rendered but disabled: interfaces 2 and 3 do not exist
                            yet, and showing where the flow continues is better than
                            a step that looks complete and is not (FR-7.2).
                            Buttons, never links — a disabled anchor is still
                            followable by keyboard and middle-click.
                          */}
                          <button type="button" disabled tabIndex={-1} style={drillLink}>
                            map fields →
                          </button>
                          <button type="button" disabled tabIndex={-1} style={drillLink}>
                            entries →
                          </button>
                        </>
                      )}

                      <code style={uidStyle}>{item.uid}</code>

                      {isSelected && conflicting && (
                        <div
                          role="radiogroup"
                          aria-label={`Conflict resolution — ${item.title}`}
                          style={conflictGroup}
                        >
                          {CONFLICT_OPTIONS.map((opt) => {
                            const checked = (entry?.conflictMode ?? 'source') === opt.id;
                            return (
                              <label key={opt.id} style={conflictOption(checked)}>
                                <input
                                  type="radio"
                                  name={`conflict-${item.uid}`}
                                  value={opt.id}
                                  aria-label={opt.label}
                                  checked={checked}
                                  style={{ accentColor: 'var(--brand-strong)', marginTop: 2 }}
                                  onChange={() =>
                                    dispatch(
                                      contentMappingActions.setConflictMode({
                                        uid: item.uid,
                                        mode: opt.id,
                                      })
                                    )
                                  }
                                />
                                <span>
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: 12.5,
                                      fontWeight: 700,
                                      color: 'var(--text-strong)',
                                    }}
                                  >
                                    {opt.label}
                                  </span>
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: 11.5,
                                      color: 'var(--text-muted)',
                                      lineHeight: 1.45,
                                      marginTop: 2,
                                    }}
                                  >
                                    {opt.explanation}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!searching && (
              <div style={footerRow}>
                <span>{`Showing ${Math.min(shown, contentTypes.length)} of ${contentTypes.length}`}</span>
                {!allShown && (
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={() => dispatch(contentMappingActions.loadMore())}
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {saveOutcome === 'failed' && (
        <p role="alert" style={alertStyle}>
          {saveError ?? 'Could not save your selection. Please try again.'}
        </p>
      )}
      {saveOutcome === 'ok' && (
        <p data-testid="cts-save-ack" style={ackStyle}>
          Selection saved
        </p>
      )}

      {dialogOpen && pendingUntick && (
        <div style={dialogBackdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm unselect"
            ref={dialogRef}
            tabIndex={-1}
            style={dialogCard}
          >
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>
              Unselect this content type?
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.55, marginTop: 8 }}>
              {referencingSelected(contentTypes, selection, pendingUntick)
                .map((c) => c.title)
                .join(', ')}{' '}
              {referencingSelected(contentTypes, selection, pendingUntick).length === 1
                ? 'references'
                : 'reference'}{' '}
              this content type. Unselecting it may leave broken references.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button type="button" style={secondaryButton} onClick={() => closeDialog(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={{ ...primaryButton(false), marginLeft: 0, background: 'var(--danger)' }}
                onClick={() => closeDialog(true)}
              >
                Unselect anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentMappingPanel;
