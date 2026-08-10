// Observed facts about one reference field, accumulated from the values entries
// actually hold rather than from the field's Sitecore `source` definition.
export interface ObservedReferenceField {
  // Sitecore template name the field belongs to.
  template: string;
  // Sitecore field key, e.g. "whichleftnav".
  fieldKey: string;
  // Sitecore field type, e.g. "QueryableTreelist". Kept for logging only — it does
  // not decide cardinality (see resolveObservedField).
  fieldType: string;
  // Number of non-empty values seen.
  values: number;
  // How many of those held more than one GUID.
  multiValues: number;
  // Largest number of GUIDs seen in a single value.
  maxCardinality: number;
  // Contentstack content type uids the targets resolve to, with hit counts.
  targets: Record<string, number>;
  // GUIDs that could not be resolved, for logging.
  unresolved: number;
  // Targets that are media-library items. A plain reference field cannot hold an asset,
  // so these are counted separately: a field with both asset and entry targets is a
  // union (see redirect-target.utils), not a reference.
  assetTargets: number;
}

// The reference field configuration derived from the observations above.
export interface ResolvedReferenceField {
  referenceTo: string[];
  // True when any observed value held more than one GUID. Derived from the data, not
  // from whether Sitecore calls the field a multi-picker.
  multiple: boolean;
  // False when no target resolved — the field must then be dropped rather than
  // emitted as a reference pointing at nothing.
  usable: boolean;
}