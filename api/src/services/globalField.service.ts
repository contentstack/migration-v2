import { getLogMessage, safePromise } from "../utils/index.js";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import fs from 'fs';
import { HTTP_TEXTS, MIGRATION_DATA_CONFIG} from "../constants/index.js";
import path from "path";
import logger from "../utils/logger.js";
import AuthenticationModel from "../models/authentication.js";

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
  let headers: any = {
    api_key : stackId,
  }
  let authtoken = "";
  await AuthenticationModel.read();
  const userIndex = AuthenticationModel.chain
    .get('users')
    .findIndex({ region, user_id: user_id })
    .value();
  
  const userData = AuthenticationModel?.data?.users[userIndex];
  if(userData?.access_token) {
    authtoken = `Bearer ${userData?.access_token}`;
    headers.authorization = authtoken;
  } else if(userData?.authtoken) {
    authtoken = userData?.authtoken;
    headers.authtoken = authtoken;
  }else{
    throw new Error("No authentication token found");
  }
  try {
     const [err, res] = await safePromise(
                https({
                    method: "GET",
                    url: `${config.CS_API[
                    region as keyof typeof config.CS_API
                    ]!}/global_fields?include_global_field_schema=true`,
                    headers: headers,
                })
            );
    const globalSave = path.join(MIGRATION_DATA_CONFIG.DATA, current_test_stack_id ?? '', GLOBAL_FIELDS_DIR_NAME);
    if(!fs.existsSync(globalSave)) {
      fs.mkdirSync(globalSave, { recursive: true });
    }
    const filePath = path.join(process.cwd(),globalSave, GLOBAL_FIELDS_FILE_NAME);
    const globalfields = res?.data?.global_fields || [];
    
    let fileGlobalFields = []
    if (fs.existsSync(filePath)) {
    const globalFieldSchema = await fs.promises.readFile(filePath, 'utf8');
    try {
        fileGlobalFields = JSON?.parse?.(globalFieldSchema);
    } catch (e) {
        console.error(`Error parsing JSON in ${filePath}:`, e);
    }
    }
    
    const safeFileGlobalFields = fileGlobalFields;
    
    const existingUids = new Set(
      safeFileGlobalFields?.map?.((gf: { uid: string }) => gf?.uid)
    );
    
    const mergedGlobalFields = [
        ...globalfields.filter(
        (fileField: { uid: string }) => !existingUids?.has(fileField?.uid)
      ),
      ...safeFileGlobalFields,
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