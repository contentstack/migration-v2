import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';


const navigationExclude = [
  // Add keys or values you want to exclude from navigation mapping
  'dataLayer',
  ':type',
  'path',
  'id'
];

export class NavigationComponent extends ContentstackComponent {
  /**
   * Determines if a component is a text component
   */
  static isNavigation(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/navigation")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/navigation"))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
 * Determines if a component is a language navigation component
 */
  static isLanguageNavigation(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/languagenavigation")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/languagenavigation"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: ""
    }).toContentstack(),
    boolean: (key, schemaProp) => new BooleanField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: false
    }).toContentstack(),
    integer: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      isNumber: true,
      defaultValue: ""
    }).toContentstack(),
    object: (key, schemaProp) => {
      const urlValue = schemaProp?.properties?.url?.value;
      if (urlValue !== undefined) {
        return new LinkField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: ""
        }).toContentstack();
      }
      return null;
    },
    array: (key, schemaProp) => {
      if (
        schemaProp?.value?.length &&
        schemaProp?.type === 'array' &&
        schemaProp?.items?.properties
      ) {
        const componentsData: any[] = [];
        for (const [key, value] of Object.entries(schemaProp.items.properties)) {
          const schemaProp = value as SchemaProperty;
          if (
            !navigationExclude.includes(key) &&
            schemaProp?.type &&
            NavigationComponent.fieldTypeMap[schemaProp.type]
          ) {
            componentsData.push(
              NavigationComponent.fieldTypeMap[schemaProp.type](key, schemaProp)
            );
          }
        }
        return new GroupField({
          uid: key,
          displayName: key,
          fields: componentsData,
          required: false,
          multiple: true
        }).toContentstack();
      }
      return null;
    }
  };



  /**
 * Maps the title property of a navigation component to Contentstack format
 */
  static mapNavigationTOContentstack(component: any, parentKey: any): any {
    const componentSchema = component?.convertedSchema?.properties?.items;
    if (componentSchema?.type === 'array' && componentSchema?.items?.properties) {
      const componentsData: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.items.properties)) {
        const schemaProp = value as SchemaProperty;
        if (
          !navigationExclude.includes(key) &&
          schemaProp?.type &&
          NavigationComponent.fieldTypeMap[schemaProp.type]
        ) {
          componentsData.push(
            NavigationComponent.fieldTypeMap[schemaProp.type](key, schemaProp)
          );
        }
      }
      return {
        ...new GroupField({
          uid: parentKey,
          displayName: parentKey,
          fields: componentsData,
          required: false,
          multiple: true
        }).toContentstack(),
        type: component?.convertedSchema?.properties?.[":type"]?.value
      };
    }
    return [];
  }

}     