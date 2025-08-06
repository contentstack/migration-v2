import { isHtmlString } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, TextField, JsonField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";

const textBannerExclude = [
  'dataLayer',
  ':type',
  'id'
];

export class TextBannerComponent extends ContentstackComponent {
  static isTextBanner(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/textbanner")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/textbanner"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => {
      return isHtmlString(schemaProp.value) ?
        new JsonField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: schemaProp.value
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
      isNumber: true,
      defaultValue: schemaProp.value
    }).toContentstack(),
    object: () => null,
    array: (key, schemaProp) => {
      // For actions array
      if (
        schemaProp?.type === 'array' &&
        schemaProp.items?.type === 'object' &&
        schemaProp.items?.properties
      ) {
        const fields: any[] = [];
        for (const [itemKey, itemProp] of Object.entries(schemaProp.items.properties)) {
          if (!textBannerExclude.includes(itemKey)) {
            const prop = itemProp as SchemaProperty;
            if (prop?.type && TextBannerComponent.fieldTypeMap[prop.type]) {
              fields.push(TextBannerComponent.fieldTypeMap[prop.type](itemKey, prop));
            }
          }
        }
        return new GroupField({
          uid: key,
          displayName: key,
          fields,
          required: false,
          multiple: true
        }).toContentstack();
      }
      return null;
    }
  };

  static mapTextBannerToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const fields: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        if (!textBannerExclude.includes(key)) {
          const schemaProp = value as SchemaProperty;
          if (schemaProp?.type && TextBannerComponent.fieldTypeMap[schemaProp.type]) {
            fields.push(TextBannerComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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