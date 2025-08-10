/**
 * Merges content type objects by contentstackUid.
 * For fieldMapping, merges containers by their uid (deep merge).
 * Ensures no duplicate contentstackUid and places merged data at the first occurrence.
 */
export function mergeContentTypeFieldMappings(contentTypes: any[]): any[] {
  const map = new Map<string, number>();
  const result: any[] = [];

  function mergeContainers(arr1: any[], arr2: any[]): any[] {
    const merged: any[] = [];
    const seenUids = new Set<string>();

    const getUid = (container: any) => {
      if (container?.container && Array.isArray(container.container)) {
        return container.container[0]?.uid || '';
      }
      return container?.uid || '';
    };

    for (const item of arr1) {
      if (item?.container) {
        const uid = getUid(item);
        seenUids.add(uid);
        merged.push(item);
      } else {
        merged.push(item);
      }
    }

    for (const item of arr2) {
      if (item?.container) {
        const uid = getUid(item);
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          merged.push(item);
        }
      } else if (!merged.includes(item)) {
        merged.push(item);
      }
    }

    return merged;
  }

  contentTypes.forEach((obj, idx) => {
    const uid = obj.contentstackUid;
    if (!map.has(uid)) {
      map.set(uid, result.length);
      result.push({ ...obj, fieldMapping: Array.isArray(obj.fieldMapping) ? [...obj.fieldMapping] : [] });
    } else {
      const pos = map.get(uid)!;
      const existing = result[pos];
      if (Array.isArray(obj.fieldMapping)) {
        existing.fieldMapping = mergeContainers(existing.fieldMapping, obj.fieldMapping);
      }
    }
  });

  return result;
}