import path from 'path';
import read from 'fs-readdir-recursive';
import { readFiles } from "../../helper/index";
import { IConvertContentType } from "./types/index.interface";
import contentTypeMappers from './contentTypeMapper';
import { CONSTANTS } from "../../constant/index"


const convertContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath, CONSTANTS?.TEMPLATE_DIR);
  const templateFiles = read(templatesDir);
  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    const templateData = await readFiles(filePath);
    return await contentTypeMappers({ templateData, affix: "cms" });
  }
}



export default convertContentType;