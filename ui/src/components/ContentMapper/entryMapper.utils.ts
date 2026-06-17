// Pure helpers for the delta-AEM Entry Mapper. Extracted from entryMapper.tsx so
// the row-mapping / selection / content-type-status logic can be unit-tested
// without rendering the component (which needs redux, the router and the Venus
// table). Generic selection helpers (toSelectedMap, computeChangedUids) are
// shared from assetMapper.utils.
import { EntryMapperType, ContentType, UidMap } from './contentMapper.interface';
import { CONTENT_MAPPING_STATUS } from '../../utilities/constants';

/**
 * API entry records → table rows. A row is selectable only when the entry is
 * already mapped to an existing Contentstack entry uid (i.e. can be updated).
 */
export const mapEntriesToRows = (
  entryMapping: EntryMapperType[] | undefined,
): EntryMapperType[] =>
  (entryMapping ?? []).map((entry) => ({
    ...entry,
    _canSelect: !!entry?.contentstackEntryUid,
  }));

/** Initial checked set: selectable rows whose isUpdate flag is already on. */
export const buildSelectedEntryRowIds = (
  entries: EntryMapperType[] | undefined,
): UidMap =>
  (entries ?? []).reduce<UidMap>((acc, item) => {
    if (item?._canSelect && item?.isUpdate) {
      acc[item.id] = true;
    }
    return acc;
  }, {});

/** Reflect the current selection back onto each selectable row's isUpdate flag. */
export const applySelectionToEntries = (
  entries: EntryMapperType[] | undefined,
  selected: Record<string, boolean>,
): EntryMapperType[] =>
  (entries ?? []).map((item) => {
    if (!item?._canSelect) return item;
    return {
      ...item,
      isUpdate: !!selected?.[item.id],
    };
  });

/** Rows that start unselected (isUpdate=false) — the table's initial selectable set. */
export const selectableInitialRows = (
  rows: EntryMapperType[] | undefined,
): EntryMapperType[] => (rows ?? []).filter((item) => !item?.isUpdate);

/** Filter the content-type list by a human-readable status label (e.g. 'Updated'). */
export const filterContentTypesByStatus = (
  contentTypes: ContentType[] | undefined,
  value: string,
): ContentType[] =>
  (contentTypes ?? []).filter(
    (ct) => CONTENT_MAPPING_STATUS[ct?.status] === value,
  );

/**
 * Set a single content type's status to '2' (has selected entries → "Updated")
 * or '1' (none → "Mapped"), leaving every other content type unchanged.
 */
export const applyContentTypeStatus = (
  list: ContentType[] | undefined,
  contentTypeId: string,
  hasSelection: boolean,
): ContentType[] => {
  const nextStatus = hasSelection ? '2' : '1';
  return (list ?? []).map((ct) =>
    ct?.id === contentTypeId ? { ...ct, status: nextStatus } : ct,
  );
};
