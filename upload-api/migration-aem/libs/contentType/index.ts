import path from 'path';
import read from 'fs-readdir-recursive';
import { mergeComponentObjects, readFiles } from "../../helper/index";
import { IConvertContentType } from "./types/index.interface";
import contentTypeMappers from './contentTypeMapper';
import { CONSTANTS } from "../../constant/index"
import { TitleComponent } from './components/TitleComponent';
import { TextComponent } from './components/TextComponent';
import { NavigationComponent } from './components/NavigationComponent';


// Update the function signature to accept either format
function processTitleComponents(components: Record<string, any> | Record<string, any>[]): Record<string, any> | Record<string, any>[] {
  // If components is an array, map through it
  if (Array.isArray(components)) {
    return components.map(component => {
      if (TitleComponent.isTitle(component)) {
        return TitleComponent.mapTitleToContentstack(component);
      }
      return component;
    });
  }

  // If components is an object, process its properties
  else {
    const result: Record<string, any> = {};
    for (const key in components) {
      const component = components[key];
      const mappingRules = [
        () => TitleComponent.isTitle(component) && TitleComponent.mapTitleToContentstack(component),
        () => TextComponent.isText(component) && TextComponent.mapTextToContentstack(component),
        () => NavigationComponent.isNavigation(component) && NavigationComponent.mapNavigationTOContentstack(component, key),
        () => NavigationComponent.isLanguageNavigation(component) && NavigationComponent.mapNavigationTOContentstack(component, key),
        () => component
      ];
      result[key] = mappingRules.map(fn => fn()).find(Boolean);
    }
    console.info("🚀 ~ processTitleComponents ~ result:", result)

    return result;
  }
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
  const contentstackComponents: any = processTitleComponents(mergedComponents);
}



export default convertContentType;