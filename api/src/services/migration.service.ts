import { Request } from "express";
import path from "path";
import ProjectModelLowdb from "../models/project-lowdb.js";
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType } from "../models/types.js"
import getAuthtoken from "../utils/auth.utils.js";
import logger from "../utils/logger.js";
import { HTTP_TEXTS, HTTP_CODES, LOCALE_MAPPER, STEPPER_STEPS } from "../constants/index.js";
import { ExceptionFunction } from "../utils/custom-errors.utils.js";
import { fieldAttacher } from "../utils/field-attacher.utils.js";
import { siteCoreService } from "./sitecore.service.js";
import { testFolderCreator } from "../utils/test-folder-creator.utils.js";
import { utilsCli } from './runCli.service.js';
import customLogger from "../utils/custom-logger.utils.js";
import { setLogFilePath } from "../server.js";




/**
 * Creates a test stack.
 *
 * @param req - The request object containing the necessary parameters.
 * @returns A promise that resolves to a LoginServiceType object.
 * @throws ExceptionFunction if there is an error creating the stack.
 */
const createTestStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "createTestStack";
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { token_payload } = req.body;
  const description = 'This is a system-generated test stack.'
  const name = 'Test';


  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    await ProjectModelLowdb.read();
    const projectData: any = ProjectModelLowdb.chain.get("projects").find({ id: projectId }).value();
    const master_locale = projectData?.stackDetails?.master_locale ?? Object?.keys?.(LOCALE_MAPPER?.masterLocale)?.[0];
    const testStackCount = projectData?.test_stacks?.length + 1;
    const newName = name + "-" + testStackCount;

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
            name: newName,
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

    const index = ProjectModelLowdb.chain
      .get("projects")
      .findIndex({ id: projectId })
      .value();
    if (index > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[index].current_step = STEPPER_STEPS['TESTING'];
        data.projects[index].current_test_stack_id = res?.data?.stack?.api_key;
        data.projects[index].test_stacks.push({ stackUid: res?.data?.stack?.api_key, isMigrated: false });
      });
    }
    return {
      data: {
        data: res.data,
        url: `${config.CS_URL[token_payload?.region as keyof typeof config.CS_URL]
          }/stack/${res.data.stack.api_key}/dashboard`,
      },
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
 * Deletes a test stack.
 * @param req - The request object.
 * @returns A promise that resolves to a LoginServiceType object.
 */
const deleteTestStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "deleteTestStack";
  const projectId = req?.params?.projectId;
  const { token_payload, stack_key } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "DELETE",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          api_key: stack_key,
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

    const index = ProjectModelLowdb.chain
      .get("projects")
      .findIndex({ id: projectId })
      .value();
    console.info(index);
    if (index > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[index].current_test_stack_id = "";
        const stackIndex = data.projects[index].test_stacks.indexOf(stack_key);
        if (stackIndex > -1) {
          data.projects[index].test_stacks.splice(stackIndex, 1);
        }
      });
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
 * Start Test Migration.
 *
 * @param req - The request object containing the necessary parameters.
 */
const startTestMigration = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const { region, user_id } = req?.body?.token_payload ?? {};
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain.get("projects").find({ id: projectId }).value();
  const packagePath = project?.extract_path;
  if (packagePath && project?.current_test_stack_id) {
    const loggerPath = path.join(process.cwd(), 'logs', projectId, `${project?.current_test_stack_id}.log`);
    const message = getLogMessage('startTestMigration', 'Starting Test Migration...', {});
    await customLogger(projectId, project?.current_test_stack_id, 'info', message);
    await setLogFilePath(loggerPath);
    const contentTypes = await fieldAttacher({ orgId, projectId, destinationStackId: project?.current_test_stack_id });
    await siteCoreService?.createEntry({ packagePath, contentTypes, destinationStackId: project?.current_test_stack_id, projectId });
    await siteCoreService?.createLocale(req, project?.current_test_stack_id, projectId);
    await siteCoreService?.createVersionFile(project?.current_test_stack_id);
    await testFolderCreator?.({ destinationStackId: project?.current_test_stack_id });
    await utilsCli?.runCli(region, user_id, project?.current_test_stack_id, projectId, true, loggerPath);
  }
}


/**
 * Start final Migration.
 *
 * @param req - The request object containing the necessary parameters.
 */
const startMigration = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const { region, user_id } = req?.body?.token_payload ?? {};
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain.get("projects").find({ id: projectId }).value();
  const packagePath = project?.extract_path;
  if (packagePath && project?.destination_stack_id) {
    const loggerPath = path.join(process.cwd(), 'logs', projectId, `${project?.destination_stack_id}.log`);
    const message = getLogMessage('startTestMigration', 'Starting Migration...', {});
    await customLogger(projectId, project?.destination_stack_id, 'info', message);
    await setLogFilePath(loggerPath);
    const contentTypes = await fieldAttacher({ orgId, projectId, destinationStackId: project?.destination_stack_id });
    await siteCoreService?.createEntry({ packagePath, contentTypes, destinationStackId: project?.destination_stack_id, projectId });
    await siteCoreService?.createLocale(req, project?.destination_stack_id, projectId);
    await siteCoreService?.createVersionFile(project?.destination_stack_id);
    await utilsCli?.runCli(region, user_id, project?.destination_stack_id, projectId, false, loggerPath);
  }
}

export const migrationService = {
  createTestStack,
  deleteTestStack,
  startTestMigration,
  startMigration
};
