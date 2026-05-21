import { ContentstackComponent } from '../fields';
import { BooleanField, GroupField, LinkField, TextField } from '../fields/contentstackFields';
import { SchemaProperty } from './index.interface';

const sharedWidgetExclude = [
  'dataLayer',
  ':type',
  'id',
  'cq:isCancelledForChildren'
];

export class SharedWidgetComponent extends ContentstackComponent {
  static isSharedWidget(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/sharedwidget")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/sharedwidget"))
      ) {
        return true;
      }
    }
    return false;
  }

  static fieldTypeMap: Record<string, (key: string, schemaProp: SchemaProperty) => any> = {
    string: (key, schemaProp) => {
      const sampleValue: any = schemaProp?.value;
      const looksLikeUrl = typeof sampleValue === 'string' && /^https?:\/\//.test(sampleValue);
      if (looksLikeUrl || /url$/i.test(key)) {
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

  static mapSharedWidgetToContentstack(component: any, parentKey: any) {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return null;
    const fields: any[] = [];
    for (const [key, value] of Object.entries(properties)) {
      if (sharedWidgetExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && SharedWidgetComponent.fieldTypeMap[schemaProp.type]) {
        const field = SharedWidgetComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
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
