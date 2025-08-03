import { isImageType, isUrlPath } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, ImageField, LinkField, TextField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";

const buttonExclude = [
  'dataLayer',
  ':type',
  'path',
  'id',
  'appliedCssClassNames'
];

export class ButtonComponent extends ContentstackComponent {
  static isButton(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/button")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/button"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty, isImg: boolean, isUrl?: boolean) => any> = {
    string: (key, schemaProp, isImg, isURl = false) => {
      if (isURl) {
        return new LinkField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: "",
        }).toContentstack();
      }
      return isImg ? new ImageField({
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
      isNumber: true,
      defaultValue: schemaProp.value
    }).toContentstack(),
    object: (key, schemaProp) => {
      const urlValue = schemaProp?.properties?.url?.value;
      if (urlValue !== undefined) {
        return new LinkField({
          uid: key,
          displayName: key,
          description: "",
          defaultValue: urlValue
        }).toContentstack();
      }
      return null;
    },
    array: () => null,
  };

  static mapButtonToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const componentsData: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        const schemaProp = value as SchemaProperty;
        if (
          !buttonExclude.includes(key) &&
          schemaProp?.type &&
          ButtonComponent.fieldTypeMap[schemaProp.type]
        ) {
          const isImg = isImageType(schemaProp?.value)
          const isUrl = isUrlPath(schemaProp?.value)
          componentsData.push(
            ButtonComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg, isUrl)
          );
        }
      }
      return componentsData?.length ? new GroupField({
        uid: parentKey,
        displayName: parentKey,
        fields: componentsData,
        required: false,
        multiple: false
      }).toContentstack() : null;
    }
  }
}