import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const configurableFooterExclude = [
  'dataLayer',
  ':type',
  'id'
];

export class ConfigurableFooterComponent extends ContentstackComponent {
  static isConfigurableFooter(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/structure/configurablefooter")) ||
        (typeof typeField === "object" && typeField.value?.includes("/structure/configurablefooter"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => {
      // AEM exposes booleans as "true"/"false" strings here
      const v = schemaProp?.value;
      if (typeof v === 'string' && (v === 'true' || v === 'false')) {
        return new BooleanField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: v === 'true'
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

  static mapConfigurableFooterToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (configurableFooterExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && ConfigurableFooterComponent.fieldTypeMap[schemaProp.type]) {
        const field = ConfigurableFooterComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
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
