import path from 'path';
import read from 'fs-readdir-recursive';
import { mergeComponentObjects, readFiles, writeJsonFile } from "../../helper/index";
import { IConvertContentType } from "./types/index.interface";
import contentTypeMappers from './contentTypeMapper';
import { CONSTANTS } from "../../constant/index"
import { TitleComponent } from './components/TitleComponent';
import { TextComponent } from './components/TextComponent';
import { NavigationComponent } from './components/NavigationComponent';
import { SeparatorComponent } from './components/SeparatorComponent';
import { SearchComponent } from './components/SearchComponent';


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
      () => JSON.stringify({ key, component })
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



export default convertContentType; 