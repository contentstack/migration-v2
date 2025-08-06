import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, TextField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";

const productListingExclude = [
  'dataLayer',
  ':type',
  'id',
  'relativePath'
];

export class ProductListingComponent extends ContentstackComponent {
  static isProductListing(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/productlisting")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/productlisting"))
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

  static mapProductListingToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const componentsData: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        const schemaProp = value as SchemaProperty;
        if (
          !productListingExclude.includes(key) &&
          schemaProp?.type &&
          ProductListingComponent.fieldTypeMap[schemaProp.type]
        ) {
          componentsData.push(
            ProductListingComponent.fieldTypeMap[schemaProp.type](key, schemaProp)
          );
        }
      }
      return componentsData?.length ? {
        ...new GroupField({
          uid: parentKey,
          displayName: parentKey,
          fields: componentsData,
          required: false,
          multiple: false
        }).toContentstack(),
        type: component?.convertedSchema?.properties?.[":type"]?.value
      } : null;
    }
  }
}