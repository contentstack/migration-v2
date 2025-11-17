import path from 'path';
import read from 'fs-readdir-recursive';
import { CONSTANTS } from "../../constant/index"
import contentTypeMappers from './contentTypeMapper';
import contentTypeMaker from './createContentTypes';
import {
  TitleComponent,
  TextComponent,
  NavigationComponent,
  SeparatorComponent,
  SearchComponent,
  NtFolderComponent,
  TeaserComponent,
  SpacerComponent,
  CustomEmbedComponent,
  ProductListingComponent,
  ButtonComponent,
  TextBannerComponent,
  ImageComponent,
  CarouselComponent,
  BreadcrumbComponent
} from './components';
import { mergeComponentObjects, readFiles, writeJsonFile } from "../../helper/index";


// Import interface for the content type conversion function
import { GroupKey, IConvertContentType } from "./types/index.interface";


// Update the function signature to accept either format
function processComponents(components: Record<string, any> | Record<string, any>[]): Record<string, any> | Record<string, any>[] {
  // If components is an array, map through it
  if (Array.isArray(components)) {
    return components.map(component => {
      return component;
    });
  }

  const result: Record<string, any> = {};
  for (const key in components) {
    const component = components[key];
    const mappingRules = [
      () => BreadcrumbComponent.isBreadcrumb(component) && BreadcrumbComponent.mapBreadcrumbToContentstack(component, key),
      () => TitleComponent.isTitle(component) && TitleComponent.mapTitleToContentstack(component, key),
      () => TextBannerComponent.isTextBanner(component) && TextBannerComponent.mapTextBannerToContentstack(component, key),
      () => TextComponent.isText(component) && TextComponent.mapTextToContentstack(component),
      () => NavigationComponent.isNavigation(component) && NavigationComponent.mapNavigationTOContentstack(component, key),
      () => NavigationComponent.isLanguageNavigation(component) && NavigationComponent.mapNavigationTOContentstack(component, key),
      () => SeparatorComponent.isSeparator(component) && SeparatorComponent.mapSeparatorToContentstack(component, key),
      () => SearchComponent.isSearch(component) && SearchComponent.mapSearchToContentstack(component, key),
      () => NtFolderComponent.isNtFolder(component) && NtFolderComponent.mapNtFolderToContentstack(component, key),
      () => TeaserComponent.isTeaser(component) && TeaserComponent.mapTeaserToContentstack(component, key),
      () => SpacerComponent.isSpacer(component) && SpacerComponent.mapSpacerToContentstack(component, key),
      () => CustomEmbedComponent.isCustomEmbed(component) && CustomEmbedComponent.mapCustomEmbedToContentstack(component, key),
      () => ProductListingComponent.isProductListing(component) && ProductListingComponent.mapProductListingToContentstack(component, key),
      () => ButtonComponent.isButton(component) && ButtonComponent.mapButtonToContentstack(component, key),
      () => ImageComponent.isImage(component) && ImageComponent.mapImageToContentstack(component, key),
      () => CarouselComponent.isCarousel(component) && CarouselComponent.mapCarouselToContentstack(component, key),

    ];
    result[key] = mappingRules.map(fn => fn()).find(Boolean);
  }
  return result;
}

const mergeChildComponent = (contentstackComponents: any) => {
  for (const [key, value] of Object.entries(contentstackComponents)) {
    for (const child of Object.values(contentstackComponents)) {
      const childWithType = child as { type: string };
      const valueWithType = value as { type: string, schema: any[] };
      if (
        typeof childWithType?.type === "string" &&
        typeof valueWithType?.type === "string"
      ) {
        const childKey = childWithType?.type?.split("/").pop()
        if (childWithType?.type === `${valueWithType?.type}/${childKey}`) {
          if (valueWithType?.schema) {
            contentstackComponents?.[key]?.schema?.push(child)
          }
        }
      }
    }
  }
  return contentstackComponents;
}

/**
 * Pre-process components to build schema cache for carousel items
 * This ensures all standalone components are mapped before carousels
 */
async function preBuildComponentSchemas(mergedComponents: Record<string, any>) {
  let schemasBuilt = 0;
  
  for (const [key, component] of Object.entries(mergedComponents)) {
    // Process standalone components and store their schemas
    if (TeaserComponent.isTeaser(component)) {
      const schema = TeaserComponent.mapTeaserToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('teaser', schema);
        schemasBuilt++;
      }
    } else if (ImageComponent.isImage(component)) {
      const schema = ImageComponent.mapImageToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('image', schema);
        schemasBuilt++;
      }
    } else if (ButtonComponent.isButton(component)) {
      const schema = ButtonComponent.mapButtonToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('button', schema);
        schemasBuilt++;
      }
    } else if (TextBannerComponent.isTextBanner(component)) {
      const schema = TextBannerComponent.mapTextBannerToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('textbanner', schema);
        schemasBuilt++;
      }
    } else if (TextComponent.isText(component)) {
      const schema = TextComponent.mapTextToContentstack(component);
      if (schema) {
        CarouselComponent.storeComponentSchema('text', schema);
        schemasBuilt++;
      }
    } else if (TitleComponent.isTitle(component)) {
      const schema = TitleComponent.mapTitleToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('title', schema);
        schemasBuilt++;
      }
    } else if (SearchComponent.isSearch(component)) {
      const schema = SearchComponent.mapSearchToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('search', schema);
        schemasBuilt++;
      }
    } else if (SpacerComponent.isSpacer(component)) {
      const schema = SpacerComponent.mapSpacerToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('spacer', schema);
        schemasBuilt++;
      }
    } else if (SeparatorComponent.isSeparator(component)) {
      const schema = SeparatorComponent.mapSeparatorToContentstack(component, key);
      if (schema) {
        CarouselComponent.storeComponentSchema('separator', schema);
        schemasBuilt++;
      }
    }
  }
  
}

const convertContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath);
  await CarouselComponent.initializeCarouselItemTypes(templatesDir);
  
  const templateFiles = read(templatesDir);
  const damPath = path?.resolve?.(path?.join?.(templatesDir, CONSTANTS.AEM_DAM_DIR));
  const allComponentData: Record<string, any>[] = [];
  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    const templateData = await readFiles(filePath);
    const tracker = await contentTypeMappers({ templateData, affix: "cms" });
    const trackerData = tracker.getAllComponents();
    allComponentData.push(trackerData);
  }
  
  const mergedComponents = mergeComponentObjects(allComponentData);
  await preBuildComponentSchemas(mergedComponents);
  const contentstackComponents: any = processComponents(mergedComponents);
  const mergeChildData = mergeChildComponent(contentstackComponents);
  await writeJsonFile(mergeChildData, CONSTANTS.TMP_FILE);
}

const arrangeContentModels = async (
  templatesDir: string,
  groupBy: GroupKey[]
) => {
  const arrangedCt: Record<string, any[]> = {};
  const templateFiles = read(templatesDir);
  const damPath = path?.resolve?.(path?.join?.(templatesDir, CONSTANTS.AEM_DAM_DIR));

  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    if (filePath?.startsWith?.(damPath)) {
      continue;
    }
    const templateData: any = await readFiles(filePath);

    for (const key of groupBy) {
      const groupValue = templateData?.[key];
      if (groupValue) {
        if (!arrangedCt[groupValue]) {
          arrangedCt[groupValue] = [];
        }
        arrangedCt[groupValue].push(templateData);
        break; // Only group by the first matching key
      }
    }
  }
  return arrangedCt;
};


const createContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath);
  const grouped = await arrangeContentModels(templatesDir, CONSTANTS.arrangeCTGroup as GroupKey[]);
  const componentPath = path.resolve(CONSTANTS?.TMP_FILE);
  const contentstackComponents = await readFiles(componentPath);
  return await contentTypeMaker({ templateData: grouped, contentstackComponents, affix: "cms" })
}

const contentTypes = () => {
  return {
    convertAndCreate: async (dirPath: string) => {
      await convertContentType(dirPath);
      return await createContentType(dirPath);
    }
  };
}

export default contentTypes;
