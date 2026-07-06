// eslint-disable-next-line @typescript-eslint/no-unused-expressions
/* eslint-disable */

import { Request } from 'express';
import path from 'path';
import ProjectModelLowdb from '../models/project-lowdb.js';
import { config } from '../config/index.js';
import { safePromise, getLogMessage } from '../utils/index.js';
import https from '../utils/https.utils.js';
import { LoginServiceType } from '../models/types.js';
import getAuthtoken, { getAccessToken } from '../utils/auth.utils.js';
import logger from '../utils/logger.js';
import {
  HTTP_TEXTS,
  HTTP_CODES,
  LOCALE_MAPPER,
  getStepperSteps,
  CMS,
  GET_AUDIT_DATA,
  MIGRATION_DATA_CONFIG,
  NEW_PROJECT_STATUS,
} from '../constants/index.js';
import {
  BadRequestError,
  ExceptionFunction,
  NotFoundError,
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
import {
  assertResolvedPathUnderBase,
  getSafePath,
  sanitizeOrgId,
  sanitizeProjectId,
  sanitizeStackId,
  assertExportPathInAllowedRoot,
} from '../utils/sanitize-path.utils.js';
import { aemService } from './aem.service.js';
import { requestWithSsoTokenRefresh } from '../utils/sso-request.utils.js';
import { utilsUpdateCli } from './updateEntryCli.service.js';
import { clearStaleEntries, enrichConfigWithAssetMapping, enrichConfigWithAssetUpdates, ensureUpdateConfigFile, removeEntriesFromDatabase } from '../utils/entry-update.utils.js';
import { removeExistingAssets, saveAssetMetadata, AssetUpdate } from '../utils/asset-update.utils.js';
import { contentMapperService } from './contentMapper.service.js';
import { exportStackCli } from './exportCli.service.js';
import {
  validateExportStructure,
  resolveContentstackExportRoot,
} from './validation.service.js';
import { generateAuditData } from './audit.service.js';
import auditDb from '../models/audit-lowdb.js';

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
    let headers: any = {
      organization_uid: orgId,
    }
    if(token_payload?.is_sso) {
      const accessToken = await getAccessToken(token_payload?.region, token_payload?.user_id);
      headers.authorization = `Bearer ${accessToken}`;
    } else if (token_payload?.is_sso === false) {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );
    headers.authtoken = authtoken;
  } else {
    throw new BadRequestError("No valid authentication token found or mismatch in is_sso flag");
  }
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

    const [err, res] = token_payload?.is_sso
      ? await requestWithSsoTokenRefresh(token_payload, {
        method: 'POST',
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: headers,
        data: {
          stack: {
            name: newName,
            description,
            master_locale,
          },
        },
      })
      : await safePromise(
        https({
          method: 'POST',
          url: `${config.CS_API[
            token_payload?.region as keyof typeof config.CS_API
          ]!}/stacks`,
          headers: headers,
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
        // Delta migration: Testing is step 5 on iteration 2+ (4 on iteration 1).
        data.projects[index].current_step =
          getStepperSteps(data.projects[index]?.iteration)['TESTING'];
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
  const { token_payload, stack_key } = req?.body;

  try {
    let headers: any = {
      api_key: stack_key,
    }
    if(token_payload?.is_sso) {
      const accessToken = await getAccessToken(token_payload?.region, token_payload?.user_id);
      headers.authorization = `Bearer ${accessToken}`;
    } else if (token_payload?.is_sso === false) {
    const authtoken = await getAuthtoken(
        token_payload?.region,
        token_payload?.user_id
      );
      headers.authtoken = authtoken;
    } else {
      throw new BadRequestError("No valid authentication token found or mismatch in is_sso flag");
    }

    const [err, res] = token_payload?.is_sso
      ? await requestWithSsoTokenRefresh(token_payload, {
        method: 'DELETE',
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: headers,
      })
      : await safePromise(
        https({
          method: 'DELETE',
          url: `${config.CS_API[
            token_payload?.region as keyof typeof config.CS_API
          ]!}/stacks`,
          headers: headers,
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
  const { region, user_id, is_sso } = req?.body?.token_payload ?? {};


  if (is_sso !== true && is_sso !== false) {
    throw new BadRequestError(
      'Invalid token_payload.is_sso; expected a boolean value.',  
    );
  }

  await ProjectModelLowdb.read();
  const project: any = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();
  if (!project) {
    throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const targetTestStackId = `${project?.current_test_stack_id || ""}`.trim();
  const packagePath = project?.extract_path;
  if (targetTestStackId) {
    const {
      legacy_cms: { cms, file_path },
    } = project;
    const logsBase = path.resolve(process.cwd(), 'logs');
    const safeTestProjectId = sanitizeProjectId(projectId);
    const safeTestStackId = sanitizeStackId(project?.current_test_stack_id);
    if (!safeTestProjectId || !safeTestStackId) {
      throw new BadRequestError(
        'Invalid project or test stack identifier; cannot create log file path.'
      );
    }
    const loggerPath = path.join(
      logsBase,
      safeTestProjectId,
      `${safeTestStackId}.log`,
    );
    assertResolvedPathUnderBase(logsBase, loggerPath);
    const message = getLogMessage(
      "startTestMigration",
      "Starting Test Migration...",
      {},
    );
    await customLogger(projectId, targetTestStackId, "info", message);
    await setLogFilePath(loggerPath);
    const copyLogsToTestStack = async (
      stackUid: string,
      projectLogPath: string,
    ) => {
      try {
        // Sanitize stackUid using dedicated sanitization function to prevent path traversal
        const sanitizedStackUid = sanitizeStackId(stackUid);

        // Validate the sanitized stackUid - sanitizeStackId returns null for invalid inputs
        if (sanitizedStackUid === null) {
          console.error("Invalid stack UID provided");
          return;
        }

        // Define base directory for validation
        const baseDir = path.join(process.cwd(), "migration-data");
        const resolvedBaseDir = path.resolve(baseDir);

        // Construct safe paths using only the validated sanitized stackUid
        const errorLogPath = path.join(
          resolvedBaseDir,
          sanitizedStackUid,
          "logs",
          "import",
          "error.log",
        );
        const successLogPath = path.join(
          resolvedBaseDir,
          sanitizedStackUid,
          "logs",
          "import",
          "success.log",
        );

        // Final validation to ensure paths are within the expected base directory
        if (
          !path.resolve(errorLogPath).startsWith(resolvedBaseDir + path.sep) ||
          !path.resolve(successLogPath).startsWith(resolvedBaseDir + path.sep)
        ) {
          console.error(
            "Invalid path detected, potential path traversal attempt",
          );
          return;
        }

        let combinedLogs = "";

        // Read and combine error logs - use realpath to canonicalize and validate path
        try {
          const canonicalErrorPath = await fsPromises.realpath(errorLogPath);
          // Verify canonical path is still within base directory
          if (canonicalErrorPath.startsWith(resolvedBaseDir + path.sep)) {
            // deepcode ignore PT: Path is sanitized via sanitizeStackId (allowlist validation),
            // path containment check, and realpath canonicalization before reading
            const errorLogs = await fsPromises.readFile(
              canonicalErrorPath,
              "utf8",
            );
            combinedLogs += errorLogs + "\n";
          }
        } catch {
          // File doesn't exist or access denied - skip
        }

        // Read and combine success logs - use realpath to canonicalize and validate path
        try {
          const canonicalSuccessPath = await fsPromises.realpath(
            successLogPath,
          );
          // Verify canonical path is still within base directory
          if (canonicalSuccessPath.startsWith(resolvedBaseDir + path.sep)) {
            // deepcode ignore PT: Path is sanitized via sanitizeStackId (allowlist validation),
            // path containment check, and realpath canonicalization before reading
            const successLogs = await fsPromises.readFile(
              canonicalSuccessPath,
              "utf8",
            );
            combinedLogs += successLogs;
          }
        } catch {
          // File doesn't exist or access denied - skip
        }

        // Write combined logs to test stack log file
        if (combinedLogs) {
          await fsPromises.appendFile(projectLogPath, combinedLogs);
        }
      } catch (error) {
        console.error("Error copying logs:", error);
      }
    };

    await copyLogsToTestStack(project?.current_test_stack_id, loggerPath);
    // Clear any stale entries from a previous run before re-transforming, so orphaned
    // chunk files cannot clobber this run's entry data during the update step.
    clearStaleEntries(project?.current_test_stack_id, loggerPath);
    // fieldAttacher uses destinationStackId as a path segment when writing content-type
    // files. Confirm the sanitized stack id resolves inside the migration-data base before
    // passing it in, so request-derived input cannot escape via path traversal.
    const testMigrationDataBase = path.resolve(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA
    );
    assertResolvedPathUnderBase(
      testMigrationDataBase,
      path.join(testMigrationDataBase, safeTestStackId)
    );
    // For Contentstack-source migrations the official CLI handles content
    // types, marketplace apps, extensions, taxonomies and global fields from
    // the export folder. Skip the per-API pre-create steps below which are
    // meant for non-CS sources and otherwise fail with "stack api key is not
    // valid" against the destination stack.
    let contentTypes: any = [];
    if (cms !== CMS.CONTENTSTACK) {
      contentTypes = await fieldAttacher({
        orgId,
        projectId: safeTestProjectId,
        destinationStackId: safeTestStackId,
        region,
        user_id,
        is_sso,
      });

      await marketPlaceAppService?.createAppManifest({
        orgId,
        destinationStackId: project?.current_test_stack_id,
        marketplaceSourceStackId: project?.destination_stack_id,
        region,
        userId: user_id,
      });
      await extensionService?.createExtension({
        destinationStackId: project?.current_test_stack_id,
        existingStackId: project?.destination_stack_id,
        token_payload: {
          region,
          user_id,
          is_sso,
        },
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
    }

    switch (cms) {
      case CMS.CONTENTSTACK: {
        const sourceExportPath =
          project?.legacy_cms?.source_details?.export_path ||
          project?.legacy_cms?.source_details?.imported_data_path ||
          project?.extract_path;
        if (!sourceExportPath) {
          throw new BadRequestError(
            HTTP_TEXTS.CS_SOURCE_EXPORT_PATH_REQUIRED,
          );
        }
        // Note: CLI import will be handled by runCli() below for consistent logging
        break;
      }
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
            project,
          );
          await siteCoreService?.createEnvironment(
            project?.current_test_stack_id,
          );
          await siteCoreService?.createVersionFile(
            project?.current_test_stack_id,
          );
        }
        break;
      }
      case CMS.WORDPRESS: {
        if (packagePath) {
          await wordpressService?.getAllAssets(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
          );
          await wordpressService?.createTaxonomy(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project,
          );
          await wordpressService?.createEntry(
            file_path,
            packagePath,
            project?.current_test_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project,
          );
          await wordpressService?.createLocale(
            req,
            project?.current_test_stack_id,
            projectId,
            project,
          );
          await wordpressService?.createVersionFile(
            project?.current_test_stack_id,
            projectId,
          );
        }
        break;
      }
      case CMS.CONTENTFUL: {
        const cleanLocalPath = file_path?.replace?.(/\/$/, "");
        await contentfulService?.createLocale(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          project,
        );
        await contentfulService?.createRefrence(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
        );
        await contentfulService?.createWebhooks(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
        );
        await contentfulService?.createEnvironment(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
        );
        await contentfulService?.createAssets(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          true,
        );
        await contentfulService?.createTaxonomy(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
        );
        await contentfulService?.createEntry(
          cleanLocalPath,
          project?.current_test_stack_id,
          projectId,
          contentTypes,
          project?.mapperKeys,
          project?.stackDetails?.master_locale,
          project,
        );
        await contentfulService?.createVersionFile(
          project?.current_test_stack_id,
          projectId,
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
          project,
        );
        await aemService?.createVersionFile(project?.current_test_stack_id);
        break;
      }

      case CMS.DRUPAL: {
        // Get database configuration from project
        const dbConfig = {
          host: project?.legacy_cms?.mySQLDetails?.host,
          user: project?.legacy_cms?.mySQLDetails?.user,
          password: project?.legacy_cms?.mySQLDetails?.password || "",
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
            "",
          public_path:
            project?.legacy_cms?.assetsConfig?.public_path ||
            req.body?.assetsConfig?.public_path ||
            process.env.DRUPAL_ASSETS_PUBLIC_PATH ||
            "",
        };

        // Run Drupal migration services in proper order (following test-drupal-services sequence)
        // Step 1: Generate dynamic queries from database analysis (MUST RUN FIRST)
        await drupalService?.createQuery(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
        );

        // Step 3: Create assets from Drupal database
        await drupalService?.createAssets(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true,
          drupalAssetsConfig,
        );

        // Step 4: Create references
        await drupalService?.createRefrence(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true,
        );

        // Step 5: Create taxonomy
        await drupalService?.createTaxonomy(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
        );

        // Step 6: Create entries
        await drupalService?.createEntry(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          true,
          project?.stackDetails?.master_locale,
          project,
          contentTypes,
        );

        // Step 7: Create locale
        await drupalService?.createLocale(
          dbConfig,
          project?.current_test_stack_id,
          projectId,
          project,
        );

        // Step 8: Create version file
        await drupalService?.createVersionFile(
          project?.current_test_stack_id,
          projectId,
        );
        break;
      }

      default:
        break;
    }
    if (cms !== CMS.AEM && cms !== CMS.CONTENTSTACK) {
      await testFolderCreator?.({
        destinationStackId: project?.current_test_stack_id,
      });
    }
    await utilsCli?.runCli(
      region,
      user_id,
      targetTestStackId,
      projectId,
      true,
      loggerPath,
    );

    // Handle CMS-specific post-migration tasks
    if (cms === CMS.CONTENTSTACK) {
      // Backup cleanup is owned by runCli (it created the backup, it deletes it).
      // Update database to mark test stack as migrated
      const projectIndex = ProjectModelLowdb.chain
        .get("projects")
        .findIndex({ id: projectId })
        .value();
      if (projectIndex > -1) {
        await ProjectModelLowdb.update((data: any) => {
          const testStacks = data?.projects?.[projectIndex]?.test_stacks || [];
          testStacks?.forEach((item: any) => {
            if (item?.stackUid === targetTestStackId) {
              item.isMigrated = true;
            }
          });
        });
      }
    }
  }

  return {
    status: HTTP_CODES.OK,
    data: { message: "Test migration completed successfully" },
  };
};

/**
 * Start final Migration.
 *
 * @param req - The request object containing the necessary parameters.
 */
const startMigration = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const { region, user_id, is_sso } = req?.body?.token_payload ?? {};

  if (typeof is_sso !== "boolean") {
    throw new BadRequestError(
      'Missing or invalid SSO flag in token payload: expected boolean "is_sso".',
    );
  }

  await ProjectModelLowdb.read();
  const project: any = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  const index = ProjectModelLowdb.chain
    .get("projects")
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
    const logsBase = path.resolve(process.cwd(), 'logs');
    const safeFinalProjectId = sanitizeProjectId(projectId);
    const safeFinalStackId = sanitizeStackId(project?.destination_stack_id);
    if (!safeFinalProjectId || !safeFinalStackId) {
      logger.error(
        getLogMessage(
          'startMigration',
          'Invalid project or destination stack identifier; cannot create log file path.',
          { projectId, destinationStackId: project?.destination_stack_id }
        )
      );
      throw new BadRequestError(
        'Invalid project or destination stack identifier; cannot create log file path.'
      );
    }
    const loggerPath = path.join(
      logsBase,
      safeFinalProjectId,
      `${safeFinalStackId}.log`,
    );
    assertResolvedPathUnderBase(logsBase, loggerPath);
    const message = getLogMessage(
      "start Migration",
      "Starting Migration...",
      {},
    );
    await customLogger(
      projectId,
      project?.destination_stack_id,
      "info",
      message,
    );
    await setLogFilePath(loggerPath);

    const copyLogsToStack = async (
      stackUid: string,
      projectLogPath: string,
    ) => {
      try {
        // Sanitize stackUid using dedicated sanitization function to prevent path traversal
        const sanitizedStackUid = sanitizeStackId(stackUid);

        // Validate the sanitized stackUid - sanitizeStackId returns null for invalid inputs
        if (sanitizedStackUid === null) {
          console.error("Invalid stack UID provided");
          return;
        }

        // Define base directory for validation
        const baseDir = path.join(process.cwd(), "migration-data");
        const resolvedBaseDir = path.resolve(baseDir);

        // Construct safe paths using only the validated sanitized stackUid
        const errorLogPath = path.join(
          resolvedBaseDir,
          sanitizedStackUid,
          "logs",
          "import",
          "error.log",
        );
        const successLogPath = path.join(
          resolvedBaseDir,
          sanitizedStackUid,
          "logs",
          "import",
          "success.log",
        );

        // Final validation to ensure paths are within the expected base directory
        if (
          !path.resolve(errorLogPath).startsWith(resolvedBaseDir + path.sep) ||
          !path.resolve(successLogPath).startsWith(resolvedBaseDir + path.sep)
        ) {
          console.error(
            "Invalid path detected, potential path traversal attempt",
          );
          return;
        }

        let combinedLogs = "";

        // Read and combine error logs - use realpath to canonicalize and validate path
        try {
          const canonicalErrorPath = await fsPromises.realpath(errorLogPath);
          // Verify canonical path is still within base directory
          if (canonicalErrorPath.startsWith(resolvedBaseDir + path.sep)) {
            // deepcode ignore PT: Path is sanitized via sanitizeStackId (allowlist validation),
            // path containment check, and realpath canonicalization before reading
            const errorLogs = await fsPromises.readFile(
              canonicalErrorPath,
              "utf8",
            );
            combinedLogs += errorLogs + "\n";
          }
        } catch {
          // File doesn't exist or access denied - skip
        }

        // Read and combine success logs - use realpath to canonicalize and validate path
        try {
          const canonicalSuccessPath = await fsPromises.realpath(
            successLogPath,
          );
          // Verify canonical path is still within base directory
          if (canonicalSuccessPath.startsWith(resolvedBaseDir + path.sep)) {
            // deepcode ignore PT: Path is sanitized via sanitizeStackId (allowlist validation),
            // path containment check, and realpath canonicalization before reading
            const successLogs = await fsPromises.readFile(
              canonicalSuccessPath,
              "utf8",
            );
            combinedLogs += successLogs;
          }
        } catch {
          // File doesn't exist or access denied - skip
        }

        // Write combined logs to stack log file
        if (combinedLogs) {
          await fsPromises.appendFile(projectLogPath, combinedLogs);
        }
      } catch (error) {
        console.error("Error copying logs:", error);
      }
    };

    await copyLogsToStack(project?.destination_stack_id, loggerPath);

    // Clear any stale entries from a previous run before re-transforming, so orphaned
    // chunk files cannot clobber this run's entry data during the update step.
    clearStaleEntries(project?.destination_stack_id, loggerPath);

    // fieldAttacher uses destinationStackId as a path segment when writing content-type
    // files. Confirm the sanitized stack id resolves inside the migration-data base before
    // passing it in, so request-derived input cannot escape via path traversal.
    const finalMigrationDataBase = path.resolve(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA
    );
    assertResolvedPathUnderBase(
      finalMigrationDataBase,
      path.join(finalMigrationDataBase, safeFinalStackId)
    );

    // See note in startTestMigration: Contentstack-source migrations let
    // the CLI handle these modules from the export — skip the per-API
    // pre-create steps to avoid hitting destination APIs with a wrong
    // source-stack context.
    let contentTypes: any = [];
    if (cms !== CMS.CONTENTSTACK) {
      contentTypes = await fieldAttacher({
        orgId,
        projectId: safeFinalProjectId,
        destinationStackId: safeFinalStackId,
        region,
        user_id,
        is_sso,
      });
      await marketPlaceAppService?.createAppManifest({
        orgId,
        destinationStackId: project?.destination_stack_id,
        region,
        userId: user_id,
      });
      await extensionService?.createExtension({
        destinationStackId: project?.destination_stack_id,
        existingStackId: project?.source_stack_id,
        token_payload: {
          region,
          user_id,
          is_sso,
        },
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
    }
    switch (cms) {
      case CMS.CONTENTSTACK: {
        const sourceExportPath =
          project?.legacy_cms?.source_details?.export_path ||
          project?.legacy_cms?.source_details?.imported_data_path ||
          project?.extract_path;
        if (!sourceExportPath) {
          throw new BadRequestError(
            HTTP_TEXTS.CS_SOURCE_EXPORT_PATH_REQUIRED,
          );
        }
        // Note: CLI import will be handled by runCli() below for consistent logging
        break;
      }
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
            project,
          );
          await siteCoreService?.createVersionFile(
            project?.destination_stack_id,
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
            project,
          );
          await wordpressService?.getAllAssets(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
          );
          await wordpressService?.createTaxonomy(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project,
          );
          await wordpressService?.createEntry(
            file_path,
            packagePath,
            project?.destination_stack_id,
            projectId,
            contentTypes,
            project?.mapperKeys,
            project?.stackDetails?.master_locale,
            project,
          );

          //await wordpressService?.extractContentTypes(projectId, project?.destination_stack_id)
          await wordpressService?.createVersionFile(
            project?.destination_stack_id,
            projectId,
          );
        }
        break;
      }
      case CMS.CONTENTFUL: {
        const cleanLocalPath = file_path?.replace?.(/\/$/, "");
        await contentfulService?.createLocale(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
          project,
        );
        await contentfulService?.createRefrence(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
        );
        await contentfulService?.createWebhooks(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
        );
        await contentfulService?.createEnvironment(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
        );
        await contentfulService?.createAssets(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
        );
        await contentfulService?.createTaxonomy(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
        );
        await contentfulService?.createEntry(
          cleanLocalPath,
          project?.destination_stack_id,
          projectId,
          contentTypes,
          project?.mapperKeys,
          project?.stackDetails?.master_locale,
          project,
        );
        await contentfulService?.createVersionFile(
          project?.destination_stack_id,
          projectId,
        );
        break;
      }
      case CMS.AEM: {
        await aemService.createAssets({
          projectId,
          packagePath,
          destinationStackId: project?.destination_stack_id,
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
          project,
        );
        await aemService?.createVersionFile(project?.destination_stack_id);
        break;
      }

      case CMS.DRUPAL: {
        // Get database configuration from project
        const dbConfig = {
          host: project?.legacy_cms?.mySQLDetails?.host,
          user: project?.legacy_cms?.mySQLDetails?.user,
          password: project?.legacy_cms?.mySQLDetails?.password || "",
          database: project?.legacy_cms?.mySQLDetails?.database,
          port: project?.legacy_cms?.mySQLDetails?.port || 3306,
        };

        // Get Drupal assets URL configuration from project, request body, or environment variables
        const drupalAssetsConfig = {
          base_url:
            project?.legacy_cms?.assetsConfig?.base_url ||
            req.body?.assetsConfig?.base_url ||
            process.env.DRUPAL_ASSETS_BASE_URL ||
            "",
          public_path:
            project?.legacy_cms?.assetsConfig?.public_path ||
            req.body?.assetsConfig?.public_path ||
            process.env.DRUPAL_ASSETS_PUBLIC_PATH ||
            "",
        };

        // Run Drupal migration services in proper order
        // Step 1: Generate dynamic queries from database analysis
        await drupalService?.createQuery(
          dbConfig,
          project?.destination_stack_id,
          projectId,
        );

        // Step 3: Create assets from Drupal database
        await drupalService?.createAssets(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false, // Not a test migration
          drupalAssetsConfig,
        );

        // Step 4: Create references
        await drupalService?.createRefrence(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false, // Not a test migration
        );

        // Step 5: Create taxonomy
        await drupalService?.createTaxonomy(
          dbConfig,
          project?.destination_stack_id,
          projectId,
        );

        // Step 6: Create entries
        await drupalService?.createEntry(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          false, // Not a test migration
          project?.stackDetails?.master_locale,
          project,
          contentTypes,
        );

        // Step 7: Create locale
        await drupalService?.createLocale(
          dbConfig,
          project?.destination_stack_id,
          projectId,
          project,
        );

        // Step 8: Create version file
        await drupalService?.createVersionFile(
          project?.destination_stack_id,
          projectId,
        );
        break;
      }

      default:
        break;
    }
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;
    let configFilePath: string | null = null;
    let assetUpdates: AssetUpdate[] = [];
    let safeDeltaMigrationLogPath: string | undefined;
    const destinationStackId = project?.destination_stack_id;

    // Contentstack-source migrations don't use the delta asset-tracking
    // index — the CLI's cm:stacks:import imports assets directly from the
    // source export. Skip the asset-index/delta-removal block and go
    // straight to runCli below.
    if (cms !== CMS.CONTENTSTACK) {
    const safeStackForAssets = sanitizeStackId(project?.destination_stack_id);
    if (!safeStackForAssets) {
      await customLogger(projectId, destinationStackId, 'error', 'Invalid destination stack id; cannot load assets index.');
      console.error(
        'Invalid destination stack id; cannot load assets index.',
      );
      return;
    }
    const migrationDataBase = path.resolve(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA,
    );
    const assetsDir = path.join(
      migrationDataBase,
      safeStackForAssets,
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME,
    );
    const indexPath = path.join(
      assetsDir,
      MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE,
    );

    let indexData: Record<string, any>;
    try {
      assertResolvedPathUnderBase(migrationDataBase, indexPath);
    } catch {
      console.error(
        'Assets index path is outside the allowed migration-data directory.',
      );
      return;
    }

    try {
      const stats = await fsPromises.lstat(indexPath).catch(() => null);
      if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
        console.error(
          `Assets index not found or not a regular file at ${indexPath}`,
        );
        return;
      }

      const canonicalIndexPath = await fsPromises.realpath(indexPath);
      try {
        assertResolvedPathUnderBase(migrationDataBase, canonicalIndexPath);
      } catch {
          await customLogger(projectId, destinationStackId, 'error', 'Assets index resolves outside the allowed migration-data directory.');
        return;
      }

      const raw = await fsPromises.readFile(canonicalIndexPath, 'utf-8');
      if (!raw?.trim()) {
        await customLogger(projectId, destinationStackId, 'error', 'Assets index.json is empty.');
        console.error(`Assets index.json is empty at ${indexPath}`);
        return;
      }
      indexData = JSON.parse(raw);
    } catch (error) {
      await customLogger(projectId, destinationStackId, 'error', `Failed to read or parse assets index.json: ${error instanceof Error ? error.message : String(error)}`);
      console.error(
        `Failed to read or parse assets index.json at ${indexPath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    const deltaLogsBase = path.resolve(process.cwd(), 'logs');
    const safePid = sanitizeProjectId(projectId);
    const safeStack = sanitizeStackId(project?.destination_stack_id);
    if (safePid && safeStack) {
      const candidate = path.join(deltaLogsBase, safePid, `${safeStack}.log`);
      try {
        assertResolvedPathUnderBase(deltaLogsBase, candidate);
        safeDeltaMigrationLogPath = candidate;
      } catch {
        safeDeltaMigrationLogPath = undefined;
      }
    }

    // projectId is HTTP-derived and gets interpolated into database/<projectId>/...
    // paths below; the resulting config file is later read with fs.readFileSync.
    // Sanitize once and bail on invalid input so a traversal value (e.g. "../../etc")
    // can never reach the filesystem. sanitizeProjectId rebuilds the value
    // char-by-char from an allowlist, which breaks the taint chain.
    if (!safePid) {
      await customLogger(projectId, destinationStackId, 'error', 'Invalid project id; skipping delta asset/entry processing.');
      return;
    }

    saveAssetMetadata(indexData, safePid, iteration, safeDeltaMigrationLogPath);

    if (iteration > 1) {
      assetUpdates = await removeExistingAssets(safePid, safeDeltaMigrationLogPath);
      configFilePath = await removeEntriesFromDatabase(
        safePid,
        safeDeltaMigrationLogPath
      );
      await customLogger(projectId, destinationStackId, 'info', `Config file generated at ${configFilePath}`);
      console.info('Config file written to:', configFilePath);
      }
    } // end if (cms !== CMS.CONTENTSTACK)

    await utilsCli?.runCli(
      region,
      user_id,
      project?.destination_stack_id,
      projectId,
      false,
      loggerPath,
    );

    // Contentstack stack-to-stack: persist completion (backup cleanup is
    // owned by runCli since it creates the backup).
    if (cms === CMS.CONTENTSTACK) {
      await ProjectModelLowdb.update((data: any) => {
        if (data?.projects?.[index]) {
          data.projects[index].isMigrationCompleted = true;
          data.projects[index].isMigrationStarted = false;
          data.projects[index].status = 5;
          data.projects[index].current_step = STEPPER_STEPS.MIGRATION;
        }
      });
    }
  }

  return {
    status: HTTP_CODES.OK,
    data: { message: "Final migration completed successfully" },
  };
};

const exportSourceStack = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const tokenPayload = req?.body?.token_payload ?? {};
  const { user_id, region } = tokenPayload;

  await ProjectModelLowdb.read();
  const projectIndex = ProjectModelLowdb.chain
    .get("projects")
    .findIndex({ id: projectId, org_id: orgId })
    .value();
  if (projectIndex < 0) {
    throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const project = ProjectModelLowdb.data.projects[projectIndex];
  const sourceDetails: any = project?.legacy_cms?.source_details || {};
  const sourceStackId = sourceDetails?.source_stack_id;
  if (!sourceStackId) {
    throw new BadRequestError("Source stack is required for credentials mode");
  }

  const sourceRegion = sourceDetails?.source_region_id || region;
  const sourceBranch = sourceDetails?.source_branch || "main";
  const iteration = project?.iteration || 1;
  const exportPath = await exportStackCli(
    sourceStackId,
    sourceRegion,
    user_id,
    iteration
  );

  await ProjectModelLowdb.update((data: any) => {
    const timestamp = new Date().toISOString();
    data.projects[projectIndex].extract_path = exportPath;
    data.projects[projectIndex].legacy_cms.source_details = {
      ...data?.projects?.[projectIndex]?.legacy_cms?.source_details,
      source_branch: sourceBranch || "main",
      exported_at: timestamp,
      export_path: exportPath,
    };
    data.projects[projectIndex].updated_at = timestamp;
  });

  return {
    status: HTTP_CODES.OK,
    data: {
      message: "Source stack export completed",
      export_path: exportPath,
      branch: sourceBranch || "main",
    },
  };
};

const validateSourceExport = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId, org_id: orgId })
    .value();
  if (!project) {
    throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const legacyFilePath = project?.legacy_cms?.file_path;
  let exportPath =
    project?.legacy_cms?.source_details?.export_path ||
    project?.legacy_cms?.source_details?.imported_data_path ||
    project?.extract_path ||
    legacyFilePath;

  if (exportPath?.toLowerCase().endsWith(".zip")) {
    // basename strips slashes; further sanitize to alphanumerics/._- only so
    // the candidate paths are built from trusted, fixed prefixes + a safe leaf.
    const rawBase = path.basename(exportPath, path.extname(exportPath));
    const baseName = rawBase.replace(/[^a-zA-Z0-9_.-]/g, "");
    const candidates = baseName
      ? [
          path.join("/app", "extracted_files", baseName),
          path.resolve(process.cwd(), "extracted_files", baseName),
          path.resolve(
            process.cwd(),
            "..",
            "upload-api",
            "extracted_files",
            baseName,
          ),
        ]
      : [];
    for (const candidate of candidates) {
      // candidate is a fixed prefix joined with sanitized baseName; still
      // re-validate against the allowlist before passing to any fs call.
      const safeCandidate = assertExportPathInAllowedRoot(candidate);
      // deepcode ignore PT: candidate is validated by assertExportPathInAllowedRoot
      const resolved = resolveContentstackExportRoot(safeCandidate);
      if (resolved) {
        exportPath = safeCandidate;
        break;
      }
    }
  }

  if (!exportPath) {
    console.error("validateSourceExport: No export path available", {
      projectId,
      orgId,
      exportPath: project?.legacy_cms?.source_details?.export_path,
      importedDataPath: project?.legacy_cms?.source_details?.imported_data_path,
      extractPath: project?.extract_path,
    });
    throw new BadRequestError("No export path available for validation");
  }

  // Validate the export path against the allowlist of migration directories
  // before passing it to validateExportStructure (which reads files).
  const safeExportPathForValidation = assertExportPathInAllowedRoot(exportPath);
  // deepcode ignore PT: path is validated by assertExportPathInAllowedRoot (allowlist)
  const result = await validateExportStructure(safeExportPathForValidation);
  await ProjectModelLowdb.update((data: any) => {
    if (!data.projects || !Array.isArray(data.projects)) {
      throw new Error("Invalid projects data structure");
    }
    const index = data?.projects?.findIndex(
      (item: any) => item && item?.id === projectId,
    );
    if (index === -1) {
      throw new NotFoundError(
        `Project with ID ${projectId} not found in database`,
      );
    }
    data.projects[index].legacy_cms.validation = result;
    const exportContentRoot =
      result?.isValid && result?.resolvedRoot ? result?.resolvedRoot : exportPath;
    data.projects[index].extract_path = exportContentRoot;

    // For successful validation of Contentstack source, mark the legacy CMS step as completed
    if (result?.isValid) {
      data.projects[index].legacy_cms.cms = "contentstack";
      data.projects[index].legacy_cms.file_format = "json"; // Default file format for Contentstack
      data.projects[index].legacy_cms.is_fileValid = true;
      data.projects[index].current_step = STEPPER_STEPS.DESTINATION_STACK;
      data.projects[index].status = NEW_PROJECT_STATUS[0]; // Set status to DRAFT
      if (result.resolvedRoot) {
        data.projects[index].legacy_cms.source_details = {
          ...data.projects[index].legacy_cms.source_details,
          export_path: result.resolvedRoot,
        };
      }
    }

    data.projects[index].updated_at = new Date().toISOString();
  });

  // Extract and save source locales for Contentstack (credentials and imported export)
  if (result?.isValid && result?.resolvedRoot) {
    try {
      const locales = await extractContentstackLocales(result?.resolvedRoot);

      if (locales && locales?.length > 0) {
        await ProjectModelLowdb.update((data: any) => {
          const index = data.projects.findIndex(
            (item: any) => item && item.id === projectId,
          );
          if (index > -1) {
            data.projects[index].source_locales = locales;
          } else {
            console.error(
              `Project ${projectId} not found in database when saving locales`,
            );
          }
        });
      } else {
        console.warn(`No locales extracted for project ${projectId}`);
      }
    } catch (error) {
      console.error(
        "Error extracting Contentstack locales during validation:",
        error,
      );
      // Don't fail validation if locale extraction fails
    }
  }

  return {
    status: result.isValid ? HTTP_CODES.OK : HTTP_CODES.UNPROCESSABLE_CONTENT,
    data: result,
  };
};

const extractContentstackLocales = async (exportPath: string) => {
  try {
    // Re-validate against the allowlist of export roots and rebuild a fresh
    // path string. This breaks the taint chain from HTTP params → fs.readFile.
    const safeExportPath = assertExportPathInAllowedRoot(exportPath);
    const masterLocalePath = path.join(
      safeExportPath,
      "locales",
      "master-locale.json",
    );
    const localesPath = path.join(safeExportPath, "locales", "locales.json");

    // deepcode ignore PT: path is validated by assertExportPathInAllowedRoot (allowlist)
    const masterLocaleRaw = await fsPromises.readFile(masterLocalePath, "utf8");
    const masterLocales = JSON.parse(masterLocaleRaw || "{}");

    // Read additional locales (optional)
    let additionalLocales = {};
    try {
      // deepcode ignore PT: path is validated by assertExportPathInAllowedRoot (allowlist)
      const localesRaw = await fsPromises.readFile(localesPath, "utf8");
      additionalLocales = JSON.parse(localesRaw || "{}");
    } catch (error) {
      // locales.json might be empty or missing, that's okay
    }

    // Merge master and additional locales
    const allLocales = { ...masterLocales, ...additionalLocales };

    // Convert to array format expected by the system
    return Object.values(allLocales)?.map((locale: any) => ({
      label: `${locale?.name} (${locale?.code})`,
      value: locale?.code,
      uid: locale?.uid,
      code: locale?.code,
      name: locale?.name,
    }));
  } catch (error) {
    // Don't fabricate a default locale — if we can't read the source's
    // locale files, return an empty list so the caller surfaces the issue
    // to the user instead of silently substituting en-us.
    console.error("Error extracting Contentstack locales:", error);
    return [];
  }
};

const buildContentstackMapperPayload = async (exportPath: string) => {
  const safeExportPath = assertExportPathInAllowedRoot(exportPath);
  const schemaPath = path.join(safeExportPath, "content_types", "schema.json");
  // deepcode ignore PT: path is validated by assertExportPathInAllowedRoot (allowlist)
  const raw = await fsPromises.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw || "[]");
  if (!Array.isArray(schema)) return [];

  const mapField = (field: any, prefix = ""): any[] => {
    const uid = prefix ? `${prefix}.${field?.uid}` : field?.uid;
    const display = prefix
      ? `${prefix.replace(/\./g, " > ")} > ${field.display_name || field.uid}`
      : field.display_name || field.uid;
    const base = {
      otherCmsField: display,
      otherCmsType: field.data_type,
      contentstackField: display,
      contentstackFieldUid: uid,
      contentstackFieldType: field.data_type,
      uid,
      refrenceTo: field.reference_to
        ? { uid: field.reference_to, title: field.reference_to }
        : { uid: "", title: "" },
      advanced: {
        validationRegex: "",
        mandatory: !!field.mandatory,
        multiple: !!field.multiple,
        unique: !!field.unique,
        nonLocalizable: !!field.non_localizable,
        embedObject: false,
        embedObjects: null,
        minChars: "",
        maxChars: 0,
        default_value: "",
        description: "",
        validationErrorMessage: "",
        options: [],
      },
    };
    let nested: any[] = [];
    if (Array.isArray(field?.schema)) {
      nested = field.schema.flatMap((sub: any) => mapField(sub, uid));
    }
    if (field?.data_type === "blocks" && Array.isArray(field?.blocks)) {
      for (const block of field.blocks) {
        const blockUid = `${uid}.${block.uid}`;
        nested.push({
          ...base,
          uid: blockUid,
          otherCmsField: `${display} > ${block.title}`,
          otherCmsType: "block",
          contentstackFieldUid: blockUid,
          contentstackFieldType: "block",
        });
        if (Array.isArray(block?.schema)) {
          nested.push(
            ...block.schema.flatMap((sub: any) => mapField(sub, blockUid)),
          );
        }
      }
    }
    return [base, ...nested];
  };

  return schema.map((contentType: any) => ({
    otherCmsTitle: contentType?.title || contentType?.uid,
    otherCmsUid: contentType?.uid,
    contentstackTitle: contentType?.title || contentType?.uid,
    contentstackUid: contentType?.uid,
    type: "content_type",
    status: 1,
    isUpdated: false,
    updateAt: new Date().toISOString(),
    fieldMapping: Array.isArray(contentType?.schema)
      ? contentType.schema.flatMap((field: any) => mapField(field))
      : [],
    entryMapping: [],
  }));
};

const runSourceAudit = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId, org_id: orgId })
    .value();
  if (!project) {
    throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }

  // Check multiple possible locations for export path
  const exportPath =
    project?.legacy_cms?.source_details?.export_path ||
    project?.legacy_cms?.file_path ||
    project?.file_path ||
    project?.extract_path;

  // Check if we already have an audit report AND the mapper was already generated
  const existingAudit = project?.legacy_cms?.audit;
  if (
    existingAudit &&
    existingAudit.summary &&
    existingAudit.is_mapper_generated
  ) {
    return {
      status: HTTP_CODES.OK,
      data: {
        summary: existingAudit.summary,
        message: "Audit report retrieved from cache",
      },
    };
  }

  // No existing audit (or mapper not yet generated), so generate now
  if (!exportPath) {
    throw new BadRequestError(
      "Export path is required before running audit. Please complete Step 1 (Export) first.",
    );

    // Make sure an update config exists when there are asset updates but no
    // entry updates, so the asset-replace step still runs.
    if (!configFilePath && assetUpdates.length) {
      configFilePath = ensureUpdateConfigFile(safePid, iteration);
    }

    if (configFilePath) {
      enrichConfigWithAssetMapping(
        configFilePath,
        safePid,
        iteration,
        safeDeltaMigrationLogPath
      );
      enrichConfigWithAssetUpdates(
        configFilePath,
        assetUpdates,
        safeDeltaMigrationLogPath
      );
      await utilsUpdateCli?.updateEntryCli(
        region,
        user_id,
        project?.destination_stack_id,
        safeDeltaMigrationLogPath || '',
        configFilePath
      );
    }
    else{
      await customLogger(projectId, destinationStackId, 'warn', 'No config file generated for delta migration; skipping update CLI step.');
    }
  }
  // Validate the stored export path against the allowlist of migration data
  // directories before any downstream code reads files from it.
  const safeExportPath = assertExportPathInAllowedRoot(exportPath);
  const stackId =
    project?.legacy_cms?.source_details?.source_stack_id ||
    project?.destination_stack_id;
  const region =
    project?.legacy_cms?.source_details?.source_region_id ||
    project?.region ||
    "US"; // Default to US if no region specified
  // deepcode ignore PT: safeExportPath is validated by assertExportPathInAllowedRoot (allowlist + char-allowlist rebuild)
  const audit = await generateAuditData({
    projectId,
    orgId,
    stackId,
    exportPath: safeExportPath,
    region,
  });
  // deepcode ignore PT: safeExportPath is validated by assertExportPathInAllowedRoot (allowlist + char-allowlist rebuild)
  const mapperPayload = await buildContentstackMapperPayload(safeExportPath);
  if (mapperPayload?.length > 0) {
    const mapperReq = {
      params: { projectId },
      body: { contentTypes: mapperPayload },
    } as unknown as Request;
    await contentMapperService.putTestData(mapperReq);
  }
  await ProjectModelLowdb.update((data: any) => {
    const index = data.projects.findIndex(
      (item: any) => item && item.id === projectId,
    );
    if (index > -1) {
      // Preserve existing audit data (like excludedItems) when regenerating audit
      const existingAudit = data.projects[index].legacy_cms.audit || {};
      data.projects[index].legacy_cms.audit = {
        ...existingAudit, // Preserve existing data
        generated_at: new Date().toISOString(),
        summary: audit.summary,
        is_mapper_generated: mapperPayload.length > 0,
      };
      data.projects[index].updated_at = new Date().toISOString();
    }
  });
  return {
    status: HTTP_CODES.OK,
    data: {
      summary: audit.summary,
      message: "Audit report generated successfully",
    },
  };
};

const getSourceAuditSummary = async (req: Request): Promise<any> => {
  const { projectId, moduleName = "all" } = req?.params ?? {};
  if (!projectId) {
    throw new BadRequestError("Project ID is required");
  }
  const moduleMap: Record<
    string,
    "assets" | "content_types" | "entries" | "global_fields"
  > = {
    assets: "assets",
    content_types: "content_types",
    entries: "entries",
    global_fields: "global_fields",
  };
  if (moduleName !== "all" && !moduleMap[moduleName]) {
    throw new BadRequestError("Invalid module name");
  }

  if (moduleName === "all") {
    const audit = await auditDb.getAuditByProjectId(projectId);
    return {
      status: HTTP_CODES.OK,
      data: audit,
    };
  }

  const data = await auditDb.getDataByType(projectId, moduleMap[moduleName]);
  return {
    status: HTTP_CODES.OK,
    data,
  };
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
    if (moduleName === "Entries_Select_feild") {
      if (filter != GET_AUDIT_DATA?.FILTERALL) {
        const filters = filter?.split("-");
        transformedData = transformedData?.filter((log) => {
          return filters?.some((filter: string) => {
            return (
              log?.display_type
                ?.toLowerCase()
                ?.includes(filter?.toLowerCase()) ||
              log?.data_type?.toLowerCase()?.includes(filter?.toLowerCase())
            );
          });
        });
      }
      if (searchText && searchText !== null && searchText !== "null") {
        transformedData = transformedData?.filter((item) => {
          return Object?.values(item)?.some(
            (value) =>
              value &&
              typeof value === "string" &&
              value?.toLowerCase?.()?.includes(searchText?.toLowerCase()),
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
      const filters = filter?.split("-");
      transformedData = transformedData?.filter((log) => {
        return filters?.some((filter: string) => {
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
  const projectId = req?.params?.projectId ? path?.basename(req.params.projectId): '';
  const stackId = req?.params?.stackId ? path?.basename(req.params.stackId) : '';
  const limit = req?.params?.limit ? parseInt(req.params.limit) : 10;
  const startIndex = req?.params?.startIndex ? parseInt(req.params.startIndex) : 0;
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
      logEntries?.findIndex?.((log) =>
        log?.message?.includes('Starting audit process')
      );
      logEntries?.findIndex?.((log) =>
        log?.message?.includes('Audit process completed')
      );
      logEntries = logEntries?.slice?.(1, logEntries?.length - 2);
      if (filter !== 'all') {
        const filters = filter?.split('-') ?? [];
        logEntries = logEntries?.filter((log) => {
          return filters?.some((filter: string) => {
            return log?.level
              ?.toLowerCase()
              ?.includes?.(filter?.toLowerCase() ?? "");
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
  const extractPath = req?.body?.extractPath;

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
        if (extractPath) {
          data.projects[index].extract_path = extractPath;
        }
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

const restartMigration = async (req: Request): Promise<any> => {
  const { orgId, projectId } = req?.params ?? {};
  const safeProjectId = sanitizeProjectId(projectId);
  if (safeProjectId === null) {
    throw new BadRequestError('Invalid projectId');
  }

  const safeOrgId = sanitizeOrgId(orgId);
  if (safeOrgId === null) {
    throw new BadRequestError('Invalid orgId');
  }
  await ProjectModelLowdb.read();
  const projectIndex = ProjectModelLowdb.chain
    .get("projects")
    .findIndex({ id: safeProjectId, org_id: safeOrgId })
    .value();
  console.info('projectIndex', projectIndex);
  if (projectIndex > -1) {
    try {
      await ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].migration_execution = false;
      data.projects[projectIndex].isMigrationCompleted = false;
      data.projects[projectIndex].isMigrationStarted = false;
      data.projects[projectIndex].current_step = 1;
      data.projects[projectIndex].status = 0;
      data.projects[projectIndex].legacy_cms = {
        ...data.projects[projectIndex].legacy_cms,
        is_fileValid: false,
      };
      data.projects[projectIndex].iteration = 1 + (data.projects[projectIndex].iteration || 0);
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });
    } catch (error) {
      console.error('Error updating project for migration restart:', error);
      throw new ExceptionFunction(
        HTTP_TEXTS?.INTERNAL_ERROR,
        HTTP_CODES?.SERVER_ERROR
      );
    }
  } else {
    throw new NotFoundError(HTTP_TEXTS?.PROJECT_NOT_FOUND);
  }
  return {
    status: HTTP_CODES?.OK,
    message: "Migration restarted successfully",
  };
};

export const migrationService = {
  createTestStack,
  deleteTestStack,
  exportSourceStack,
  validateSourceExport,
  runSourceAudit,
  getSourceAuditSummary,
  startTestMigration,
  startMigration,
  getLogs,
  createSourceLocales,
  updateLocaleMapper,
  getAuditData,
  restartMigration
};