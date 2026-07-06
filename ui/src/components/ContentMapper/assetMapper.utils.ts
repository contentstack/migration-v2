// Pure helpers for the delta-AEM Asset Mapper. Extracted from assetMapper.tsx so
// the selection / save / formatting logic can be unit-tested without rendering
// the component (which needs redux, the router and the Venus table).
import { AssetMapperType, UidMap } from './contentMapper.interface';

/** Human-readable file size; returns '-' for missing / non-positive sizes. */
export const formatFileSize = (size: number | string | undefined): string => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * API asset records → table rows. A row is selectable only when the asset
 * already has a Contentstack asset uid (i.e. it was matched to an existing
 * asset and can be updated/reused).
 */
export const mapAssetsToRows = (
  assetMapping: AssetMapperType[] | undefined,
): AssetMapperType[] =>
  (assetMapping ?? []).map((asset) => ({
    ...asset,
    _canSelect: !!asset?.contentstackAssetUid,
  }));

/** Initial checked set: selectable rows whose isUpdate flag is already on. */
export const buildSelectedRowIds = (
  assets: AssetMapperType[] | undefined,
): UidMap =>
  (assets ?? []).reduce<UidMap>((acc, item) => {
    if (item?._canSelect && item?.isUpdate) {
      acc[item.id] = true;
    }
    return acc;
  }, {});

/** Reflect the current selection back onto each selectable row's isUpdate flag. */
export const applySelectionToAssets = (
  assets: AssetMapperType[] | undefined,
  selected: Record<string, boolean>,
): AssetMapperType[] =>
  (assets ?? []).map((item) => {
    if (!item?._canSelect) return item;
    return {
      ...item,
      isUpdate: !!selected?.[item.id],
    };
  });

/** Selected row-id array → `{ id: true }` lookup map. */
export const toSelectedMap = (ids: string[] | undefined): UidMap => {
  const selected: UidMap = {};
  ids?.forEach((uid) => {
    selected[uid] = true;
  });
  return selected;
};

/**
 * Uids whose selected state differs between the current and persisted maps —
 * i.e. the set that actually needs to be saved.
 */
export const computeChangedUids = (
  rowIds: Record<string, boolean> | undefined,
  persistedRowIds: Record<string, boolean> | undefined,
): string[] => {
  const allKeys = new Set([
    ...Object.keys(rowIds ?? {}),
    ...Object.keys(persistedRowIds ?? {}),
  ]);
  return Array.from(allKeys).filter(
    (uid) => !!rowIds?.[uid] !== !!persistedRowIds?.[uid],
  );
};
