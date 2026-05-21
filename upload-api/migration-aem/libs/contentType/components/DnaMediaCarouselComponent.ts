import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const dnaMediaCarouselExclude = [
  'dataLayer',
  ':type',
  'id'
];

export class DnaMediaCarouselComponent extends ContentstackComponent {
  static isDnaMediaCarousel(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/homepage/dnaMediaCarousel")) ||
        (typeof typeField === "object" && typeField.value?.includes("/homepage/dnaMediaCarousel"))
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

  static mapDnaMediaCarouselToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (dnaMediaCarouselExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && DnaMediaCarouselComponent.fieldTypeMap[schemaProp.type]) {
        const field = DnaMediaCarouselComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
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
