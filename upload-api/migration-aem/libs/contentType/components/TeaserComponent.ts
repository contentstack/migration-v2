import { isImageType } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, ImageField, LinkField, TextField } from "../fields/contentstackFields";
import { SchemaProperty } from "./index.interface";



const teaserExclude = [
  // Add keys or values you want to exclude from navigation mapping
  'dataLayer',
  ':type',
  'path',
  'id',
  'appliedCssClassNames',
  // 'cq:panelTitle'
];

function uidContainsNumber(uid: string): boolean {
  return /\d/.test(uid);
}


export class TeaserComponent extends ContentstackComponent {
  static isTeaser(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" &&
          (/\/components\/(teaser|heroTeaser|overlayBoxTeaser)/.test(typeField) ||
            typeField.includes("/productCategoryTeaserList"))
        ) ||
        (typeof typeField === "object" &&
          (/\/components\/(teaser|heroTeaser|overlayBoxTeaser)/.test(typeField.value ?? "") ||
            (typeField.value ?? "").includes("/productCategoryTeaserList"))
        )
      ) {
        return true;
      }
    }
    return false;
  }


  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty, isImg: boolean) => any> = {
    string: (key, schemaProp, isImg) =>
      isImg ?
        new ImageField({
          uid: key,
          displayName: key,
        }).toContentstack()
        : new TextField({
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
    integer: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      defaultValue: ""
    }).toContentstack(),
    object: (key, schemaProp) => {
      const data = { convertedSchema: schemaProp }
      const objectData = this.mapTeaserToContentstack(data, key);
      if (objectData?.uid && (uidContainsNumber(objectData?.uid) === false) && objectData?.schema?.length) {
        return objectData;
      }
      const urlValue = schemaProp?.properties?.url?.value;
      if (urlValue !== undefined) {
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
        schemaProp?.type === 'array' &&
        schemaProp?.items?.properties &&
        Object.keys(schemaProp?.items?.properties)?.length
      ) {
        const componentsData: any[] = [];
        for (const [key, value] of Object.entries(schemaProp.items.properties)) {
          const schemaProp = value as SchemaProperty;
          if (
            !teaserExclude.includes(key) &&
            schemaProp?.type &&
            TeaserComponent.fieldTypeMap[schemaProp.type]
          ) {
            const isImg = isImageType(schemaProp?.value)
            componentsData.push(
              TeaserComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg)
            );
          }
        }
        return componentsData?.length ? new GroupField({
          uid: key,
          displayName: key,
          fields: componentsData,
          required: false,
          multiple: true
        }).toContentstack() : null;
      }
    },
  };



  static mapTeaserToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const componentsData: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        const schemaProp = value as SchemaProperty;
        if (
          !teaserExclude.includes(key) &&
          schemaProp?.type &&
          TeaserComponent.fieldTypeMap[schemaProp.type]
        ) {
          const isImg = isImageType(schemaProp?.value)
          componentsData.push(
            TeaserComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg)
          );
        }
      }
      return componentsData?.length ? {
        ...new GroupField({
          uid: parentKey,
          displayName: parentKey,
          fields: componentsData,
          required: false,
          multiple: true
        }).toContentstack(),
        type: component?.convertedSchema?.properties?.[":type"]?.value
      } : null;
    }
  }
}