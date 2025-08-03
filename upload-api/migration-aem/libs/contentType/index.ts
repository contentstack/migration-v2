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
  TextBannerComponent
} from './components';
import { mergeComponentObjects, readFiles, writeJsonFile } from "../../helper/index";


// Import interface for the content type conversion function
import { IConvertContentType } from "./types/index.interface";


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
      () => TitleComponent.isTitle(component) && TitleComponent.mapTitleToContentstack(component, key),
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
      () => TextBannerComponent.isTextBanner(component) && TextBannerComponent.mapTextBannerToContentstack(component, key),
      () => component
    ];
    result[key] = mappingRules.map(fn => fn()).find(Boolean);
  }
  return result;
}



const convertContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath, CONSTANTS?.TEMPLATE_DIR);
  const templateFiles = read(templatesDir);
  const allComponentData: Record<string, any>[] = [];
  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    const templateData = await readFiles(filePath);
    const tracker = await contentTypeMappers({ templateData, affix: "cms" });
    const trackerData = tracker.getAllComponents();
    allComponentData.push(trackerData);
  }
  const mergedComponents = mergeComponentObjects(allComponentData);
  const contentstackComponents: any = processComponents(mergedComponents);
  await writeJsonFile(contentstackComponents, CONSTANTS.TMP_FILE);
}

const createContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath, CONSTANTS?.TEMPLATE_DIR);
  const templateFiles = read(templatesDir);
  // const allComponentData: Record<string, any>[] = [];
  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    const componentPath = path.resolve(CONSTANTS?.TMP_FILE);
    const templateData = await readFiles(filePath);
    const contentstackComponents = await readFiles(componentPath);
    contentTypeMaker({ templateData, contentstackComponents, affix: "cms" })
  }
}

const contentTypes = () => {
  return {
    convert: convertContentType,
    create: createContentType
  };
}

export default contentTypes;
