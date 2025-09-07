import { ContentstackComponent } from '../fields';
import { v4 as uuidv4 } from 'uuid';

export class TextComponent extends ContentstackComponent {
  /**
   * Determines if a component is a text component
   */
  static isText(component: any): boolean {
    if (component && typeof component === 'object') {
      // Direct properties format
      if (
        component[":type"] &&
        (
          component[":type"].includes("/components/text") ||
          component[":type"].includes("/components/richText")
        )
      ) {
        return true;
      }
      // Properties object format
      if (
        component.properties &&
        (
          component.properties[":type"]?.value?.includes("/components/text") ||
          component.properties[":type"]?.value?.includes("/components/richText")
        )
      ) {
        return true;
      }
      // Handle convertedSchema format
      if (
        component.convertedSchema &&
        component.convertedSchema.properties &&
        (
          component.convertedSchema.properties[":type"]?.value?.includes("/components/text") ||
          component.convertedSchema.properties[":type"]?.value?.includes("/components/richText")
        )
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extracts the 'richText' property from a text component
   */
  static processTextComponents(component: any): boolean | undefined {
    if (
      component &&
      component.convertedSchema &&
      component.convertedSchema.properties &&
      component.convertedSchema.properties.richText &&
      typeof component.convertedSchema.properties.richText.value === "boolean"
    ) {
      return component.convertedSchema.properties.richText.value;
    }
    return undefined;
  }

  /**
   * Maps a text component to Contentstack rich text schema format
   */
  static mapTextToContentstack(component: any): any {
    const id = uuidv4();
    const name = 'text';
    const type = 'Rich Text';
    const uid = 'text';
    const default_value = component?.convertedSchema?.properties?.text?.value || '';

    const isRichText = this.processTextComponents(component) ?? this.isText(component);
    if (isRichText) {
      return {
        id,
        uid: name,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'json',
        backupFieldType: 'json',
        backupFieldUid: 'json',
        advanced: { default_value: default_value !== '' ? default_value : null },
        type: component?.convertedSchema?.properties?.[":type"]?.value
      };
    }
    return null;
  }
}