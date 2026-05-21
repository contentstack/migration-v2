import { isHtmlString } from '../../../helper';
import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, JsonField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const genericHtmlExclude = [
  'dataLayer',
  ':type',
  'id'
];

export class GenericHtmlComponent extends ContentstackComponent {
  static isGenericHtml(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/generichtml")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/generichtml"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => {
      const v = schemaProp?.value;
      if (typeof v === 'string' && isHtmlString(v)) {
        return new JsonField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: ""
        }).toContentstack();
      }
      return new TextField({
        uid: key,
        displayName: key,
        description: "",
        defaultValue: ""
      }).toContentstack();
    },
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

  static mapGenericHtmlToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (genericHtmlExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && GenericHtmlComponent.fieldTypeMap[schemaProp.type]) {
        const field = GenericHtmlComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
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
