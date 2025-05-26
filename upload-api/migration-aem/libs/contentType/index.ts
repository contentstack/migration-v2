import path from 'path';
import read from 'fs-readdir-recursive';
import { readFiles } from "../../helper/index";
import { IConvertContentType } from "./types/index.interface";


const convertContentType: IConvertContentType = async (dirPath) => {
  const templatesDir = path.resolve(dirPath, 'templates');
  const templateFiles = read(templatesDir);
  for await (const fileName of templateFiles) {
    const filePath = path.join(templatesDir, fileName);
    const templateData = await readFiles(filePath);
    console.info("🚀 ~ forawait ~ filePath:", templateData)
  }
}



export default convertContentType;