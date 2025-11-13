import { countComponentTypes, findFirstComponentByType, uidCorrector, scanAllCarouselItemTypes } from "../../../helper";
import { ContentstackComponent } from "../fields";
import { BooleanField, GroupField, TextField } from "../fields/contentstackFields";
import { ButtonComponent, TeaserComponent, ImageComponent, TextBannerComponent, TextComponent, TitleComponent, SearchComponent, SpacerComponent, SeparatorComponent } from "./index";
import { SchemaProperty } from "./index.interface";


const carouselExclude = [
  'dataLayer',
  ':type',
  'id',
  ':itemsOrder'
];

let globalCarouselItemTypes: Set<string> | null = null;

const globalComponentSchemas: Map<string, any> = new Map();

export class CarouselComponent extends ContentstackComponent {
  
  /**
   * Initialize carousel item types by scanning all files
   * Call this BEFORE processing any components
   */
  static async initializeCarouselItemTypes(packagePath: string): Promise<void> {
    if (!globalCarouselItemTypes) {
      globalCarouselItemTypes = await scanAllCarouselItemTypes(packagePath);
    }
  }
  
  /**
   * Store a component schema for later reuse
   */
  static storeComponentSchema(componentType: string, schema: any): void {
    if (!globalComponentSchemas.has(componentType)) {
      globalComponentSchemas.set(componentType, schema);
    }
  }
  
  /**
   * Get a stored component schema
   */
  static getStoredComponentSchema(componentType: string): any | null {
    return globalComponentSchemas.get(componentType) || null;
  }
  
  static isCarousel(component: any): boolean {
    const properties = component?.convertedSchema?.properties;
    if (properties && typeof properties === 'object') {
      const typeField = properties[":type"];
      if (
        (typeof typeField === "string" && typeField.includes("/components/carousel")) ||
        (typeof typeField === "object" && typeField.value?.includes("/components/carousel"))
      ) {
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
    object: (fieldKey: string, schemaProp: SchemaProperty): any => {
      const normalizedUid = uidCorrector(fieldKey);
      const countObject = countComponentTypes(schemaProp.properties);
      const schema: any[] = [];

      // Check if this is the carousel items object
      const isCarouselItems = normalizedUid === 'items' || fieldKey === 'items' || fieldKey === ':items';

      if (isCarouselItems) {
        const typesToProcess = globalCarouselItemTypes && globalCarouselItemTypes.size > 0
          ? globalCarouselItemTypes
          : new Set(Object.keys(countObject).map(t => t.split('/').pop()).filter(Boolean));
        
        // Process each component type
        for (const componentType of typesToProcess) {
          const fullType = `baem/components/${componentType}`;
          const currentData = findFirstComponentByType(schemaProp?.properties, fullType);
          const currentComponent = currentData ? { convertedSchema: { type: 'object', properties: currentData } } : null;
          
          // Map each component type
          if (componentType === 'teaser' || componentType === 'heroTeaser' || componentType === 'overlayBoxTeaser') {
            
            let teaserData = null;
            if (currentComponent && TeaserComponent.isTeaser(currentComponent)) {
              teaserData = TeaserComponent.mapTeaserToContentstack(currentComponent, "teaser");
              if (teaserData) {
                //store for reuse
                CarouselComponent.storeComponentSchema('teaser', teaserData);
              }
            } else {
              // Try to get from stored schemas
              teaserData = CarouselComponent.getStoredComponentSchema('teaser');
              if (teaserData) {
                console.log('Reusing previously stored teaser schema');
              } else {
                console.warn('No teaser schema available (not in current file and not stored yet)');
              }
            }
            
            if (teaserData) {
              const clonedTeaserData = JSON.parse(JSON.stringify(teaserData));
              clonedTeaserData.advanced = {
                ...clonedTeaserData.advanced,
                multiple: true,
                mandatory: false
              };
              schema.push(clonedTeaserData);
            }
          } else if (componentType === 'image') {
            
            let imageData = null;
            if (currentComponent && ImageComponent.isImage(currentComponent)) {
              imageData = ImageComponent.mapImageToContentstack(currentComponent, "image");
              if (imageData) {
                // Store for future reuse
                CarouselComponent.storeComponentSchema('image', imageData);
              }
            } else {
              // Try to get from stored schemas
              imageData = CarouselComponent.getStoredComponentSchema('image');
              if (imageData) {
                console.log('Reusing previously stored image schema');
              }
            }
            
            if (imageData) {
              const clonedImageData = JSON.parse(JSON.stringify(imageData));
              clonedImageData.advanced = {
                ...clonedImageData.advanced,
                multiple: true,
                mandatory: false
              };
              schema.push(clonedImageData);
            }
          } else if (componentType === 'button') {
            let buttonData = null;
            
            if (currentComponent && ButtonComponent.isButton(currentComponent)) {
              buttonData = ButtonComponent.mapButtonToContentstack(currentComponent, "button");
              if (buttonData) {
                CarouselComponent.storeComponentSchema('button', buttonData);
              }
            } else {
              buttonData = CarouselComponent.getStoredComponentSchema('button');
            }
            
            if (buttonData) {
              const clonedData = JSON.parse(JSON.stringify(buttonData));
              clonedData.advanced = {
                ...clonedData.advanced,
                multiple: true,
                mandatory: false
              };
              schema.push(clonedData);
            }
          } else if (componentType === 'textbanner' || componentType === 'textBanner') {
            let textBannerData = null;
            
            if (currentComponent && TextBannerComponent.isTextBanner(currentComponent)) {
              textBannerData = TextBannerComponent.mapTextBannerToContentstack(currentComponent, "textBanner");
              if (textBannerData) {
                CarouselComponent.storeComponentSchema('textbanner', textBannerData);
              }
            } else {
              textBannerData = CarouselComponent.getStoredComponentSchema('textbanner');
            }
            
            if (textBannerData) {
              const clonedData = JSON.parse(JSON.stringify(textBannerData));
              clonedData.advanced = {
                ...clonedData.advanced,
                multiple: true,
                mandatory: false
              };
              schema.push(clonedData);
            }
          } else if (componentType === 'text') {
            let textData = null;
            
            if (currentComponent && TextComponent.isText(currentComponent)) {
              textData = TextComponent.mapTextToContentstack(currentComponent);
              if (textData) {
                CarouselComponent.storeComponentSchema('text', textData);
              }
            } else {
              textData = CarouselComponent.getStoredComponentSchema('text');
            }
            
            if (textData) {
              const clonedData = JSON.parse(JSON.stringify(textData));
              clonedData.multiple = true;
              schema.push(clonedData);
            }
          } else if (componentType === 'title') {
            let titleData = null;
            
            if (currentComponent && TitleComponent.isTitle(currentComponent)) {
              titleData = TitleComponent.mapTitleToContentstack(currentComponent, "title");
              if (titleData) {
                CarouselComponent.storeComponentSchema('title', titleData);
              }
            } else {
              titleData = CarouselComponent.getStoredComponentSchema('title');
            }
            
            if (titleData) {
              const clonedData = JSON.parse(JSON.stringify(titleData));
              clonedData.multiple = true;
              schema.push(clonedData);
            }
          } else if (componentType === 'search') {
            let searchData = null;
            
            if (currentComponent && SearchComponent.isSearch(currentComponent)) {
              searchData = SearchComponent.mapSearchToContentstack(currentComponent, "search");
              if (searchData) {
                CarouselComponent.storeComponentSchema('search', searchData);
              }
            } else {
              searchData = CarouselComponent.getStoredComponentSchema('search');
            }
            
            if (searchData) {
              const clonedData = JSON.parse(JSON.stringify(searchData));
              clonedData.multiple = true;
              schema.push(clonedData);
            }
          } else if (componentType === 'spacer') {
            let spacerData = null;
            
            if (currentComponent && SpacerComponent.isSpacer(currentComponent)) {
              spacerData = SpacerComponent.mapSpacerToContentstack(currentComponent, "spacer");
              if (spacerData) {
                CarouselComponent.storeComponentSchema('spacer', spacerData);
              }
            } else {
              spacerData = CarouselComponent.getStoredComponentSchema('spacer');
            }
            
            if (spacerData) {
              const clonedData = JSON.parse(JSON.stringify(spacerData));
              clonedData.multiple = true;
              schema.push(clonedData);
            }
          } else if (componentType === 'separator') {
            let separatorData = null;
            
            if (currentComponent && SeparatorComponent.isSeparator(currentComponent)) {
              separatorData = SeparatorComponent.mapSeparatorToContentstack(currentComponent, "separator");
              if (separatorData) {
                CarouselComponent.storeComponentSchema('separator', separatorData);
              }
            } else {
              separatorData = CarouselComponent.getStoredComponentSchema('separator');
            }
            
            if (separatorData) {
              const clonedData = JSON.parse(JSON.stringify(separatorData));
              clonedData.multiple = true;
              schema.push(clonedData);
            }
          } else {
            console.warn(`Unknown carousel item type: ${componentType}`);
          }
        }
      }
      if (schema.length === 0) {
        console.warn('Carousel items schema is empty! No components were mapped.');
      }

      return new GroupField({
        uid: normalizedUid,
        displayName: normalizedUid,
        fields: schema,
        required: false,
        multiple: false
      }).toContentstack();
    },
    array: () => null,
  };

  static mapCarouselToContentstack(component: any, parentKey: any) {
    const componentSchema = component?.convertedSchema;
    if (componentSchema?.type === 'object' && componentSchema?.properties) {
      const fields: any[] = [];
      for (const [key, value] of Object.entries(componentSchema.properties)) {
        if (!carouselExclude.includes(key)) {
          const schemaProp = value as SchemaProperty;
          if (schemaProp?.type && CarouselComponent.fieldTypeMap[schemaProp.type]) {
            const mappedField = CarouselComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
            if (mappedField) {
              fields.push(mappedField);
            }
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