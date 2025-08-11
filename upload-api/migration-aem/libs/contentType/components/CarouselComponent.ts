import { countComponentTypes, findFirstComponentByType, uidCorrector } from "../../../helper";
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

export class CarouselComponent extends ContentstackComponent {
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
      defaultValue: schemaProp.value
    }).toContentstack(),
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
    object: (fieldKey: string, schemaProp: SchemaProperty): any => {
      const normalizedUid = uidCorrector(fieldKey)
      const countObject = countComponentTypes(schemaProp.properties);
      const schema: any[] = [];

      for (const [type, count] of Object.entries(countObject as Record<string, number>)) {
        const data = findFirstComponentByType(schemaProp?.properties, type);
        if (!data) continue; // skip if not found

        // Correct way to build the component object
        const component = { convertedSchema: { type: 'object', properties: data } };
        const isMultiple = count > 1;

        const componentActions: [
          any, string, (comp: any, isMultiple?: boolean) => void
        ][] = [
            [ImageComponent, "isImage", (comp, isMultiple) => {
              const imageData = ImageComponent.mapImageToContentstack(comp, "image");
              if (imageData && isMultiple) imageData.advanced.multiple = true;
              if (imageData) schema.push(imageData);
            }],
            [TeaserComponent, "isTeaser", (comp, isMultiple) => {
              const teaserData = TeaserComponent.mapTeaserToContentstack(comp, "teaser");
              if (teaserData && isMultiple) teaserData.advanced.multiple = true;
              if (teaserData) schema.push(teaserData);
            }],
            [ButtonComponent, "isButton", (comp, isMultiple) => {
              const buttonData = ButtonComponent.mapButtonToContentstack(comp, "button");
              if (buttonData && isMultiple) buttonData.advanced.multiple = true;
              if (buttonData) schema.push(buttonData);
            }],
            [TextBannerComponent, "isTextBanner", (comp, isMultiple) => {
              const textBannerData = TextBannerComponent.mapTextBannerToContentstack(comp, "textBanner");
              if (textBannerData && isMultiple) textBannerData.advanced.multiple = true;
              if (textBannerData) schema.push(textBannerData);
            }],
            [TextComponent, "isText", (comp, isMultiple) => {
              const textData = TextComponent.mapTextToContentstack(comp);
              if (textData && isMultiple) textData.multiple = true;
              if (textData) schema.push(textData);
            }],
            [TitleComponent, "isTitle", (comp, isMultiple) => {
              const titleData = TitleComponent.mapTitleToContentstack(comp, "title");
              if (titleData && isMultiple) titleData.multiple = true;
              if (titleData) schema.push(titleData);
            }],
            [SearchComponent, "isSearch", (comp, isMultiple) => {
              const searchData = SearchComponent.mapSearchToContentstack(comp, "search");
              if (searchData && isMultiple) searchData.multiple = true;
              if (searchData) schema.push(searchData);
            }],
            [SpacerComponent, "isSpacer", (comp, isMultiple) => {
              const spacerData = SpacerComponent.mapSpacerToContentstack(comp, "spacer");
              if (spacerData && isMultiple) spacerData.multiple = true;
              if (spacerData) schema.push(spacerData);
            }],
            [SeparatorComponent, "isSeparator", (comp, isMultiple) => {
              const separatorData = SeparatorComponent.mapSeparatorToContentstack(comp, "separator");
              if (separatorData && isMultiple) separatorData.multiple = true;
              if (separatorData) schema.push(separatorData);
            }],
          ];

        componentActions.forEach(([Comp, method, action]) => {
          if (Comp?.[method]?.(component)) {
            action(component, isMultiple);
          }
        });
      }
      return new GroupField({
        uid: normalizedUid,
        displayName: normalizedUid,
        fields: schema,
        required: false,
        multiple: false
      }).toContentstack()
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
            fields.push(CarouselComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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