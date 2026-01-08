import { getLogMessage, safePromise } from "../utils/index.js";
import getAuthtoken from "../utils/auth.utils.js";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import fs from 'fs';
import { HTTP_TEXTS, MIGRATION_DATA_CONFIG } from "../constants/index.js";
import path from "path";
import logger from "../utils/logger.js";
import AuthenticationModel from "../models/authentication.js";

const {
  TAXONOMIES_DIR_NAME,
  TAXONOMIES_FILE_NAME
} = MIGRATION_DATA_CONFIG;

const getDescendantsTerm = async ( {authtoken,taxonomyUid, termUid, region, stackId}: 
    {authtoken: string,taxonomyUid : string, termUid: string, region : string, stackId : string}) => {
    const srcFun = "getDescendantsTerm";

    try {
        const [err, res] = await safePromise(
        https({
            method: "GET",
            url: `${config.CS_API[
            region as keyof typeof config.CS_API
            ]!}/taxonomies/${taxonomyUid}/terms/${termUid}/descendants?include_children_count=true&include_count=true&include_order=true`,
            headers: {
            api_key : stackId,
            authtoken,
            },
        }));
        if (err) {
            logger.error(
                getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, err?.response?.data)
            );

            return {
                data: err?.response?.data,
                status: err?.response?.status,
            };
        }
        const terms = res?.data?.terms || [];
        const allTerms: { uid: string; name: string; parent_uid: string }[] = [];
            for (const term of terms) {
      // Push current term
      allTerms.push({
        uid: term?.uid,
        name: term?.name,
        parent_uid: term?.parent_uid,
      });

      // Recursively fetch deeper descendants
      if (term?.children_count > 0) {
        const nestedTerms = await getDescendantsTerm({
          authtoken,
          taxonomyUid,
          termUid: term?.uid,
          region,
          stackId,
        });

        if (Array.isArray(nestedTerms)) {
          allTerms.push(...nestedTerms);
        }
      }
    }
        return allTerms; 
    } catch (error) {
        logger.error("🚀 ~ getDescendantsTerm ~ error:", error);
        throw error;
        
    }
}

const createTerms = async(
    {authtoken,taxonomyUid, region, stackId}: 
    {authtoken: string,taxonomyUid : string, region : string, stackId : string}) => {
    const srcFun = "createTerms";
    try {
        const [err, res] = await safePromise(
        https({
            method: "GET",
            url: `${config.CS_API[
            region as keyof typeof config.CS_API
            ]!}/taxonomies/${taxonomyUid}/terms?include_terms_count=true&include_count=true&include_children_count=true&include_referenced_entries_count=true`,
            headers: {
            api_key : stackId,
            authtoken,
            },
        }));
        const termsData = res?.data?.terms;
        const allTerms: any[] = [];
        for (const term of termsData || []) {
            if (term?.uid) {
                allTerms.push({
                uid: term?.uid,
                name: term?.name,
                parent_uid: term?.parent_uid,
                });

                if (term?.children_count > 0) {
                const nestedTerms = await getDescendantsTerm({
                    authtoken,
                    taxonomyUid,
                    termUid: term?.uid,
                    region,
                    stackId,
                });

                if (Array.isArray(nestedTerms)) {
                    allTerms.push(...nestedTerms);
                }
                }
            }
        }

        
    
        
    if (err) {
        logger.error(
            getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, err?.response?.data)
        );

        return {
            data: err?.response?.data,
            status: err?.response?.status,
        };
    }
    return allTerms;
        
    } catch (error) {
        logger.error("🚀 ~ createTaxonomy ~ error:", error);
        throw error;
        
    }
   


}
const createTaxonomy = async ({stackId,region,userId,current_test_stack_id} : 
    {orgId: string, stackId: string, projectId:string,region: string,userId: string,current_test_stack_id:string}) => {
    const srcFun = "createTaxonomy";
    const taxonomiesPath = path.join(MIGRATION_DATA_CONFIG.DATA, current_test_stack_id, TAXONOMIES_DIR_NAME);
    await fs.promises.mkdir(taxonomiesPath, { recursive: true });
    let headers: any = {
        api_key : stackId,
    }
    let authtoken = "";
    await AuthenticationModel.read();
    const userIndex = AuthenticationModel.chain
      .get('users')
      .findIndex({ region, user_id: userId })
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
                ]!}/taxonomies?include_terms_count=true&include_count=true`,
                headers: headers,
            })
        );
        if (err) {
            logger.error(
                getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, err?.response?.data)
            );

            return {
                data: err?.response?.data,
                status: err?.response?.status,
            };
        }
    
        const taxonomiesDataObject: Record<string, any> = {};
        if (res?.data?.taxonomies) {
            for (const taxonomy of res.data.taxonomies) {
                if (taxonomy?.uid) {
                    taxonomiesDataObject[taxonomy.uid] = {
                        uid: taxonomy?.uid,
                        name: taxonomy?.name,
                        description: taxonomy?.description,
                    };
                    const singleTaxonomy: any = {};
                    singleTaxonomy['taxonomy'] = {
                        uid: taxonomy?.uid,
                        name: taxonomy?.name,
                        description: taxonomy?.description,
                    };
                    singleTaxonomy['terms'] = await createTerms({ authtoken, taxonomyUid: taxonomy?.uid, region, stackId });
                    await fs.promises.writeFile(path.join(taxonomiesPath, `${taxonomy?.uid}.json`), JSON.stringify(singleTaxonomy, null, 2));
                }
            }
        }

        const filePath = path.join(taxonomiesPath, TAXONOMIES_FILE_NAME);
        await fs.promises.writeFile(filePath, JSON.stringify(taxonomiesDataObject, null, 2));
       
        

    } catch (error) {
    logger.error("🚀 ~ createTaxonomy ~ error:", error);
    throw error;
  }
    
}


export const taxonomyService = {
  createTaxonomy
}

