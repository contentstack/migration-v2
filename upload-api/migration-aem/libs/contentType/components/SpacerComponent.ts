import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const spacerExclude = [
  'dataLayer',
  ':type',
  'id',
  'relativePath'
];

export class SpacerComponent extends ContentstackComponent {
  /**
   * Determines if a component is a spacer component
   */
  static isSpacer(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/spacer")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/spacer"))
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
      defaultValue: schemaProp.value
    }).toContentstack(),
    boolean: (key, schemaProp) => new BooleanField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: schemaProp.value
    }).toContentstack(),
    integer: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      isNumber: true,
      defaultValue: schemaProp.value
    }).toContentstack(),
    object: () => null,
    array: () => null
  };

  /**
   * Maps the spacer component schema to Contentstack fields
   */
  static mapSpacerToContentstack(component: any, parentKey: any): any {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return [];
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (spacerExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && SpacerComponent.fieldTypeMap[schemaProp.type]) {
        fields.push(SpacerComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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