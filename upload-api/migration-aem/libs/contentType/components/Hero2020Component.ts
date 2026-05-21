import { isImageType } from '../../../helper';
import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, ImageField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const hero2020Exclude = [
  'dataLayer',
  ':type',
  'id',
  'cq:isCancelledForChildren'
];

const linkLikeKeyPattern = /(url|link|href)$/i;

export class Hero2020Component extends ContentstackComponent {
  static isHero2020(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/hero2020")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/hero2020"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => {
      const v = schemaProp?.value;
      if (typeof v === 'string' && isImageType(v)) {
        return new ImageField({
          uid: key,
          displayName: key
        }).toContentstack();
      }
      if (linkLikeKeyPattern.test(key)) {
        return new LinkField({
          uid: key,
          displayName: key
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

  static mapHero2020ToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (hero2020Exclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && Hero2020Component.fieldTypeMap[schemaProp.type]) {
        const field = Hero2020Component.fieldTypeMap[schemaProp.type](key, schemaProp);
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
