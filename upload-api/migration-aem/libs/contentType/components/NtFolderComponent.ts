import { ContentstackComponent } from '../fields';
import { ReferenceField } from '../fields/contentstackFields';



export class NtFolderComponent extends ContentstackComponent {
  /**
   * Determines if a component is an nt:folder component
   */
  static isNtFolder(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField === "nt:folder") ||
        (typeof typeField === "object" && typeField.value === "nt:folder")
      ) {
        return true;
      }
    }
    return false;
  }


  /**
   * Maps the nt:folder component to Contentstack format
   */
  static mapNtFolderToContentstack(component: any, parentKey: any): any {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      componentSchema.properties[':type']
      return {
        ...new ReferenceField({
          uid: parentKey,
          displayName: parentKey,
          refrenceTo: []
        }).toContentstack(),
        type: component?.convertedSchema?.properties?.[":type"]?.value
      };
    }
    return [];
  }
}