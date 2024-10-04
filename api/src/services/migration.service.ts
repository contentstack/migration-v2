import { Request } from "express";
import fs from 'fs';
// import cliUtilities from '@contentstack/cli-utilities';
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType } from "../models/types.js";
import getAuthtoken from "../utils/auth.utils.js";
import logger from "../utils/logger.js";
import { HTTP_TEXTS, HTTP_CODES, CS_REGIONS, LOCALE_MAPPER } from "../constants/index.js";
import { ExceptionFunction } from "../utils/custom-errors.utils.js";
import { fieldAttacher } from "../utils/field-attacher.utils.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import shell from 'shelljs'
import path from "path";
import AuthenticationModel from "../models/authentication.js";
import { siteCoreService } from "./sitecore.service.js";
import { copyDirectory } from '../utils/index.js'
import { v4 } from "uuid";
import { setLogFilePath } from "../server.js";
import { mkdirp } from 'mkdirp';
import { testFolderCreator } from "../utils/test-folder-creator.utils.js";




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
  const master_locale = Object?.keys?.(LOCALE_MAPPER?.masterLocale)?.[0];


  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    await ProjectModelLowdb.read();
    const projectData: any = ProjectModelLowdb.chain.get("projects").find({ id: projectId }).value();
    console.info("🚀 ~ createTestStack ~ projectData:", projectData)
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


function createDirectoryAndFile(filePath: string) {
  // Get the directory from the file path
  const dirPath = path.dirname(filePath);
  // Create the directory if it doesn't exist
  mkdirp.sync(dirPath);
  // Check if the file exists; if not, create it
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', { mode: 0o666 }); // Create file with read/write for everyone
    console.info(`File created at: ${filePath}`);
  } else {
    console.info(`File already exists at: ${filePath}`);
  }
}


const runCli = async (rg: string, user_id: string, stack_uid: any, projectId: string) => {
  try {
    const regionPresent = CS_REGIONS?.find((item: string) => item === rg) ?? 'NA';
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get("users")
      .find({ region: regionPresent, user_id })
      .value();
    if (userData?.authtoken && stack_uid) {
      const sourcePath = path.join(process.cwd(), 'sitecoreMigrationData', stack_uid);
      const backupPath = path.join(process.cwd(), 'migration-data', `${stack_uid}_${v4().slice(0, 4)}`);
      await copyDirectory(sourcePath, backupPath);
      const loggerPath = path.join(backupPath, 'logs', 'import', 'success.log');
      createDirectoryAndFile(loggerPath);
      await setLogFilePath(loggerPath);
      shell.cd(path.join(process.cwd(), '..', 'cli', 'packages', 'contentstack'));
      shell.exec('pwd');
      shell.exec(`node bin/run config:set:region ${regionPresent}`);
      shell.exec(`node bin/run login -a ${userData?.authtoken}  -e ${userData?.email}`);
      const exportData = shell.exec(`node bin/run cm:stacks:import  -k ${stack_uid} -d ${sourcePath} --backup-dir=${backupPath}  --yes`, { async: true });
      exportData.on('exit', (code) => {
        console.info(`Process exited with code: ${code}`);
        if (code === 1) {
          const projectIndex = ProjectModelLowdb.chain.get("projects").findIndex({ id: projectId }).value();
          if (projectIndex > -1) {
            ProjectModelLowdb?.data.projects[projectIndex].test_stacks.map((item: any) => {
              if (item?.stackUid === stack_uid) {
                item.isMigrated = true;
              }
              return item;
            })
            ProjectModelLowdb.write();
          }
        }
      });
    } else {
      console.info('user not found.')
    }
  } catch (er) {
    console.error("🚀 ~ runCli ~ er:", er)
  }
}

const fieldMapping = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const { region, user_id } = req?.body?.token_payload ?? {};
  const project = ProjectModelLowdb.chain.get("projects").find({ id: projectId }).value();
  const packagePath = project?.extract_path;
  if (packagePath && project?.current_test_stack_id) {
    const contentTypes = await fieldAttacher({ orgId, projectId, destinationStackId: project?.current_test_stack_id });
    await siteCoreService?.createEntry({ packagePath, contentTypes, destinationStackId: project?.current_test_stack_id });
    await siteCoreService?.createLocale(req, project?.current_test_stack_id);
    await siteCoreService?.createVersionFile(project?.current_test_stack_id);
    await testFolderCreator?.({ destinationStackId: project?.current_test_stack_id });
    await runCli(region, user_id, project?.current_test_stack_id, projectId);
  }
}

export const migrationService = {
  createTestStack,
  deleteTestStack,
  fieldMapping
};
