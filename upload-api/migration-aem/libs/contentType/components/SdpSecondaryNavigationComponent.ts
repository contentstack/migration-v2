import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const sdpSecondaryNavExclude = [
  'dataLayer',
  ':type',
  'id'
];

const linkLikeKeyPattern = /(url|link|href)$/i;

export class SdpSecondaryNavigationComponent extends ContentstackComponent {
  static isSdpSecondaryNavigation(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/sdpSecondaryNavigation")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/sdpSecondaryNavigation"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key) => {
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
    array: (key, schemaProp) => {
      const itemType = schemaProp?.items?.type;
      if (itemType === 'string' || itemType === 'integer') {
        // Array of primitives — emit as a multi-value text field
        return {
          ...new TextField({
            uid: key,
            displayName: key,
            description: "",
            defaultValue: "",
            isNumber: itemType === 'integer'
          }).toContentstack(),
          multiple: true
        };
      }
      return null;
    }
  };

  static mapSdpSecondaryNavigationToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (sdpSecondaryNavExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && SdpSecondaryNavigationComponent.fieldTypeMap[schemaProp.type]) {
        const field = SdpSecondaryNavigationComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
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
