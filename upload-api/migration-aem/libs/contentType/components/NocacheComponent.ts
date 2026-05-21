import { ContentstackComponent } from '../fields';
import { BooleanField } from '../fields/contentstackFields';

/**
 * `msi-occ/components/pressrelease/nocache` is a structural marker
 * with no configurable fields. We expose it as a boolean toggle.
 */
export class NocacheComponent extends ContentstackComponent {
  static isNocache(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      const typeValue = typeof typeField === "string" ? typeField : typeField?.value;
      return typeof typeValue === 'string' && /\/pressrelease\/nocache$/.test(typeValue);
    }
    return false;
  }

  static mapNocacheToContentstack(component: any, parentKey: any) {
    return {
      ...new BooleanField({
        uid: parentKey,
        displayName: parentKey,
        description: "",
        defaultValue: true
      }).toContentstack(),
      type: component?.convertedSchema?.properties?.[":type"]?.value
    };
  }
}
