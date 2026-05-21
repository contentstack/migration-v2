import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const heroCardExclude = [
  'dataLayer',
  ':type',
  'id',
  'cq:panelTitle'
];

const urlLikeKeys = /(url|link|href)$/i;

export class HeroCarouselContentCardComponent extends ContentstackComponent {
  static isHeroCarouselContentCard(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/homepage/heroCarouselContentCard")) ||
        (typeof typeField === "object" && typeField.value?.includes("/homepage/heroCarouselContentCard"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key) => {
      if (urlLikeKeys.test(key)) {
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

  static mapHeroCarouselContentCardToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (heroCardExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && HeroCarouselContentCardComponent.fieldTypeMap[schemaProp.type]) {
        const field = HeroCarouselContentCardComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
        if (field) fields.push(field);
      }
    }
    return {
      ...new GroupField({
        uid: parentKey,
        displayName: parentKey,
        fields,
        required: false,
        multiple: true
      }).toContentstack(),
      type: properties?.[":type"]?.value
    };
  }
}
