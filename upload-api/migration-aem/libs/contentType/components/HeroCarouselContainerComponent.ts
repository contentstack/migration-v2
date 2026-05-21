import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';
import { HeroCarouselContentCardComponent } from './HeroCarouselContentCardComponent';

const heroContainerExclude = [
  'dataLayer',
  ':type',
  'id',
  ':items',
  ':itemsOrder',
  ':itemsType'
];

export class HeroCarouselContainerComponent extends ContentstackComponent {
  static isHeroCarouselContainer(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/homepage/heroCarouselContainer")) ||
        (typeof typeField === "object" && typeField.value?.includes("/homepage/heroCarouselContainer"))
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

  static mapHeroCarouselContainerToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;

    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (heroContainerExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && HeroCarouselContainerComponent.fieldTypeMap[schemaProp.type]) {
        const field = HeroCarouselContainerComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
        if (field) fields.push(field);
      }
    }

    // Attach a repeatable child group for the carousel slides (heroCarouselContentCard)
    const itemsProp = properties?.[':items'];
    const itemValues = itemsProp?.properties
      ? Object.values(itemsProp.properties)
      : Array.isArray(itemsProp?.value) ? itemsProp.value : Object.values(itemsProp?.value ?? {});
    const sampleItem = itemValues?.find((v: any) => v && typeof v === 'object');
    if (sampleItem) {
      const childData = { convertedSchema: { type: 'object', properties: (sampleItem as any).properties ?? sampleItem } };
      if (HeroCarouselContentCardComponent.isHeroCarouselContentCard(childData)) {
        const childSchema = HeroCarouselContentCardComponent.mapHeroCarouselContentCardToContentstack(
          childData,
          'heroCarouselContentCard'
        );
        if (childSchema) fields.push(childSchema);
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
