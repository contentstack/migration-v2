import { ContentstackComponent } from '../fields';
import { TextField, BooleanField, GroupField } from "../fields/contentstackFields"
import { SchemaProperty } from './index.interface';


const titleExclude = [
  'dataLayer',
  ':type',
  'id',
];

export class TitleComponent extends ContentstackComponent {

  /**
   * Determines if a component is a title component
   */
  static isTitle(component: any): boolean {
    // Handle raw component format
    if (component && typeof component === 'object') {
      // Direct properties format
      if (component[":type"] &&
        component[":type"].includes("/components/title") &&
        component.type?.match(/^h[1-6]$/)) {
        return true;
      }

      // Properties object format
      if (component.properties &&
        component.properties[":type"]?.value?.includes("/components/title") &&
        component.properties.type?.value?.match(/^h[1-6]$/)) {
        return true;
      }

      // Handle convertedSchema format
      if (component.convertedSchema &&
        component.convertedSchema.properties &&
        component.convertedSchema.properties[":type"]?.value?.includes("/components/title") &&
        component.convertedSchema.properties.type?.value?.match(/^h[1-6]$/)) {
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
    integer: (key, schemaProp) => new TextField({
      uid: key,
      displayName: key,
      description: "",
      isNumber: true,
      defaultValue: ""
    }).toContentstack(),
    object: () => null,
    array: () => null
  };

  /**
   * Maps an AEM title component to Contentstack format with grouped properties
   */
  static mapTitleToContentstack(component: any, parentKey: any): any {
    const properties = component?.convertedSchema?.properties;
    if (!properties) return [];

    const fields: any[] = [];

    for (const [key, value] of Object.entries(properties)) {
      if (titleExclude.includes(key)) continue;
      const schemaProp = value as SchemaProperty;
      if (schemaProp?.type && TitleComponent.fieldTypeMap[schemaProp.type]) {
        fields.push(TitleComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
      }
    }

    const hasTitleOrText = fields.some(f => ['title', 'text'].includes(f.uid));
    if (!hasTitleOrText) {
      fields.push(
        new TextField({
          uid: "text",
          displayName: "text",
          description: "",
          required: false,
          multiline: false
        }).toContentstack()
      );
    }

    return {
      ...new GroupField({
        uid: parentKey,
        displayName: parentKey,
        fields,
        required: false,
        multiple: false
      }).toContentstack(),
      type: component.convertedSchema.properties[":type"]?.value,
    };
  }
}