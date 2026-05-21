import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const exploreBarExclude = [
  'dataLayer',
  ':type',
  'id'
];

export class ExploreBarComponent extends ContentstackComponent {
  static isExploreBar(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/explorebar")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/explorebar"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: ""
    }).toContentstack(),
    boolean: (key) => new BooleanField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: false
    }).toContentstack(),
    integer: (key) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      isNumber: true,
      defaultValue: ""
    }).toContentstack(),
    object: () => null,
    array: () => null
  };

  static mapExploreBarToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (exploreBarExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && ExploreBarComponent.fieldTypeMap[schemaProp.type]) {
        const field = ExploreBarComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
        if (field) fields.push(field);
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
      type: properties?.[":type"]?.value
    };
  }
}
