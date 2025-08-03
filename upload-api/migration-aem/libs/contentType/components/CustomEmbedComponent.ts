// item.name = 


import { uidCorrector } from '../../../helper';
import { ContentstackComponent } from '../fields';


export class CustomEmbedComponent extends ContentstackComponent {
  /**
   * Determines if a component is a custom embed component
   */
  static isCustomEmbed(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/customembed")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/customembed"))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Maps the custom embed component schema to Contentstack fields
   */
  static mapCustomEmbedToContentstack(component: any, parentKey: any): any {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object') {
      const embedType = componentSchema?.properties?.type?.value;
      let appName;
      switch (embedType) {
        case 'EMBEDDABLE': {
          appName = componentSchema?.properties?.embeddableResourceType?.value?.includes('/embeddable/youtube') ? 'Youtube' : null;
          break;
        }
        case 'HTML': {
          appName = 'Html';
          break;
        }
        case 'URL': {
          appName = 'Url';
          break;
        }
        default:
          appName = null;
          break;
      }
      if (appName !== null) {
        appName = `${parentKey} (${appName}-App)`;
        return {
          uid: appName,
          otherCmsField: appName,
          otherCmsType: 'customembed',
          contentstackField: appName,
          contentstackFieldUid: uidCorrector(parentKey),
          contentstackFieldType: 'app',
          backupFieldType: 'app',
          backupFieldUid: uidCorrector(parentKey),
          advanced: {},
        }
      }
      return null;
    }
  }
}