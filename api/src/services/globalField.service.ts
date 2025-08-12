import { getLogMessage, safePromise } from "../utils/index.js";
import getAuthtoken from "../utils/auth.utils.js";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import fs from 'fs';
import { HTTP_TEXTS, MIGRATION_DATA_CONFIG} from "../constants/index.js";
import path from "path";
import logger from "../utils/logger.js";

const {
  GLOBAL_FIELDS_FILE_NAME,
  GLOBAL_FIELDS_DIR_NAME,

} = MIGRATION_DATA_CONFIG;

const createGlobalField = async ({
  region,
  user_id,
  stackId,
  current_test_stack_id
}: {
  region: string;
  user_id: string;
  stackId: string;
  current_test_stack_id?: string;
}) => {
  const srcFun = "createGlobalField"; 
  const authtoken = await getAuthtoken(region, user_id); 
  try {
     const [err, res] = await safePromise(
                https({
                    method: "GET",
                    url: `${config.CS_API[
                    region as keyof typeof config.CS_API
                    ]!}/global_fields?include_global_field_schema=true`,
                    headers: {
                    api_key : stackId,
                    authtoken,
                    },
                })
            );
    const globalSave = path.join(MIGRATION_DATA_CONFIG.DATA, current_test_stack_id ?? '', GLOBAL_FIELDS_DIR_NAME);
    if(!fs.existsSync(globalSave)) {
      fs.mkdirSync(globalSave, { recursive: true });
    }
    const filePath = path.join(process.cwd(),globalSave, GLOBAL_FIELDS_FILE_NAME);
    const globalfields = res?.data?.global_fields || [];
    
    let fileGlobalFields : any[]= []
    if (fs.existsSync(filePath)) {
    const globalFieldSchema = await fs.promises.readFile(filePath, 'utf8');
    try {
        fileGlobalFields = JSON?.parse?.(globalFieldSchema);
    } catch (e) {
        console.error(`Error parsing JSON in ${filePath}:`, e);
    }
    }
    
    const mergedGlobalFields = [
    ...globalfields,
    ...(fileGlobalFields?.filter(
        (fileField: { uid: string }) =>
        !globalfields?.some((gf: { uid: string }) => gf?.uid === fileField?.uid)
    ) || [])
    ];
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(mergedGlobalFields, null, 2));
   
  } catch (error: any) {
    logger.error(
      getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, error)
    );
    return {
      data: error,
      status: error?.response?.status || 500,
    };
    
  }
 }


export const globalFieldServie = {
  createGlobalField
}