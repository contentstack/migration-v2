import { Request } from "express";
// import cliUtilities from '@contentstack/cli-utilities';
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType } from "../models/types.js";
import getAuthtoken from "../utils/auth.utils.js";
import logger from "../utils/logger.js";
import { HTTP_TEXTS, HTTP_CODES, CS_REGIONS } from "../constants/index.js";
import { ExceptionFunction } from "../utils/custom-errors.utils.js";
import { fieldAttacher } from "../utils/field-attacher.utils.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import shell from 'shelljs'
import path from "path";
import AuthenticationModel from "../models/authentication.js";
import { siteCoreService } from "./sitecore.service.js";
import { fileURLToPath } from 'url';
import { copyDirectory } from '../utils/index.js'





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
  const { token_payload, name, description, master_locale } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain.get("projects").value();
    const testStackCount = projectData[0]?.test_stacks?.length + 1;
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
    console.info(index);
    if (index > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[index].current_test_stack_id = res.data.stack.uid;
        data.projects[index].test_stacks.push(res.data.stack.uid);
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

const cliLogger = (child: any) => {
  if (child.code !== 0) {
    console.info(`Error: Failed to install @contentstack/cli. Exit code: ${child.code}`);
    console.info(`stderr: ${child.stderr}`);
  } else {
    console.info('Installation successful', child, child?.stdout);
  }
};

const runCli = async (rg: string, user_id: string, project: any) => {
  try {
    const regionPresent = CS_REGIONS?.find((item: string) => item === rg) ?? 'NA';
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get("users")
      .find({ region: regionPresent, user_id })
      .value();
    if (userData?.authtoken && project?.destination_stack_id) {
      // Manually define __filename and __dirname
      const __filename = fileURLToPath(import.meta.url);
      const dirPath = path.join(path.dirname(__filename), '..', '..');
      const sourcePath = path.join(dirPath, 'sitecoreMigrationData', project?.destination_stack_id);
      const backupPath = path.join(process.cwd(), 'migration-data', project?.destination_stack_id);
      await copyDirectory(sourcePath, backupPath);
      shell.cd(path.join(process.cwd(), '..', 'cli', 'packages', 'contentstack'));
      const pwd = shell.exec('pwd');
      cliLogger(pwd);
      const region = shell.exec(`node bin/run config:set:region ${regionPresent}`);
      cliLogger(region);
      const login = shell.exec(`node bin/run login -a ${userData?.authtoken}  -e ${userData?.email}`);
      cliLogger(login);
      const exportData = shell.exec(`node bin/run cm:stacks:import  -k ${project?.destination_stack_id} -d ${sourcePath} --backup-dir=${backupPath}  --yes`);
      cliLogger(exportData);
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
  const project = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();
  if (project?.extract_path && project?.destination_stack_id) {
    const packagePath = project?.extract_path;
    const contentTypes = await fieldAttacher({ orgId, projectId, destinationStackId: project?.destination_stack_id });
    await siteCoreService?.createEntry({ packagePath, contentTypes, destinationStackId: project?.destination_stack_id });
    await siteCoreService?.createLocale(req, project?.destination_stack_id);
    await siteCoreService?.createVersionFile(project?.destination_stack_id);
    await runCli(region, user_id, project);
  }
}

export const migrationService = {
  createTestStack,
  deleteTestStack,
  fieldMapping
};





// cliUtilities?.configHandler?.set('region', regionPresent);
// cliUtilities?.configHandler?.set('authtoken', userData?.authtoken);
// shell.cd(path.resolve(process.cwd(), `../cli/packages/contentstack`));
// const pwd = shell.exec('pwd');
// cliLogger(pwd);
// const region = shell.exec(`node bin/run config:set:region ${regionPresent}`);
// cliLogger(region);
// const login = shell.exec(`node bin/run login -a ${userData?.authtoken}  -e ${email}`)
// cliLogger(login);
// const exportData = shell.exec(`node bin/run cm:stacks:import  -k blt3e7d2a4135d8bfab -d "/Users/umesh.more/Documents/ui-migration/migration-v2-node-server/data" --backup-dir="/Users/umesh.more/Documents/ui-migration/migration-v2-node-server/migrations/blt3e7d2a4135d8bfab"`);
// cliLogger(exportData);
// const cmd = [`-k ${userData?.authtoken}`, "-d /Users/umesh.more/Documents/ui-migration/migration-v2-node-server/api/sitecoreMigrationData", "--backup-dir=/Users/umesh.more/Documents/ui-migration/migration-v2-node-server/migrations/blt3e7d2a4135d8bfab", "--yes"]
// await importCmd.default.run(cmd);  // This will bypass the type issue
// shell.cd(path.resolve(`${path?.dirname}`, '..', 'cli', 'packages', 'contentstack'));
// const importCmd: any = await import('@contentstack/cli-cm-import');







