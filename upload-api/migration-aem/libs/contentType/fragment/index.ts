import path from "path";
import { CONSTANTS } from "../../../constant";
import { readFiles, writeJsonFile } from "../../../helper";
import { ReferenceField } from "../fields/contentstackFields";

export const createFragmentComponent = async (
  segmentData: string[],
  itemData: any,
  contentstackComponents: any
) => {
  const key = segmentData?.[0];
  if (!key) {
    console.info('Fragment key does not exist. itemsOrder:', itemData?.[':itemsOrder']);
    return null;
  }

  const fragmentPath = path.resolve(CONSTANTS?.FRAGMENT_FILE);
  const data: any = (await readFiles(fragmentPath)) ?? {};

  // Ensure data[key] is an array
  if (!Array.isArray(data[key])) {
    data[key] = [];
  }

  // Iterate over items and push to fragment array, avoiding duplicates
  for (const [itemKey, objValue] of Object.entries(itemData?.[':items']?.root?.[':items'] ?? {})) {
    const type = (objValue as { [key: string]: any })[':type'];
    // Find matching entry in contentstackComponents by type
    const foundEntry = Object.entries(contentstackComponents ?? {}).find(
      ([, csValue]: any) => (csValue as { [key: string]: any })['type'] === type
    );
    if (foundEntry) {
      const [, csValue] = foundEntry;
      const obj: any = { [itemKey]: csValue };
      if (!data[key].some((existing: any) => JSON.stringify(existing) === JSON.stringify(obj))) {
        data[key].push(obj);
      }
    }
  }

  // Remove empty objects from the fragment array
  data[key] = data[key].filter((entry: any) => Object.keys(entry).length > 0);

  // Write updated data back to file
  await writeJsonFile(data, fragmentPath);

  if (data[key].length) {
    return new ReferenceField({
      uid: key,
      displayName: key,
      refrenceTo: [key]
    }).toContentstack();
  }
  return null;
}