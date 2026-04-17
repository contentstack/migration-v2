import { FieldMapType, ExistingFieldType } from './contentMapper.interface';

/**
 * Finds a source group field anywhere under a modular block child's `child` tree
 * by uid. Direct `.find` on immediate children fails when groups are nested
 * (e.g. quote → details → paragraph).
 */
export function findGroupFieldInChildren(
  children: FieldMapType[] | undefined,
  uid: string,
): FieldMapType | undefined {
  if (!children?.length || !uid) return undefined;
  for (const c of children) {
    if (c?.uid === uid && c?.contentstackFieldType === 'group') {
      return c;
    }
    const found = findGroupFieldInChildren(c?.child, uid);
    if (found) return found;
  }
  return undefined;
}

/**
 * Determines whether a destination group field should be offered as a mapping
 * option for a source group field, by enforcing equal nesting depths.
 *
 * Rule: a root-level source group may only map to a root-level destination
 * group, and a nested source group may only map to a nested destination group.
 */
export function shouldAddGroupOption(dataUid: string, parentUid: string): boolean {
  const isNestedSourceGroup = dataUid?.includes('.');
  const isNestedDestGroup = !!parentUid;
  return isNestedSourceGroup === isNestedDestGroup;
}

/**
 * Determines whether processSchema should recurse into a nested destination
 * group when building the list of available mapping options.
 *
 * For root-level source groups recursion is always allowed — they need to
 * traverse the destination schema tree to surface nested groups as options for
 * their own nested children (the nesting-depth guard in shouldAddGroupOption
 * prevents any wrongly-levelled option from actually being added).
 *
 * For nested source groups recursion is only permitted when:
 *   1. The parent source group has been mapped (present in existingField), AND
 *   2. The label it was mapped to equals the current destination group's
 *      display name (updatedDisplayName).
 *
 * This mirrors the modular-blocks pattern where child block fields are only
 * surfaced after the parent block has been mapped.
 */
export function shouldRecurseIntoNestedDestGroup(
  dataUid: string,
  updatedDisplayName: string,
  nestedList: FieldMapType[],
  existingField: ExistingFieldType,
): boolean {
  const sourceUidParts = dataUid?.split('.');
  const isNestedSourceGroup = (sourceUidParts?.length ?? 0) > 1;

  if (!isNestedSourceGroup) {
    return true;
  }

  const parentSourceUid = sourceUidParts?.slice(0, -1)?.join('.');
 
  const parentSourceNode = nestedList?.find((item: FieldMapType) => item?.uid === parentSourceUid);

  const parentMappedLabel = parentSourceNode?.backupFieldUid
    ? (existingField[parentSourceNode.backupFieldUid] as { label?: string })?.label
    : undefined;

  return !!(parentMappedLabel && parentMappedLabel === updatedDisplayName);
}
