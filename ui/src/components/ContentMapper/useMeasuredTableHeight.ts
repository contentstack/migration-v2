import { RefObject, useEffect, useState } from 'react';

/**
 * Measures the height to hand to InfiniteScrollTable's `tableHeight` prop for the
 * delta-iteration mappers (Entry / Asset).
 *
 * react-window sizes its virtual scroll viewport from that JS number, not CSS. The layout
 * caps the mapper to the available step-content area, so we measure the bounded outer box
 * (.entry-asset-mapper) minus the fixed chrome (toggle, search/panel row, pagination bar,
 * Save footer) and feed that back — otherwise the table renders a fixed-height viewport that
 * overruns the viewport on zoom and pushes pagination + Save off-screen.
 *
 * Anchoring on the OUTER box (never on .Table/.Table__body) is deliberate: those are sized BY
 * react-window from this very number, so reading them would create a runaway feedback loop.
 *
 * All DOM reads are scoped to `wrapperRef` (the mapper's own wrapper element) rather than a
 * global document.querySelector, so a missing node is contained to this subtree and — for
 * the chrome elements we can't find — surfaces a dev-only warning instead of silently falling
 * back to the magic constants.
 */
export interface MeasuredTableHeightOptions {
  /** Selector for the table's search/panel row, resolved within `wrapperRef`. */
  panelSelector: string;
  /** Selector for the Save footer, resolved within `wrapperRef`. */
  footerSelector: string;
  /**
   * Selector for an extra chrome row above the table (e.g. the asset mapper's status-filter
   * toolbar) that takes its own flex-flow height, resolved within `wrapperRef`. Omit when the
   * mapper has no such row (e.g. the entry mapper, whose locale select is absolutely positioned
   * and doesn't need reserving).
   */
  toolbarSelector?: string;
}

// Fixed chrome fallbacks, used only until the real elements are mounted/measured.
const PANEL_FALLBACK = 64;
const FOOTER_FALLBACK = 65;
const PAGINATION_AND_BUFFER = 56; // pagination bar (fixed height) + small buffer
const MIN_USABLE_HEIGHT = 80; // floor for the table body so it never collapses/goes negative
// Fallback for the bounded box height (matches .entry-asset-mapper's calc(100vh - 246px) cap),
// used only when the box isn't mounted/measured yet.
const BOX_HEIGHT_FALLBACK = 246;
// Reserve when no chrome is measured yet (toggle defaults to 0). Same terms as measure()'s
// `reserve` so the pre-measure guess uses the hook's own box model, not a stray constant.
const RESERVE_FALLBACK = PANEL_FALLBACK + FOOTER_FALLBACK + PAGINATION_AND_BUFFER;
const BOX_SELECTOR = '.entry-asset-mapper';
const TOGGLE_SELECTOR = '.mapper-view-toggle';

export function useMeasuredTableHeight(
  wrapperRef: RefObject<HTMLElement | null>,
  deps: unknown[],
  { panelSelector, footerSelector, toolbarSelector }: MeasuredTableHeightOptions,
): number {
  // Pre-measure guess: same model as measure() (box fallback − reserve), clamped to the floor
  // so the one frame react-window renders before the effect runs never gets a negative height.
  const [tableHeight, setTableHeight] = useState<number>(() =>
    Math.max(MIN_USABLE_HEIGHT, window.innerHeight - BOX_HEIGHT_FALLBACK - RESERVE_FALLBACK),
  );

  useEffect(() => {
    const measure = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      // The bounded box is a shared ancestor of the mapper; reach it from the wrapper so the
      // read stays scoped and doesn't grab the wrong mapper's box if both are ever mounted.
      const box = wrapper.closest(BOX_SELECTOR) as HTMLElement | null;
      const toggle = box?.querySelector(TOGGLE_SELECTOR) as HTMLElement | null;
      const panel = wrapper.querySelector(panelSelector) as HTMLElement | null;
      const footer = wrapper.querySelector(footerSelector) as HTMLElement | null;
      const toolbar = toolbarSelector
        ? (wrapper.querySelector(toolbarSelector) as HTMLElement | null)
        : null;

      if (import.meta.env.DEV) {
        // A rename/markup change in venus would drop us to the magic constants and quietly
        // regress the layout — warn loudly in dev so it's caught rather than shipped.
        if (!box) console.warn(`useMeasuredTableHeight: "${BOX_SELECTOR}" not found — falling back.`);
        if (!panel) console.warn(`useMeasuredTableHeight: "${panelSelector}" not found — using ${PANEL_FALLBACK}px fallback.`);
        if (!footer) console.warn(`useMeasuredTableHeight: "${footerSelector}" not found — using ${FOOTER_FALLBACK}px fallback.`);
        if (toolbarSelector && !toolbar) console.warn(`useMeasuredTableHeight: "${toolbarSelector}" not found — not reserving space for it.`);
      }

      // `||` not `??`: a momentarily 0-height box (measured before layout settles) should
      // hit the fallback too, otherwise boxH is 0 and `avail` goes negative.
      const boxH = box?.clientHeight || window.innerHeight - BOX_HEIGHT_FALLBACK;
      const reserve =
        (toggle?.offsetHeight ?? 0) +
        (panel?.offsetHeight ?? PANEL_FALLBACK) +
        (footer?.offsetHeight ?? FOOTER_FALLBACK) +
        (toolbar?.offsetHeight ?? 0) +
        PAGINATION_AND_BUFFER;
      // Clamp rather than skip: at extreme zoom `avail` can dip low, but keeping the previous
      // (possibly large) value would re-expose the overflow this hook exists to prevent.
      setTableHeight(Math.max(MIN_USABLE_HEIGHT, Math.floor(boxH - reserve)));
    };

    measure();
    const box = wrapperRef.current?.closest(BOX_SELECTOR) as HTMLElement | null;
    const ro = new ResizeObserver(measure);
    // Observe the bounded box when we can (it's what actually resizes); fall back to the
    // wrapper so we still react to layout changes if the box lookup misses.
    ro.observe(box ?? wrapperRef.current ?? document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return tableHeight;
}