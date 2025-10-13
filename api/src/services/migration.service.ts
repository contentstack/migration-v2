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
  GET_AUDIT_DATA,
} from '../constants/index.js';
import {
  BadRequestError,
  ExceptionFunction,
} from '../utils/custom-errors.utils.js';
import { fieldAttacher } from '../utils/field-attacher.utils.js';
import { siteCoreService } from './sitecore.service.js';
import { wordpressService } from './wordpress.service.js';
import { drupalService } from './drupal.service.js';
import { testFolderCreator } from '../utils/test-folder-creator.utils.js';
import { utilsCli } from './runCli.service.js';
import customLogger from '../utils/custom-logger.utils.js';
import { setLogFilePath } from '../server.js';
import fs from 'fs';
import { contentfulService } from './contentful.service.js';
import { marketPlaceAppService } from './marketplace.service.js';
import { extensionService } from './extension.service.js';
import fsPromises from 'fs/promises';
import { matchesSearchText } from '../utils/search.util.js';
import { taxonomyService } from './taxonomy.service.js';
import { globalFieldServie } from './globalField.service.js';
import { getSafePath } from '../utils/sanitize-path.utils.js';
import { aemService } from './aem.service.js';

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
      // ✅ NEW: Generate queries for new test stack (Drupal only)
      const project = ProjectModelLowdb.data.projects[index];
      if (project?.legacy_cms?.cms === CMS.DRUPAL) {
        try {
          const startMessage = getLogMessage(
            srcFun,
            `Generating dynamic queries for new test stack (${res?.data?.stack?.api_key})...`,
            token_payload
          );
          await customLogger(
            projectId,
            res?.data?.stack?.api_key,
            'info',
            startMessage
          );

          // Get database configuration from project
          const dbConfig = {
            host: project?.legacy_cms?.mySQLDetails?.host,
            user: project?.legacy_cms?.mySQLDetails?.user,
            password: project?.legacy_cms?.mySQLDetails?.password || '',
            database: project?.legacy_cms?.mySQLDetails?.database,
            port: project?.legacy_cms?.mySQLDetails?.port || 3306,
          };

          // Generate dynamic queries for the new test stack
          await drupalService.createQuery(
            dbConfig,
            res?.data?.stack?.api_key,
            projectId
          );

          const successMessage = getLogMessage(
            srcFun,
            `Successfully generated queries for test stack (${res?.data?.stack?.api_key})`,
            token_payload
          );
          await customLogger(
            projectId,
            res?.data?.stack?.api_key,
            'info',
            successMessage
          );
        } catch (error: any) {
          const errorMessage = getLogMessage(
            srcFun,
            `Failed to generate queries for test stack: ${error.message}. Test migration may fail.`,
            token_payload,
            error
          );
          await customLogger(
            projectId,
            res?.data?.stack?.api_key,
            'error',
            errorMessage
          );
          // Don't throw error - let test stack creation succeed even if query generation fails
        }
      }

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
        url: `${
          config.CS_URL[token_payload?.region as keyof typeof config.CS_URL]
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
    await taxonomyService?.createTaxonomy({
      orgId,
      projectId,
      stackId: project?.destination_stack_id,
      current_test_stack_id: project?.current_test_stack_id,
      region,
      userId: user_id,
    });
    await globalFieldServie?.createGlobalField({
      region,
      user_id,
      stackId: project?.destination_stack_id,
      current_test_stack_id: project?.current_test_stack_id,
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
            project,
          });
          await siteCoreService?.createLocale(
            req,
            project?.current_test_stack_id,
            projectId,
            project
          );
          await siteCoreService?.createEnvironment(
            project?.current_test_stack_id
          );
          await siteCoreService?.createVersionFile(
            project?.current_test_stack_id
          );
        }
        break;
      }
      case CMS.WORDPRESS: {
        if (packagePath) {
          await wordpressService?.createLocale(
            req,
            project?.current_test_stack_id,
            projectId,
            project
          );
          await wordpressService?.getAllAssets(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId
          );
          await wordpressService?.createAssetFolderFile(
            file_path,
            project?.current_test_stack_id,
            projectId
          );
          await wordpressService?.getAllreference(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId
          );
          await wordpressService?.extractChunks(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId
          );
          await wordpressService?.getAllAuthors(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          //await wordpressService?.extractContentTypes(projectId, project?.current_test_stack_id, contentTypes)
          await wordpressService?.getAllTerms(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.getAllTags(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.getAllCategories(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractPosts(
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractPages(
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractGlobalFields(
            project?.current_test_stack_id,
            projectId
          );
          await wordpressService?.createVersionFile(
            project?.current_test_stack_id,
            projectId
          );
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

      case CMS.AEM: {
        await aemService.createAssets({
          projectId,
          packagePath,
          destinationStackId: project?.current_test_stack_id,
        });
        await aemService.createEntry({
          packagePath,
          contentTypes,
          master_locale: project?.stackDetails?.master_locale,
          destinationStackId: project?.current_test_stack_id,
          projectId,
          keyMapper: project?.mapperKeys,
          project,
        });
        await aemService?.createLocale(
          req,
          project?.current_test_stack_id,
          projectId,
          project
        );
        await aemService?.createVersionFile(project?.current_test_stack_id);
        break;
      }

      case CMS.DRUPAL: {
        // Get database configuration from project
        const dbConfig = {
          host: project?.legacy_cms?.mySQLDetails?.host,
          user: project?.legacy_cms?.mySQLDetails?.user,
          password: project?.legacy_cms?.mySQLDetails?.password || '',
          database: project?.legacy_cms?.mySQLDetails?.database,
          port: project?.legacy_cms?.mySQLDetails?.port || 3306,
        };

        // Get Drupal assets URL configuration from project, request body, or environment variables
        // Priority: project config > request body > environment variables > empty (auto-detection)
        const drupalAssetsConfig = {
          base_url:
            project?.legacy_cms?.assetsConfig?.base_url ||
            req.body?.assetsConfig?.base_url ||
            process.env.DRUPAL_ASSETS_BASE_URL ||
            '',
          public_path:
            project?.legacy_cms?.assetsConfig?.public_path ||
            req.body?.assetsConfig?.public_path ||
            process.env.DRUPAL_ASSETS_PUBLIC_PATH ||
            '',
        };

        console.log(
          '🔧 Migration service - drupalAssetsConfig:',
          drupalAssetsConfig
        );

        // Run Drupal migration services in proper order (following test-drupal-services sequence)
        // Step 1: Generate dynamic queries from database analysis (MUST RUN FIRST)
        await drupalService?.createQuery(
          dbConfig,
          project?.current_test_stack_id,
          projectId
        );

        // Step 2: Generate content type schemas from upload-api (CRITICAL: Must run after upload-api generates schema)
        await drupalService?.generateContentTypeSchemas(
          project?.current_test_stack_id,
          projectId
        );

        await drupalService?.createAssets(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true,
          drupalAssetsConfig
        );
        await drupalService?.createRefrence(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true
        );
        await drupalService?.createTaxonomy(
          dbConfig,
          project?.current_test_stack_id,
          projectId
        );
        await drupalService?.createEntry(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true,
          project?.stackDetails?.master_locale,
          project?.content_mapper || []
        );
        await drupalService?.createLocale(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          project
        );
        await drupalService?.createVersionFile(
          project?.current_test_stack_id,
          projectId
        );
        break;
      }
      default:
        break;
    }
    if (cms !== CMS.AEM) {
      await testFolderCreator?.({
        destinationStackId: project?.current_test_stack_id,
      });
    }
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
    await ProjectModelLowdb.update((data: any) => {
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
    const message = getLogMessage(
      'start Migration',
      'Starting Migration...',
      {}
    );
    await customLogger(
      projectId,
      project?.destination_stack_id,
      'info',
      message
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
    await taxonomyService?.createTaxonomy({
      orgId,
      projectId,
      stackId: project?.destination_stack_id,
      current_test_stack_id: project?.destination_stack_id,
      region,
      userId: user_id,
    });
    await globalFieldServie?.createGlobalField({
      region,
      user_id,
      stackId: project?.destination_stack_id,
      current_test_stack_id: project?.destination_stack_id,
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
            project,
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
          await wordpressService?.createLocale(
            req,
            project?.current_test_stack_id,
            projectId,
            project
          );
          await wordpressService?.getAllAssets(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId
          );
          await wordpressService?.createAssetFolderFile(
            file_path,
            project?.destination_stack_id,
            projectId
          );
          await wordpressService?.getAllreference(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId
          );
          await wordpressService?.extractChunks(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId
          );
          await wordpressService?.getAllAuthors(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          //await wordpressService?.extractContentTypes(projectId, project?.destination_stack_id)
          await wordpressService?.getAllTerms(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.getAllTags(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.getAllCategories(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractPosts(
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractPages(
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project
          );
          await wordpressService?.extractGlobalFields(
            project?.destination_stack_id,
            projectId
          );
          await wordpressService?.createVersionFile(
            project?.destination_stack_id,
            projectId
          );
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
      case CMS.AEM: {
        await aemService.createAssets({
          projectId,
          packagePath,
          destinationStackId: project?.current_test_stack_id,
        });
        await aemService.createEntry({
          packagePath,
          contentTypes,
          master_locale: project?.stackDetails?.master_locale,
          destinationStackId: project?.destination_stack_id,
          projectId,
          keyMapper: project?.mapperKeys,
          project,
        });
        await aemService?.createLocale(
          req,
          project?.destination_stack_id,
          projectId,
          project
        );
        await aemService?.createVersionFile(project?.destination_stack_id);
        break;
      }

      case CMS.DRUPAL: {
        // Get database configuration from project
        const dbConfig = {
          host: project?.legacy_cms?.mySQLDetails?.host,
          user: project?.legacy_cms?.mySQLDetails?.user,
          password: project?.legacy_cms?.mySQLDetails?.password || '',
          database: project?.legacy_cms?.mySQLDetails?.database,
          port: project?.legacy_cms?.mySQLDetails?.port || 3306,
        };

        // Get Drupal assets URL configuration from project, request body, or environment variables
        // Priority: project config > request body > environment variables > empty (auto-detection)
        const drupalAssetsConfig = {
          base_url:
            project?.legacy_cms?.assetsConfig?.base_url ||
            req.body?.assetsConfig?.base_url ||
            process.env.DRUPAL_ASSETS_BASE_URL ||
            '',
          public_path:
            project?.legacy_cms?.assetsConfig?.public_path ||
            req.body?.assetsConfig?.public_path ||
            process.env.DRUPAL_ASSETS_PUBLIC_PATH ||
            '',
        };

        console.log(
          '🔧 Migration service (production) - drupalAssetsConfig:',
          drupalAssetsConfig
        );

        // Run Drupal migration services in proper order (following test-drupal-services sequence)
        // Step 1: Generate dynamic queries from database analysis (MUST RUN FIRST)
        await drupalService?.createQuery(
          dbConfig,
          project?.destination_stack_id,
          projectId
        );

        // Step 2: Generate content type schemas from upload-api (CRITICAL: Must run after upload-api generates schema)
        await drupalService?.generateContentTypeSchemas(
          project?.destination_stack_id,
          projectId
        );

        await drupalService?.createAssets(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false,
          drupalAssetsConfig
        );
        await drupalService?.createRefrence(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false
        );
        await drupalService?.createTaxonomy(
          dbConfig,
          project?.destination_stack_id,
          projectId
        );
        await drupalService?.createLocale(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          project
        );
        await drupalService?.createEntry(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false,
          project?.stackDetails?.master_locale,
          project?.content_mapper || []
        );
        await drupalService?.createVersionFile(
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
const getAuditData = async (req: Request): Promise<any> => {
  const projectId = path?.basename(req?.params?.projectId);
  const stackId = path?.basename(req?.params?.stackId);
  const moduleName = path.basename(req?.params?.moduleName);
  const limit = parseInt(req?.params?.limit);
  const startIndex = parseInt(req?.params?.startIndex);
  const stopIndex = startIndex + limit;
  const searchText = req?.params?.searchText;
  const filter = req?.params?.filter;
  const srcFunc = 'getAuditData';
  if (
    projectId?.includes('..') ||
    stackId?.includes('..') ||
    moduleName?.includes('..')
  ) {
    throw new BadRequestError('Invalid projectId, stackId, or moduleName');
  }

  try {
    const mainPath = process?.cwd();
    const logsDir = path.join(mainPath, GET_AUDIT_DATA?.MIGRATION_DATA_DIR);

    const stackFolders = fs.readdirSync(logsDir);

    const stackFolder = stackFolders?.find((folder) =>
      folder?.startsWith?.(stackId)
    );
    if (!stackFolder) {
      throw new BadRequestError('Migration data not found for this stack');
    }
    const auditLogPath = path?.resolve(
      logsDir,
      stackFolder,
      GET_AUDIT_DATA?.LOGS_DIR,
      GET_AUDIT_DATA?.AUDIT_DIR,
      GET_AUDIT_DATA?.AUDIT_REPORT
    );
    if (!fs.existsSync(auditLogPath)) {
      throw new BadRequestError('Audit log path not found');
    }
    const filePath = path?.resolve(auditLogPath, `${moduleName}.json`);
    let fileData;
    if (moduleName === 'Entries_Select_feild') {
      const entriesSelectFieldPath = filePath;
      const entriesPath = path?.resolve(auditLogPath, `entries.json`);
      const entriesSelectFieldExists = fs?.existsSync(entriesSelectFieldPath);
      const entriesExists = fs?.existsSync(entriesPath);
      let combinedData: any[] = [];
      const addToCombined = (parsed: any) => {
        if (Array.isArray(parsed)) {
          combinedData = combinedData.concat(parsed);
        } else if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach((val) => {
            if (Array.isArray(val)) {
              combinedData = combinedData.concat(val);
            } else if (val && typeof val === 'object') {
              combinedData.push(val);
            }
          });
        }
      };
      if (entriesSelectFieldExists) {
        const safeEntriesSelectFieldPath = getSafePath(entriesSelectFieldPath);
        // Ensure the sanitized path is within the auditLogPath directory
        if (!safeEntriesSelectFieldPath.startsWith(auditLogPath)) {
          throw new BadRequestError('Access to this file is not allowed.');
        }

        const fileContent = await fsPromises?.readFile(
          safeEntriesSelectFieldPath,
          'utf8'
        );
        try {
          if (typeof fileContent === 'string') {
            const parsed = JSON?.parse(fileContent);
            addToCombined(parsed);
          }
        } catch (error) {
          logger.error(
            `Error parsing JSON from file ${entriesSelectFieldPath}:`,
            error
          );
          throw new BadRequestError('Invalid JSON format in audit file');
        }
      }
      if (entriesExists) {
        const safeEntriesPath = getSafePath(entriesPath);
        // Ensure the sanitized path is within the auditLogPath directory
        if (!safeEntriesPath.startsWith(auditLogPath)) {
          throw new BadRequestError('Access to this file is not allowed.');
        }
        const fileContent = await fsPromises?.readFile(safeEntriesPath, 'utf8');
        try {
          if (typeof fileContent === 'string') {
            const parsed = JSON?.parse(fileContent);
            addToCombined(parsed);
          }
        } catch (error) {
          logger.error(`Error parsing JSON from file ${entriesPath}:`, error);
          throw new BadRequestError('Invalid JSON format in audit file');
        }
      }
      fileData = combinedData;
    } else {
      if (fs?.existsSync(filePath)) {
        const safeFilePath = getSafePath(filePath);
        // Ensure the sanitized path is within the auditLogPath directory
        if (!safeFilePath.startsWith(auditLogPath)) {
          throw new BadRequestError('Access to this file is not allowed.');
        }
        // Prevent path traversal by checking for '..' and ensuring the path is within auditLogPath
        if (
          safeFilePath.includes('..') ||
          !safeFilePath.startsWith(auditLogPath)
        ) {
          throw new BadRequestError(
            'Path traversal detected or access to this file is not allowed.'
          );
        }
        const fileContent = await fsPromises?.readFile(safeFilePath, 'utf8');
        try {
          if (typeof fileContent === 'string') {
            fileData = JSON?.parse(fileContent);
          }
        } catch (error) {
          logger.error(`Error parsing JSON from file ${filePath}:`, error);
          throw new BadRequestError('Invalid JSON format in audit file');
        }
      }
    }

    if (!fileData) {
      throw new BadRequestError(
        `No audit data found for module: ${moduleName}`
      );
    }
    let transformedData = transformAndFlattenData(fileData);
    if (moduleName === 'Entries_Select_feild') {
      if (filter != GET_AUDIT_DATA?.FILTERALL) {
        const filters = filter?.split('-');
        transformedData = transformedData?.filter((log) => {
          return filters?.some((filter) => {
            return (
              log?.display_type
                ?.toLowerCase()
                ?.includes(filter?.toLowerCase()) ||
              log?.data_type?.toLowerCase()?.includes(filter?.toLowerCase())
            );
          });
        });
      }
      if (searchText && searchText !== null && searchText !== 'null') {
        transformedData = transformedData?.filter((item) => {
          return Object?.values(item)?.some(
            (value) =>
              value &&
              typeof value === 'string' &&
              value?.toLowerCase?.()?.includes(searchText?.toLowerCase())
          );
        });
      }
      const finalData = transformedData?.slice?.(startIndex, stopIndex);
      return {
        data: finalData,
        totalCount: transformedData?.length,
        status: HTTP_CODES?.OK,
      };
    }
    if (filter != GET_AUDIT_DATA?.FILTERALL) {
      const filters = filter?.split('-');
      transformedData = transformedData?.filter((log) => {
        return filters?.some((filter) => {
          return log?.data_type?.toLowerCase()?.includes(filter?.toLowerCase());
        });
      });
    }
    if (searchText && searchText !== null && searchText !== 'null') {
      transformedData = transformedData?.filter((item: any) => {
        return Object?.values(item)?.some(
          (value) =>
            value &&
            typeof value === 'string' &&
            value?.toLowerCase?.()?.includes(searchText?.toLowerCase())
        );
      });
    }
    const paginatedData = transformedData?.slice?.(startIndex, stopIndex);

    return {
      data: paginatedData,
      totalCount: transformedData?.length,
      status: HTTP_CODES?.OK,
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
      error?.message || HTTP_TEXTS?.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES?.SERVER_ERROR
    );
  }
};
/**
 * Transforms and flattens nested data structure into an array of items
 * with sequential tuid values
 */
const transformAndFlattenData = (
  data: any
): Array<{ [key: string]: any; id: number }> => {
  try {
    const flattenedItems: Array<{ [key: string]: any }> = [];
    if (Array.isArray(data)) {
      data?.forEach((item, index) => {
        flattenedItems?.push({
          ...(item ?? {}),
          uid: item?.uid || `item-${index}`,
        });
      });
    } else if (typeof data === 'object' && data !== null) {
      Object?.entries?.(data)?.forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value?.forEach((item, index) => {
            flattenedItems?.push({
              ...(item ?? {}),
              parentKey: key,
              uid: item?.uid || `${key}-${index}`,
            });
          });
        } else if (typeof value === 'object' && value !== null) {
          flattenedItems?.push({
            ...value,
            key,
            uid: (value as any)?.uid || key,
          });
        }
      });
    }

    return flattenedItems?.map((item, index) => ({
      ...(item ?? {}),
      id: index + 1,
    }));
  } catch (error) {
    console.error('Error transforming data:', error);
    return [];
  }
};
const getLogs = async (req: Request): Promise<any> => {
  const projectId = req?.params?.projectId
    ? path?.basename(req.params.projectId)
    : '';
  const stackId = req?.params?.stackId
    ? path?.basename(req.params.stackId)
    : '';
  const limit = req?.params?.limit ? parseInt(req.params.limit) : 10;
  const startIndex = req?.params?.startIndex
    ? parseInt(req.params.startIndex)
    : 0;
  const stopIndex = startIndex + limit;
  const searchText = req?.params?.searchText ?? null;
  const filter = req?.params?.filter ?? 'all';
  const srcFunc = 'getLogs';
  if (
    !projectId ||
    !stackId ||
    projectId?.includes('..') ||
    stackId?.includes('..')
  ) {
    throw new BadRequestError('Invalid projectId or stackId');
  }
  try {
    const mainPath = process?.cwd();
    if (!mainPath) {
      throw new BadRequestError('Invalid application path');
    }
    const logsDir = path?.join(mainPath, 'logs');
    const loggerPath = path?.join(logsDir, projectId, `${stackId}.log`);
    const absolutePath = path?.resolve(loggerPath);
    if (!absolutePath?.startsWith(logsDir)) {
      throw new BadRequestError('Access to this file is not allowed.');
    }
    if (fs.existsSync(absolutePath)) {
      let index = 0;
      const logs = await fs?.promises?.readFile?.(absolutePath, 'utf8');
      let logEntries = logs
        ?.split('\n')
        ?.map((line) => {
          try {
            const parsedLine = JSON?.parse(line);
            parsedLine && (parsedLine['id'] = index);

            ++index;
            return parsedLine ? parsedLine : null;
          } catch (error) {
            return null;
          }
        })
        ?.filter?.((entry) => entry !== null);
      if (!logEntries?.length) {
        return {
          logs: [],
          total: 0,
          filterOptions: [],
          status: HTTP_CODES?.OK,
        };
      }
      const filterOptions = Array?.from(
        new Set(logEntries?.map((log) => log?.level))
      );
      const auditStartIndex = logEntries?.findIndex?.((log) =>
        log?.message?.includes('Starting audit process')
      );
      const auditEndIndex = logEntries?.findIndex?.((log) =>
        log?.message?.includes('Audit process completed')
      );
      logEntries = logEntries?.slice?.(1, logEntries?.length - 2);
      if (filter !== 'all') {
        const filters = filter?.split('-') ?? [];
        logEntries = logEntries?.filter((log) => {
          return filters?.some((filter) => {
            return log?.level
              ?.toLowerCase()
              ?.includes?.(filter?.toLowerCase() ?? '');
          });
        });
      }
      if (searchText && searchText !== 'null') {
        logEntries = logEntries?.filter?.((log) =>
          matchesSearchText(log, searchText)
        );
      }
      const paginatedLogs = logEntries?.slice?.(startIndex, stopIndex) ?? [];
      return {
        logs: paginatedLogs,
        total: logEntries?.length ?? 0,
        filterOptions: filterOptions,
        status: HTTP_CODES?.OK,
      };
    } else {
      logger.error(getLogMessage(srcFunc, HTTP_TEXTS?.LOGS_NOT_FOUND));
      throw new BadRequestError(HTTP_TEXTS?.LOGS_NOT_FOUND);
    }
  } catch (error: any) {
    logger.error(getLogMessage(srcFunc, HTTP_TEXTS?.LOGS_NOT_FOUND, error));
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS?.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES?.SERVER_ERROR
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
  getAuditData,
};
