import { Request } from "express";
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType } from "../models/types.js";
import getAuthtoken from "../utils/auth.utils.js";
import logger from "../utils/logger.js";
import { HTTP_TEXTS, HTTP_CODES } from "../constants/index.js";
import { ExceptionFunction } from "../utils/custom-errors.utils.js";
import { BadRequestError } from "../utils/custom-errors.utils.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import OrgPlanFinderModel from "../models/org-plan-finder.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Retrieves all stacks based on the provided request.
 * @param req - The request object.
 * @returns A promise that resolves to a LoginServiceType object.
 */
const getAllStacks = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getAllStacks";
  const orgId = req?.params?.orgId;
  const { token_payload } = req.body;
  const search: string = req?.params?.searchText?.toLowerCase();

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
      })
    );
    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );
      return {
        data: err.response.data,
        status: err.response.status,
      };
    }
    let stacks = res?.data?.stacks;
    if (search) {
      stacks = stacks.filter((stack: { name: string; description: string }) => {
        const stackName = stack?.name?.toLowerCase();
        const stackDescription = stack?.description?.toLowerCase();
        return (
          stackName?.includes(search) || stackDescription?.includes(search)
        );
      });
    }
    await ProjectModelLowdb?.read?.();
    const testStacks = ProjectModelLowdb?.chain?.get?.("projects")?.flatMap?.("test_stacks")?.value?.();
    if (testStacks?.length > 0) {
      const filterStacks = [];
      for (const stack of stacks ?? []) {
        const isPresent = testStacks?.find?.((testStack: any) => testStack?.stackUid === stack?.api_key);
        if (isPresent === undefined) {
          filterStacks?.push(stack);
        }
      }
      stacks = filterStacks;
    }
    return {
      data: {
        stacks,
      },
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while getting all stacks",
        token_payload,
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Creates a stack.
 * @param req - The request object.
 * @returns A promise that resolves to a LoginServiceType object.
 */
const createStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "createStack";
  const orgId = req?.params?.orgId;
  const { token_payload, name, description, master_locale } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
        data: {
          stack: {
            name,
            description,
            master_locale,
          },
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while creating a stack",
        token_payload,
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Retrieves the locales from the CS API.
 * @param req - The request object.
 * @returns A promise that resolves to the response from the CS API.
 * @throws {ExceptionFunction} If there is an error while retrieving the locales.
 */
const getLocales = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getLocales";
  const { token_payload } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/locales?include_all=true`,
        headers: {
          authtoken,
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(srcFun, "Error while getting locales", token_payload, error)
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Retrieves the status of a stack.
 * @param req - The request object containing the orgId, token_payload, and stack_api_key.
 * @returns An object containing the status and data of the stack.
 * @throws ExceptionFunction if an error occurs while checking the status of the stack.
 */
const getStackStatus = async (req: Request) => {
  const { orgId } = req.params;
  const { token_payload, stack_api_key } = req.body;
  const srcFunc = "getStackStatus";

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  try {
    const [stackErr, stackRes] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
      })
    );

    if (stackErr)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: stackErr.response.status,
      };

    if (
      !stackRes.data.stacks.find(
        (stack: any) => stack.api_key === stack_api_key
      )
    )
      throw new BadRequestError(HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND);

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/content_types?skip=0&limit=1&include_count=true`,
        headers: {
          api_key: stack_api_key,
          authtoken,
        },
      })
    );

    if (err)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: err.response.status,
      };

    return {
      status: HTTP_CODES.OK,
      data: {
        contenttype_count: res.data?.count || 0,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while checking the status of a stack [OrgId : ${orgId}].`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};
//get all locals of particular stack

/**
 * Retrieves the status of a stack.
 * @param req - The request object containing the orgId, token_payload, and stack_api_key.
 * @returns An object containing the status and data of the stack.
 * @throws ExceptionFunction if an error occurs while checking the status of the stack.
 */
const getStackLocale = async (req: Request) => {
  const { token_payload, stack_api_key } = req.body;
  const srcFunc = "getStackStatus";

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  try {
    const [stackErr, stackRes] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/locales`,
        headers: {
          api_key: stack_api_key,
          authtoken,
        },
      })
    );

    if (stackErr)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: stackErr.response.status,
      };

    return {
      status: HTTP_CODES.OK,
      data: stackRes.data,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while getting locales a stack.`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Retrieves the plan details of a org.
 * @param req - The request object containing the orgId, token_payload.
 * @returns An object containing the org details.
 * @throws ExceptionFunction if an error occurs while getting the org details.
 */
const getOrgDetails = async (req: Request) => {
  const { orgId } = req.params;
  const { token_payload } = req.body;
  const srcFunc = "getOrgDetails";

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  try {
    const [stackErr, stackRes] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/organizations/${orgId}?include_plan=true`,
        headers: {
          authtoken,
        },
      })
    );

    if (stackErr)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: stackErr.response.status,
      };

    return {
      status: HTTP_CODES.OK,
      data: stackRes.data,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while getting locales a stack.`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Fetches and saves organization plan details to the database.
 * @param req - The request object containing region, authtoken, and org_uid.
 * @returns An object containing the success status and saved data.
 * @throws ExceptionFunction if an error occurs while fetching or saving org plan details.
 */
const saveOrgPlanDetails = async (req: Request): Promise<LoginServiceType> => {
  const { region, authtoken, org_uid } = req.body;
  const srcFunc = "saveOrgPlanDetails";

  console.log("\n🔍 ORG SERVICE - saveOrgPlanDetails called");
  console.log("Received parameters:", {
    region,
    authtoken: authtoken ? `${authtoken.substring(0, 15)}...` : 'MISSING',
    org_uid
  });

  try {
    // Determine base URL based on region
    let baseUrl: string;
    switch (region?.toLowerCase()) {
      case 'na':
        baseUrl = 'https://app.contentstack.com/';
        break;
      case 'eu':
        baseUrl = 'https://eu-api.contentstack.com/';
        break;
      case 'azure-na':
        baseUrl = 'https://azure-na-api.contentstack.com/';
        break;
      case 'azure-eu':
        baseUrl = 'https://azure-eu-api.contentstack.com/';
        break;
      case 'gcp-na':
        baseUrl = 'https://gcp-na-api.contentstack.com/';
        break;
      case 'gcp-eu':
        baseUrl = 'https://gcp-eu-api.contentstack.com/';
        break;
      default:
        baseUrl = 'https://app.contentstack.com/';
        break;
    }

    console.log(`\n🌐 Making API call to: ${baseUrl}api/v3/organizations/${org_uid}?include_plan=true`);
    
    const [orgErr, orgRes] = await safePromise(
      https({
        method: "GET",
        url: `${baseUrl}api/v3/organizations/${org_uid}?include_plan=true`,
        headers: {
          authtoken,
        },
      })
    );

    console.log(`📊 API Response Status: ${orgRes?.status || 'ERROR'}`);
    if (orgErr) {
      console.log("❌ API Error:", {
        status: orgErr.response?.status,
        message: orgErr.response?.data?.message || orgErr.message
      });
    }

    if (orgErr) {
      logger.error(
        getLogMessage(
          srcFunc,
          `Error occurred while fetching org plan details.`,
          { region, org_uid },
          orgErr
        )
      );
      return {
        data: {
          message: HTTP_TEXTS.INTERNAL_ERROR,
        },
        status: orgErr.response?.status || HTTP_CODES.SERVER_ERROR,
      };
    }

    const organizationResponse = orgRes.data;
    if (!organizationResponse?.organization) {
      throw new BadRequestError("Organization not found");
    }

    // Extract plan features exactly like the original orgPlanFinder.js
    const planFeatures = organizationResponse?.organization?.plan?.features;
    console.log(`\n📦 Plan features found: ${planFeatures ? planFeatures.length : 0} features`);
    
    if (!planFeatures) {
      console.log("❌ No plan features found in response");
      throw new BadRequestError("Organization plan features not found");
    }

    console.log("✅ Sample features:", planFeatures.slice(0, 3).map((f: any) => ({ uid: f.uid, name: f.name })));

    // Read the existing data
    await OrgPlanFinderModel.read();

    // Check if org plan already exists
    const existingIndex = OrgPlanFinderModel.chain
      .get("org_plans")
      .findIndex({ org_uid })
      .value();

    const currentTime = new Date().toISOString();
    const orgPlanEntry = {
      org_uid,
      region,
      authtoken,
      organization_response: planFeatures, // Save only the plan features array
      fetched_at: currentTime,
      isDeleted: false,
    };

    // Update or insert the org plan entry
    console.log(`\n💾 Saving to database... ${existingIndex >= 0 ? 'Updating existing' : 'Creating new'} entry`);
    
    OrgPlanFinderModel.update((data: any) => {
      if (existingIndex >= 0) {
        data.org_plans[existingIndex] = orgPlanEntry;
        console.log("✅ Updated existing org plan entry");
      } else {
        data.org_plans.push(orgPlanEntry);
        console.log("✅ Added new org plan entry");
      }
    });

    console.log(`📁 Database file should be created at: ${process.cwd()}/database/org-plan-finder.json`);

    logger.info(
      getLogMessage(
        srcFunc,
        `Organization plan details saved successfully for org: ${org_uid}`,
        { region, org_uid }
      )
    );

    return {
      status: HTTP_CODES.OK,
      data: {
        message: "Organization plan features saved successfully",
        org_plan: orgPlanEntry,
        features_count: planFeatures.length, // Include count of features saved
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while saving org plan details.`,
        { region, org_uid },
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Retrieves saved organization plan details from the database.
 * @param req - The request object containing the org_uid.
 * @returns An object containing the org plan details.
 * @throws ExceptionFunction if an error occurs while retrieving org plan details.
 */
const getOrgPlanDetails = async (req: Request): Promise<LoginServiceType> => {
  const { org_uid } = req.body;
  const srcFunc = "getOrgPlanDetails";

  try {
    await OrgPlanFinderModel.read();

    const orgPlan = OrgPlanFinderModel.chain
      .get("org_plans")
      .find({ org_uid, isDeleted: false })
      .value();

    if (!orgPlan) {
      return {
        status: HTTP_CODES.NOT_FOUND,
        data: {
          message: "Organization plan details not found",
        },
      };
    }

    return {
      status: HTTP_CODES.OK,
      data: {
        org_plan: orgPlan,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while retrieving org plan details.`,
        { org_uid },
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const orgService = {
  getAllStacks,
  getLocales,
  createStack,
  getStackStatus,
  getStackLocale,
  getOrgDetails,
  saveOrgPlanDetails,
  getOrgPlanDetails,
};
