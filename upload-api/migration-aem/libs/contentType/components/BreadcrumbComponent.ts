import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const breadcrumbExclude = [
  'dataLayer',
  ':type',
  'path',
  'id'
];

export class BreadcrumbComponent extends ContentstackComponent {
  static isBreadcrumb(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("components/navigation/breadcrumb")) ||
        (typeof typeField === "object" && typeField.value?.includes("components/navigation/breadcrumb"))
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
    object: (key, schemaProp) => {
      // For breadcrumb, handle the link object
      if (schemaProp?.properties?.url?.value !== undefined) {
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
        for (const [itemKey, itemValue] of Object.entries(schemaProp.items.properties)) {
          const itemSchemaProp = itemValue as SchemaProperty;
          if (
            !breadcrumbExclude.includes(itemKey) &&
            itemSchemaProp?.type &&
            BreadcrumbComponent.fieldTypeMap[itemSchemaProp.type]
          ) {
            componentsData.push(
              BreadcrumbComponent.fieldTypeMap[itemSchemaProp.type](itemKey, itemSchemaProp)
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

  static mapBreadcrumbToContentstack(component: any, parentKey: any): any {
    const breadcrumbItems = component?.convertedSchema?.properties?.breadcrumbLinkItems;
    if (breadcrumbItems?.type === 'array' && breadcrumbItems?.items?.properties) {
      const componentsData: any[] = [];
      for (const [key, value] of Object.entries(breadcrumbItems.items.properties)) {
        const schemaProp = value as SchemaProperty;
        if (
          !breadcrumbExclude.includes(key) &&
          schemaProp?.type &&
          BreadcrumbComponent.fieldTypeMap[schemaProp.type]
        ) {
          componentsData.push(
            BreadcrumbComponent.fieldTypeMap[schemaProp.type](key, schemaProp)
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
  }
}