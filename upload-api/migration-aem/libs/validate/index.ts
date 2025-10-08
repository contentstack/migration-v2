import path from "path";
import read from 'fs-readdir-recursive';
import { isExperienceFragment } from "../../helper/component.identifier";
import { readFiles } from "../../helper";
import { CONSTANTS } from "../../constant";

const validator = async (dirPath: string) => {
  const templatesDir = path.resolve(dirPath);
  const templateFiles = read(templatesDir);
  const damPath = path?.resolve?.(path?.join?.(templatesDir, CONSTANTS.AEM_DAM_DIR));

  const results = await Promise.all(
    templateFiles.map(async (fileName: string) => {
      const filePath = path.join(templatesDir, fileName);
      if (filePath.startsWith(damPath)) {
        return null; // Skip this file
      }
      console.log("🚀 ~ validator ~ filePath:", filePath);
      const templateData: any = await readFiles(filePath);
      const isFragment = isExperienceFragment(templateData)?.isXF;
      const hasTemplateType = Boolean(templateData?.['templateType']);
      const hasTemplateName = Boolean(templateData?.['templateName']);
      const hasItems = Boolean(templateData?.[':items']);
      return (hasTemplateType || hasTemplateName || isFragment) && hasItems;
    })
  );

  return results;
}


export default validator;