import { ContentstackComponent } from '../fields';

export class TextComponent extends ContentstackComponent {
  /**
   * Determines if a component is a text component
   */
  static isText(component: any): boolean {
    if (component && typeof component === 'object') {
      // Direct properties format
      if (component[":type"] && component[":type"].includes("/components/text")) {
        return true;
      }
      // Properties object format
      if (component.properties && component.properties[":type"]?.value?.includes("/components/text")) {
        return true;
      }
      // Handle convertedSchema format
      if (
        component.convertedSchema &&
        component.convertedSchema.properties &&
        component.convertedSchema.properties[":type"]?.value?.includes("/components/text")
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
    const id = component?.convertedSchema?.properties?.id?.value || '';
    const name = 'text';
    const type = 'Rich Text';
    const uid = 'text';
    const default_value = component?.convertedSchema?.properties?.text?.value || '';

    const isRichText = this.processTextComponents(component);
    if (isRichText) {
      return {
        id: id,
        uid: name,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'json',
        backupFieldType: 'json',
        backupFieldUid: 'json',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    return null;
  }
}