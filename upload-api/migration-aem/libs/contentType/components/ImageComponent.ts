import { isImageType } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, TextField, ImageField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";

const imageExclude = [
  'dataLayer',
  ':type',
  'id',
  //no need for this in contentstack its can handle by api call
  'srcUriTemplate'
];

export class ImageComponent extends ContentstackComponent {
  static isImage(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/image")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/image"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty, isImg?: boolean) => any> = {
    string: (key, schemaProp, isImg) => {

      return isImg ?
        new ImageField({
          uid: key,
          displayName: key,
        }).toContentstack()
        : new TextField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: schemaProp.value
        }).toContentstack()
    },
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
      defaultValue: schemaProp.value,
      isNumber: true
    }).toContentstack(),
    object: () => null,
    array: () => null
  };

  static mapImageToContentstack(component: any, parentKey: string) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const fields: any[] = [];

      // Add essential image fields first
      const essentialFields = ['alt', 'src', 'link'];

      for (const fieldName of essentialFields) {
        const schemaProp = componentSchema.properties[fieldName] as SchemaProperty;
        const isImg = isImageType(schemaProp?.value)
        if (schemaProp?.type && ImageComponent.fieldTypeMap[schemaProp.type]) {
          fields.push(ImageComponent.fieldTypeMap[schemaProp.type](fieldName, schemaProp, isImg));
        }
      }

      // Add remaining fields
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        if (!imageExclude.includes(key) && !essentialFields.includes(key)) {
          const schemaProp = value as SchemaProperty;
          if (schemaProp?.type && ImageComponent.fieldTypeMap[schemaProp.type]) {
            fields.push(ImageComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
          }
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
    return null;
  }
}