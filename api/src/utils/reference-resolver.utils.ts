import type {
  ObservedReferenceField,
  ResolvedReferenceField,
} from './reference-resolver.interface.js';
import type { SitecoreItemIndexEntry } from './redirect-target.interface.js';
import { extractGuids } from './redirect-target.utils.js';

// Sitecore reference fields declare their allowed targets in a `source` field on the
// template-field definition. Only a minority of those sources are GUID lists that can
// be parsed: across this package QueryableTreelist sources are 10/10 Sitecore queries
// (`query:./ancestor-or-self::*[@@templatename='Site']/...`), Droptree is mostly paths
// or empty, and even Treelist only has GUIDs in 8 of 55 definitions.
//
// So targets are derived from the values entries actually hold, which works regardless
// of how the source was expressed. This also fixes the reason these fields produced
// empty `reference_to`: everything except Treelist fell through to a default branch
// that emitted no `sourceKey`, and the resolution step requires one.

// Sitecore field types that become Contentstack references.
export const SITECORE_REFERENCE_TYPES = new Set([
  'droptree',
  'droplink',
  'multilist',
  'multilist with search',
  'treelist',
  'tree list',
  'treelistex',
  'queryabletreelist',
]);

export function isReferenceFieldType(type?: string): boolean {
  return SITECORE_REFERENCE_TYPES.has(`${type ?? ''}`.toLowerCase());
}

// Sitecore templates that are engine machinery rather than content. Referencing these
// would put templates, branches and validation rules into the content graph.
const NON_CONTENT_TEMPLATES = new Set([
  'template',
  'branch',
  'template field',
  'template section',
  'settings',
  'validation rule',
  'base theme',
  'grid theme',
  'theme',
  'available renderings',
  'variants grouping',
  'datafolder',
]);

// Folder templates: referencing a folder is almost never the intent, and a folder holds
// no content of its own.
const FOLDER_TEMPLATE_RE = /(^|\s)folder$/i;

export function isContentTemplate(template?: string): boolean {
  const t = `${template ?? ''}`.toLowerCase().trim();
  if (!t) return false;
  if (NON_CONTENT_TEMPLATES.has(t)) return false;
  if (FOLDER_TEMPLATE_RE.test(t)) return false;
  return true;
}

export function emptyObservation(
  template: string,
  fieldKey: string,
  fieldType: string
): ObservedReferenceField {
  return {
    template,
    fieldKey,
    fieldType,
    values: 0,
    multiValues: 0,
    maxCardinality: 0,
    targets: {},
    unresolved: 0,
    assetTargets: 0,
  };
}

/**
 * Fold one entry's field value into the running observation for that field.
 *
 * Call once per (entry, reference field) while walking entries; the accumulated
 * observation is then turned into a field configuration by resolveObservedField.
 */
export function observeReferenceValue({
  observation,
  content,
  itemIndex,
  contentTypeKeys,
}: {
  observation: ObservedReferenceField;
  content?: string;
  itemIndex: Record<string, SitecoreItemIndexEntry>;
  contentTypeKeys: Record<string, string>;
}) {
  const guids = extractGuids(content);
  if (!guids.length) return;

  observation.values += 1;
  if (guids.length > 1) observation.multiValues += 1;
  if (guids.length > observation.maxCardinality) {
    observation.maxCardinality = guids.length;
  }

  for (const guid of guids) {
    const item = itemIndex?.[guid.toUpperCase()];
    if (!item) {
      observation.unresolved += 1;
      continue;
    }
    if (item.mediaPath !== undefined) {
      // A media-library item: an asset, not an entry. Fields that mix assets and
      // entries (`redirect to item`) are handled by the union block in
      // redirect-target.utils; a plain reference field cannot hold an asset, so it
      // must not claim the asset's template as a target content type.
      observation.assetTargets += 1;
      continue;
    }
    if (!isContentTemplate(item.template)) {
      // Machinery or a folder: not a content reference. Counted as unresolved so it
      // shows up in the log rather than silently shrinking the target list.
      observation.unresolved += 1;
      continue;
    }
    // contentTypeKey.json is keyed by template GUID (`tid`), never template name.
    const ctUid = item.templateId
      ? contentTypeKeys?.[item.templateId] ??
        contentTypeKeys?.[item.templateId.toUpperCase()]
      : undefined;
    if (!ctUid) {
      observation.unresolved += 1;
      continue;
    }
    observation.targets[ctUid] = (observation.targets[ctUid] ?? 0) + 1;
  }
}

/**
 * Turn accumulated observations into the field's Contentstack configuration.
 *
 * `multiple` comes from observed cardinality, not the Sitecore type name. This matters
 * in both directions: `whichleftnav` is a QueryableTreelist (a multi-picker) whose
 * 1,249 values are all single-valued, so it becomes a single reference; while a field
 * where only a handful of values hold two GUIDs still needs an array, or those values
 * would lose data.
 */
export function resolveObservedField(
  observation: ObservedReferenceField
): ResolvedReferenceField {
  const referenceTo = Object.keys(observation?.targets ?? {}).sort();
  return {
    referenceTo,
    multiple: (observation?.multiValues ?? 0) > 0,
    // No resolvable target: emitting a reference here is what produced fields pointing
    // at nothing. The caller drops the field instead.
    usable: referenceTo.length > 0,
  };
}

/**
 * Build the fieldMapping row for a resolved reference field, or null when the field
 * has no usable target and should be omitted.
 */
export function buildReferenceMapping({
  observation,
  resolved,
  fieldUid,
  displayName,
  sitecoreKey,
  fieldId,
}: {
  observation: ObservedReferenceField;
  resolved: ResolvedReferenceField;
  fieldUid: string;
  displayName: string;
  sitecoreKey: string;
  fieldId?: string;
}) {
  if (!resolved.usable) return null;
  return {
    id: fieldId,
    uid: sitecoreKey,
    otherCmsField: displayName,
    otherCmsType: observation.fieldType,
    contentstackField: displayName,
    contentstackFieldUid: fieldUid,
    contentstackFieldType: 'reference',
    backupFieldUid: fieldUid,
    backupFieldType: 'reference',
    isDeleted: false,
    refrenceTo: resolved.referenceTo,
    // Contentstack expresses reference cardinality through field_metadata.ref_multiple
    // as well as `multiple`; the content-type builder reads this one.
    multiple: resolved.multiple,
  };
}

// One line per field describing what was resolved, so a field that ends up dropped or
// narrower than expected is visible in the migration log rather than just absent.
export function describeResolution(
  observation: ObservedReferenceField,
  resolved: ResolvedReferenceField
) {
  const where = `"${observation.fieldKey}" (${observation.fieldType}) on ${observation.template}`;
  if (!resolved.usable) {
    // An unused field and a field whose targets all failed are different situations:
    // the first is normal, the second may mean content was missed.
    if (!observation.values) {
      return `Reference field ${where} was dropped: no entry populates it, so its target content type could not be determined.`;
    }
    const detail = observation.assetTargets
      ? ` ${observation.assetTargets} target(s) are assets rather than entries — this field may need an asset or union field instead.`
      : '';
    return `Reference field ${where} was dropped: none of its ${observation.values} value(s) resolved to a migratable content type.${detail}`;
  }
  const card = resolved.multiple
    ? `multiple (max ${observation.maxCardinality} per value)`
    : 'single';
  const skipped = observation.unresolved
    ? ` ${observation.unresolved} target(s) skipped as unresolvable or non-content.`
    : '';
  const assets = observation.assetTargets
    ? ` ${observation.assetTargets} target(s) are assets and are not part of this reference.`
    : '';
  return `Reference field ${where} resolved to [${resolved.referenceTo.join(', ')}], ${card}, from ${observation.values} value(s).${skipped}${assets}`;
}