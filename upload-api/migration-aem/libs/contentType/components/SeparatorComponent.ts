import { ContentstackComponent } from '../fields';
import { BooleanField } from '../fields/contentstackFields';

export class SeparatorComponent extends ContentstackComponent {
  /**
   * Determines if a component is a separator component
   */
  static isSeparator(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/separator")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/separator"))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Maps the separator component to Contentstack format
   */
  static mapSeparatorToContentstack(component: any, parentKey?: any): any {
    // You can customize this mapping as needed for your use case
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