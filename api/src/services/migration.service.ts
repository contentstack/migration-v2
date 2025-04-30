import { Request } from 'express';
import path from 'path';
import ProjectModelLowdb from '../models/project-lowdb.js';
import { config } from '../config/index.js';
import { safePromise, getLogMessage } from '../utils/index.js';
import https from '../utils/https.utils.js';
import { LoginServiceType } from '../models/types.js';
import getAuthtoken from '../utils/auth.utils.js';
import logger from '../utils/logger.js';
import {
  HTTP_TEXTS,
  HTTP_CODES,
  LOCALE_MAPPER,
  STEPPER_STEPS,
  CMS,
} from '../constants/index.js';
import {
  BadRequestError,
  ExceptionFunction,
} from '../utils/custom-errors.utils.js';
import { fieldAttacher } from '../utils/field-attacher.utils.js';
import { siteCoreService } from './sitecore.service.js';
import { wordpressService } from './wordpress.service.js';
import { testFolderCreator } from '../utils/test-folder-creator.utils.js';
import { utilsCli } from './runCli.service.js';
import customLogger from '../utils/custom-logger.utils.js';
import { setLogFilePath } from '../server.js';
import fs from 'fs';
import { contentfulService } from './contentful.service.js';
import { marketPlaceAppService } from './marketplace.service.js';
import { extensionService } from './extension.service.js';
import fsPromises from 'fs/promises';
// import { getSafePath } from "../utils/sanitize-path.utils.js";

/**
 * Creates a test stack.
 *
 * @param req - The request object containing the necessary parameters.
 * @returns A promise that resolves to a LoginServiceType object.
 * @throws ExceptionFunction if there is an error creating the stack.
 */
const createTestStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = 'createTestStack';
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { name, token_payload } = req.body;
  const description = 'This is a system-generated test stack.';
  const testStackName = `${name}-Test`;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    await ProjectModelLowdb.read();
    const projectData: any = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();
    const master_locale =
      projectData?.stackDetails?.master_locale ??
      Object?.keys?.(LOCALE_MAPPER?.masterLocale)?.[0];
    const testStackCount = projectData?.test_stacks?.length + 1;
    const newName = testStackName + '-' + testStackCount;

    const [err, res] = await safePromise(
      https({
        method: 'POST',
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
      .get('projects')
      .findIndex({ id: projectId })
      .value();
    if (index > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[index].current_step = STEPPER_STEPS['TESTING'];
        data.projects[index].current_test_stack_id = res?.data?.stack?.api_key;
        data.projects[index].test_stacks.push({
          stackUid: res?.data?.stack?.api_key,
          stackName: res?.data?.stack?.name,
          isMigrated: false,
        });
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
        'Error while creating a stack',
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

const getAuditData = async (req: Request): Promise<any> => {
  const projectId = path.basename(req?.params?.projectId);
  const stackId = path.basename(req?.params?.stackId);
  const moduleName = path.basename(req?.params?.moduleName);
  const limit = parseInt(req?.params?.limit);
  const startIndex = parseInt(req?.params?.startIndex);
  const stopIndex = startIndex + limit;
  const searchText = req?.params?.searchText;
  const filter = req?.params?.filter;
  const srcFunc = "getAuditData";

  if (projectId.includes('..') || stackId.includes('..') || moduleName.includes('..')) {
    throw new BadRequestError("Invalid projectId, stackId, or moduleName");
  }

  try {
    const mainPath = process.cwd().split("migration-v2")[0];
    const logsDir = path.join(mainPath, "migration-v2", "api", "migration-data");

    const stackFolders = fs.readdirSync(logsDir);

    const stackFolder = stackFolders.find(folder => folder.startsWith(stackId));
    if (!stackFolder) {
      throw new BadRequestError("Migration data not found for this stack");
    }

    const auditLogPath = path.join(logsDir, stackFolder, "logs", "audit", "audit-report");
    if (!fs.existsSync(auditLogPath)) {
      throw new BadRequestError("Audit log path not found");
    }

    const files = fs.readdirSync(auditLogPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    let fileData = null;
    let fileName = null;

    for (const file of jsonFiles) {
      const fileModuleName = file.replace('.json', '');

      if (fileModuleName === moduleName) {
        const filePath = path.join(auditLogPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          fileData = JSON.parse(content);
          fileName = file;
          break;
        } catch (err) {
          logger.warn(
            getLogMessage(
              srcFunc,
              `Failed to parse JSON file for module ${moduleName}: ${file}`
            )
          );
          fileData = {
            error: 'Failed to parse file',
          };
          fileName = file;
          break;
        }
      }
    }

    // If no matching module was found
    if (!fileData) {
      throw new BadRequestError(`No audit data found for module: ${moduleName}`);
    }
    // Transform and flatten the data with sequential tuid
    const filterKey = moduleName === 'Entries_Select_feild' ? 'display_type' : 'data_type';
    console.info("🚀 ~ getAuditData ~ filterKey:", filterKey)

    let transformedData = transformAndFlattenData(fileData);
    // console.info(transformedData)
    if (filter != "all") {
      const filters = filter.split("-");
      moduleName === 'Entries_Select_feild' ? transformedData = transformedData.filter((log) => {
        return filters.some((filter) => {
          //eslint-disable-next-line
          console.log("🚀 ~ getAuditData ~ filter:", log)
          return (
            log?.display_type?.toLowerCase()?.includes(filter?.toLowerCase())
          );
        });
      }) : transformedData = transformedData.filter((log) => {
        return filters.some((filter) => {
          return (
            log?.data_type?.toLowerCase()?.includes(filter?.toLowerCase())
          );
        });
      });

    }
    // Apply search filter if searchText is provided and not "null"
    if (searchText && searchText !== "null") {
      transformedData = transformedData.filter((item: any) => {
        // Adjust these fields based on your actual audit data structure
        return Object.values(item).some(value =>
          value &&
          typeof value === 'string' &&
          value.toLowerCase().includes(searchText.toLowerCase())
        );
      });
    }

    // Apply pagination
    const paginatedData = transformedData.slice(startIndex, stopIndex);

    return {
      data: paginatedData,
      totalCount: transformedData.length
    };

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error getting audit log data for module: ${moduleName}`,
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
 * Transforms and flattens nested data structure into an array of items
 * with sequential tuid values
 */
const transformAndFlattenData = (data: any): Array<{ [key: string]: any, id: number }> => {
  try {
    const flattenedItems: Array<{ [key: string]: any }> = [];

    // Handle the data based on its structure
    if (Array.isArray(data)) {
      // If data is already an array, use it directly
      data.forEach((item, index) => {
        flattenedItems.push({
          ...item,
          uid: item.uid || `item-${index}`
        });
      });
    } else if (typeof data === 'object' && data !== null) {
      // Process object data
      Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // If property contains an array, flatten each item
          value.forEach((item, index) => {
            flattenedItems.push({
              ...item,
              parentKey: key,
              uid: item.uid || `${key}-${index}`
            });
          });
        } else if (typeof value === 'object' && value !== null) {
          // If property contains an object, add it as an item
          flattenedItems.push({
            ...value,
            key,
            uid: (value as any).uid || key
          });
        }
      });
    }

    // Add sequential tuid to each item
    return flattenedItems.map((item, index) => ({
      ...item,
      id: index + 1
    }));
  } catch (error) {
    console.error('Error transforming data:', error);
    return [];
  }
};
/**
 * Deletes a test stack.
 * @param req - The request object.
 * @returns A promise that resolves to a LoginServiceType object.
 */
const deleteTestStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = 'deleteTestStack';
  const projectId = req?.params?.projectId;
  const { token_payload, stack_key } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: 'DELETE',
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
      .get('projects')
      .findIndex({ id: projectId })
      .value();

    if (index > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[index].current_test_stack_id = '';
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
        'Error while creating a stack',
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
  const project: any = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();
  const packagePath = project?.extract_path;
  if (project?.current_test_stack_id) {
    const {
      legacy_cms: { cms, file_path },
    } = project;
    const loggerPath = path.join(
      process.cwd(),
      'logs',
      projectId,
      `${project?.current_test_stack_id}.log`
    );
    const message = getLogMessage(
      'startTestMigration',
      'Starting Test Migration...',
      {}
    );
    await customLogger(
      projectId,
      project?.current_test_stack_id,
      'info',
      message
    );
    await setLogFilePath(loggerPath);
    const copyLogsToTestStack = async (
      stackUid: string,
      projectLogPath: string
    ) => {
      try {
        // Path to source logs
        const importLogsPath = path.join(
          process.cwd(),
          'migration-data',
          stackUid,
          'logs',
          'import'
        );

        // Read error and success logs
        const errorLogPath = path.join(importLogsPath, 'error.log');
        const successLogPath = path.join(importLogsPath, 'success.log');

        let combinedLogs = '';

        // Read and combine error logs
        if (
          await fsPromises
            .access(errorLogPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const errorLogs = await fsPromises.readFile(errorLogPath, 'utf8');
          combinedLogs += errorLogs + '\n';
        }

        // Read and combine success logs
        if (
          await fsPromises
            .access(successLogPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const successLogs = await fsPromises.readFile(successLogPath, 'utf8');
          combinedLogs += successLogs;
        }

        // Write combined logs to test stack log file
        await fsPromises.appendFile(projectLogPath, combinedLogs);
      } catch (error) {
        console.error('Error copying logs:', error);
      }
    };

    await copyLogsToTestStack(project?.current_test_stack_id, loggerPath);
    const contentTypes = await fieldAttacher({
      orgId,
      projectId,
      destinationStackId: project?.current_test_stack_id,
      region,
      user_id,
    });
    await marketPlaceAppService?.createAppManifest({
      orgId,
      destinationStackId: project?.current_test_stack_id,
      region,
      userId: user_id,
    });
    await extensionService?.createExtension({
      destinationStackId: project?.current_test_stack_id,
    });
    switch (cms) {
      case CMS.SITECORE_V8:
      case CMS.SITECORE_V9:
      case CMS.SITECORE_V10: {
        if (packagePath) {
          await siteCoreService?.createEntry({
            packagePath,
            contentTypes,
            master_locale: project?.stackDetails?.master_locale,
            destinationStackId: project?.current_test_stack_id,
            projectId,
            keyMapper: project?.mapperKeys,
            project
          });
          await siteCoreService?.createLocale(
            req,
            project?.current_test_stack_id,
            projectId,
            project
          );
          await siteCoreService?.createVersionFile(
            project?.current_test_stack_id
          );
        }
        break;
      }
      case CMS.WORDPRESS: {
        if (packagePath) {
          await wordpressService?.createLocale(req, project?.current_test_stack_id, projectId, project);
          await wordpressService?.getAllAssets(file_path, packagePath, project?.current_test_stack_id, projectId)
          await wordpressService?.createAssetFolderFile(file_path, project?.current_test_stack_id, projectId)
          await wordpressService?.getAllreference(file_path, packagePath, project?.current_test_stack_id, projectId)
          await wordpressService?.extractChunks(file_path, packagePath, project?.current_test_stack_id, projectId)
          await wordpressService?.getAllAuthors(file_path, packagePath, project?.current_test_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          //await wordpressService?.extractContentTypes(projectId, project?.current_test_stack_id, contentTypes)
          await wordpressService?.getAllTerms(file_path, packagePath, project?.current_test_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.getAllTags(file_path, packagePath, project?.current_test_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.getAllCategories(file_path, packagePath, project?.current_test_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.extractPosts(packagePath, project?.current_test_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.extractGlobalFields(project?.current_test_stack_id, projectId)
          await wordpressService?.createVersionFile(project?.current_test_stack_id, projectId);
        }
        break;
      }
      case CMS.CONTENTFUL: {
        const cleanLocalPath = file_path?.replace?.(/\/$/, '');
        await contentfulService?.createLocale(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          project
        );
        await contentfulService?.createRefrence(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId
        );
        await contentfulService?.createWebhooks(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId
        );
        await contentfulService?.createEnvironment(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId
        );
        await contentfulService?.createAssets(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          true
        );
        await contentfulService?.createEntry(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          contentTypes,
          project?.mapperKeys,
          project?.stackDetails?.master_locale,
          project
        );
        await contentfulService?.createVersionFile(
          project?.current_test_stack_id,
          projectId
        );
        break;
      }
      default:
        break;
    }
    await testFolderCreator?.({
      destinationStackId: project?.current_test_stack_id,
    });
    await utilsCli?.runCli(
      region,
      user_id,
      project?.current_test_stack_id,
      projectId,
      true,
      loggerPath
    );
  }
};

/**
 * Start final Migration.
 *
 * @param req - The request object containing the necessary parameters.
 */
const startMigration = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const { region, user_id } = req?.body?.token_payload ?? {};
  await ProjectModelLowdb.read();
  const project: any = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();

  const index = ProjectModelLowdb.chain
    .get('projects')
    .findIndex({ id: projectId })
    .value();
  if (index > -1) {
    ProjectModelLowdb.update((data: any) => {
      data.projects[index].isMigrationStarted = true;
    });
  }

  const packagePath = project?.extract_path;
  if (project?.destination_stack_id) {
    const {
      legacy_cms: { cms, file_path },
    } = project;
    const loggerPath = path.join(
      process.cwd(),
      'logs',
      projectId,
      `${project?.destination_stack_id}.log`
    );
    await setLogFilePath(loggerPath);

    const copyLogsToStack = async (
      stackUid: string,
      projectLogPath: string
    ) => {
      try {
        // Path to source logs
        const importLogsPath = path.join(
          process.cwd(),
          'migration-data',
          stackUid,
          'logs',
          'import'
        );

        // Read error and success logs
        const errorLogPath = path.join(importLogsPath, 'error.log');
        const successLogPath = path.join(importLogsPath, 'success.log');

        let combinedLogs = '';

        // Read and combine error logs
        if (
          await fsPromises
            .access(errorLogPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const errorLogs = await fsPromises.readFile(errorLogPath, 'utf8');
          combinedLogs += errorLogs + '\n';
        }

        // Read and combine success logs
        if (
          await fsPromises
            .access(successLogPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const successLogs = await fsPromises.readFile(successLogPath, 'utf8');
          combinedLogs += successLogs;
        }

        // Write combined logs to stack log file
        await fsPromises.appendFile(projectLogPath, combinedLogs);
      } catch (error) {
        console.error('Error copying logs:', error);
      }
    };

    await copyLogsToStack(project?.destination_stack_id, loggerPath);

    const contentTypes = await fieldAttacher({
      orgId,
      projectId,
      destinationStackId: project?.destination_stack_id,
      region,
      user_id,
    });
    await marketPlaceAppService?.createAppManifest({
      orgId,
      destinationStackId: project?.destination_stack_id,
      region,
      userId: user_id,
    });
    await extensionService?.createExtension({
      destinationStackId: project?.destination_stack_id,
    });
    switch (cms) {
      case CMS.SITECORE_V8:
      case CMS.SITECORE_V9:
      case CMS.SITECORE_V10: {
        if (packagePath) {
          await siteCoreService?.createEntry({
            packagePath,
            contentTypes,
            master_locale: project?.stackDetails?.master_locale,
            destinationStackId: project?.destination_stack_id,
            projectId,
            keyMapper: project?.mapperKeys,
            project
          });
          await siteCoreService?.createLocale(
            req,
            project?.destination_stack_id,
            projectId,
            project
          );
          await siteCoreService?.createVersionFile(
            project?.destination_stack_id
          );
        }
        break;
      }
      case CMS.WORDPRESS: {
        if (packagePath) {
          await wordpressService?.createLocale(req, project?.current_test_stack_id, projectId, project);
          await wordpressService?.getAllAssets(file_path, packagePath, project?.destination_stack_id, projectId,)
          await wordpressService?.createAssetFolderFile(file_path, project?.destination_stack_id, projectId)
          await wordpressService?.getAllreference(file_path, packagePath, project?.destination_stack_id, projectId)
          await wordpressService?.extractChunks(file_path, packagePath, project?.destination_stack_id, projectId)
          await wordpressService?.getAllAuthors(file_path, packagePath, project?.destination_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          //await wordpressService?.extractContentTypes(projectId, project?.destination_stack_id)
          await wordpressService?.getAllTerms(file_path, packagePath, project?.destination_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.getAllTags(file_path, packagePath, project?.destination_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.getAllCategories(file_path, packagePath, project?.destination_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.extractPosts(packagePath, project?.destination_stack_id, projectId, contentTypes, project?.mapperKeys, project?.stackDetails?.master_locale, project)
          await wordpressService?.extractGlobalFields(project?.destination_stack_id, projectId)
          await wordpressService?.createVersionFile(project?.destination_stack_id, projectId);
        }
        break;
      }
      case CMS.CONTENTFUL: {
        const cleanLocalPath = file_path?.replace?.(/\/$/, '');
        await contentfulService?.createLocale(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
          project
        );
        await contentfulService?.createRefrence(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId
        );
        await contentfulService?.createWebhooks(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId
        );
        await contentfulService?.createEnvironment(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId
        );
        await contentfulService?.createAssets(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId
        );
        await contentfulService?.createEntry(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
          contentTypes,
          project?.mapperKeys,
          project?.stackDetails?.master_locale,
          project
        );
        await contentfulService?.createVersionFile(
          project?.destination_stack_id,
          projectId
        );
        break;
      }
      default:
        break;
    }
    await utilsCli?.runCli(
      region,
      user_id,
      project?.destination_stack_id,
      projectId,
      false,
      loggerPath
    );
  }
};

const getLogs = async (req: Request): Promise<any> => {
  const projectId = path.basename(req?.params?.projectId);
  const stackId = path.basename(req?.params?.stackId);
  const srcFunc = 'getLogs';

  if (projectId.includes('..') || stackId.includes('..')) {
    throw new BadRequestError('Invalid projectId or stackId');
  }

  try {
    const logsDir = path.join(process.cwd(), 'logs');
    const loggerPath = path.join(logsDir, projectId, `${stackId}.log`);
    const absolutePath = path.resolve(loggerPath); // Resolve the absolute path

    if (!absolutePath.startsWith(logsDir)) {
      throw new BadRequestError('Access to this file is not allowed.');
    }

    if (fs.existsSync(absolutePath)) {
      const logs = await fs.promises.readFile(absolutePath, 'utf8');
      const logEntries = logs
        .split('\n')
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return null;
          }
        })
        .filter((entry) => entry !== null);
      return logEntries;
    } else {
      logger.error(getLogMessage(srcFunc, HTTP_TEXTS.LOGS_NOT_FOUND));
      throw new BadRequestError(HTTP_TEXTS.LOGS_NOT_FOUND);
    }
  } catch (error: any) {
    logger.error(getLogMessage(srcFunc, HTTP_TEXTS.LOGS_NOT_FOUND, error));
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * @description -  This function takes all the fetched locales from the exported data of the legacy CMS and stores/updates them in the project.json in DB
 *
 * @param req - A request body object with  fetched locales [] as payload along with project ID in params
 * @return - void
 * @throws Exception if the project ID is invalid or the when the path to project.json is incorrect
 */
export const createSourceLocales = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const locales = req?.body?.locale;

  try {
    // Find the project with the specified projectId
    await ProjectModelLowdb?.read?.();
    const index = ProjectModelLowdb?.chain
      ?.get?.('projects')
      ?.findIndex?.({ id: projectId })
      ?.value?.();
    if (index > -1) {
      ProjectModelLowdb?.update?.((data: any) => {
        data.projects[index].source_locales = locales;
      });
    } else {
      logger.error(`Project with ID: ${projectId} not found`, {
        status: HTTP_CODES?.NOT_FOUND,
        message: HTTP_TEXTS?.INVALID_ID,
      });
    }
  } catch (err: any) {
    console.error(
      '🚀 ~ createSourceLocales ~ err:',
      err?.response?.data ?? err,
      err
    );
    logger.warn('Bad Request', {
      status: HTTP_CODES?.BAD_REQUEST,
      message: HTTP_TEXTS?.INTERNAL_ERROR,
    });
    throw new ExceptionFunction(
      err?.message || HTTP_TEXTS.INTERNAL_ERROR,
      err?.statusCode || err?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * @description - Function retrieves the mapped locales and updates them in the project.json in DB
 * @param req - A request body object with mapped locales as payload and project ID in the params
 * @return - void
 * @throws Exception if the project ID is invalid or the when the path to project.json is incorrect
 */
export const updateLocaleMapper = async (req: Request) => {
  const mapperObject = req?.body;
  // Adjusted path to project.json
  const projectId = req?.params?.projectId;

  try {
    // Find the project with the specified projectId
    await ProjectModelLowdb?.read?.();
    const index = ProjectModelLowdb?.chain
      ?.get?.('projects')
      ?.findIndex?.({ id: projectId })
      ?.value?.();
    if (index > -1) {
      ProjectModelLowdb?.update?.((data: any) => {
        data.projects[index].master_locale = mapperObject?.master_locale;
        data.projects[index].locales = mapperObject?.locales;
      });
      // Write back the updated projects
    } else {
      logger.error(`Project with ID: ${projectId} not found`, {
        status: HTTP_CODES?.NOT_FOUND,
        message: HTTP_TEXTS?.INVALID_ID,
      });
    }
  } catch (err: any) {
    console.error(
      '🚀 ~ updateLocaleMapper ~ err:',
      err?.response?.data ?? err,
      err
    );
    logger.warn('Bad Request', {
      status: HTTP_CODES?.BAD_REQUEST,
      message: HTTP_TEXTS?.INTERNAL_ERROR,
    });
    throw new ExceptionFunction(
      err?.message || HTTP_TEXTS.INTERNAL_ERROR,
      err?.statusCode || err?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const migrationService = {
  createTestStack,
  deleteTestStack,
  startTestMigration,
  startMigration,
  getLogs,
  createSourceLocales,
  updateLocaleMapper,
  getAuditData
};
