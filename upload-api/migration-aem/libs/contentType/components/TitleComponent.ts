import { ContentstackComponent } from '../fields';
import { TextField, SelectField, BooleanField } from "../fields/contentstackFields"

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

  /**
   * Maps an AEM title component to Contentstack format with grouped properties
   */
  static mapTitleToContentstack(component: any): any {
    const componentIdField = new TextField({
      uid: "component_id",
      displayName: "Component ID",
      description: "Unique identifier for the title component"
    });
    const contentText = new TextField({
      uid: "text",
      displayName: "Text Content",
      description: "The text content",
      required: false,
      multiline: false
    });
    const linkDisabled = new BooleanField({
      uid: "link_disabled",
      displayName: "Link Disabled",
      description: "Whether the title has linking disabled",
      defaultValue: false
    })
    return [componentIdField.toContentstack(), contentText.toContentstack(), linkDisabled.toContentstack()]
  }
}