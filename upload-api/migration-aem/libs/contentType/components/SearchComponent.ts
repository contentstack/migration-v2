import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields'; // ADD NumberField
import { SchemaProperty } from './index.interface';

const searchExclude = [
  'dataLayer',
  ':type',
  'id',
  'relativePath',
  'searchRootPagePath'
];

export class SearchComponent extends ContentstackComponent {
  /**
   * Determines if a component is a search component
   */
  static isSearch(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/search")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/search"))
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
      defaultValue: ""
    }).toContentstack(),
    object: () => null,
    array: () => null
  };

  /**
   * Maps the search component schema to Contentstack fields
   */
  static mapSearchToContentstack(component: any, parentKey: any): any {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return [];
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (searchExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && SearchComponent.fieldTypeMap[schemaProp.type]) {
        fields.push(SearchComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
      }
    }
    return {
      ...new GroupField({
        uid: parentKey,
        displayName: parentKey,
        fields,
        required: false,
        multiple: false
      }).toContentstack(),
      type: component?.convertedSchema?.properties?.[":type"]?.value
    };
  }
}