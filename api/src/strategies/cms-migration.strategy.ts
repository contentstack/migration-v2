import { Request } from "express";
import { siteCoreService } from "../services/sitecore.service.js";
import { wordpressService } from "../services/wordpress.service.js";
import { contentfulService } from "../services/contentful.service.js";
import { aemService } from "../services/aem.service.js";
import { drupalService } from "../services/drupal.service.js";
import { CMS } from "../constants/index.js";

export interface MigrationParams {
  req: Request;
  projectId: string;
  project: any;
  file_path: string;
  packagePath: string;
  contentTypes: any[];
  stackId: string; // caller passes the right one
  isTest: boolean; // caller passes true/false
}

export interface ICmsMigrationStrategy {
  run(params: MigrationParams): Promise<void>;
}

class SitecoreStrategy implements ICmsMigrationStrategy {
  async run(params: MigrationParams): Promise<void> {
    if (params.packagePath) {
      await siteCoreService?.createEntry({
        packagePath: params.packagePath,
        contentTypes: params.contentTypes,
        master_locale: params.project?.stackDetails?.master_locale,
        destinationStackId: params.stackId,
        projectId: params.projectId,
        keyMapper: params.project?.mapperKeys,
        project: params.project,
      });
      await siteCoreService?.createLocale(
        params.req,
        params.stackId,
        params.projectId,
        params.project,
      );
      if (params.isTest) {
        await siteCoreService?.createEnvironment(params.stackId);
      }
      await siteCoreService?.createVersionFile(params.stackId);
    }
  }
}

class WordpressStrategy implements ICmsMigrationStrategy {
  async run(params: MigrationParams): Promise<void> {
    if (params.packagePath) {
      await wordpressService?.createLocale(
        params.req,
        params.stackId,
        params.projectId,
        params.project,
      );
      await wordpressService?.getAllAssets(
        params.file_path,
        params.packagePath,
        params.stackId,
        params.projectId,
      );
      await wordpressService?.createTaxonomy(
        params.file_path,
        params.packagePath,
        params.stackId,
        params.projectId,
        params.contentTypes,
        params.project?.mapperKeys,
        params.project?.stackDetails?.master_locale,
        params.project,
      );
      await wordpressService?.createEntry(
        params.file_path,
        params.packagePath,
        params.stackId,
        params.projectId,
        params.contentTypes,
        params.project?.mapperKeys,
        params.project?.stackDetails?.master_locale,
        params.project,
      );
      await wordpressService?.createVersionFile(
        params.stackId,
        params.projectId,
      );
    }
  }
}

class ContentfulStrategy implements ICmsMigrationStrategy {
  async run(params: MigrationParams): Promise<void> {
    const cleanLocalPath = params.file_path?.replace?.(/\/$/, "");
    await contentfulService?.createLocale(
      cleanLocalPath,
      params.stackId,
      params.projectId,
      params.project,
    );
    await contentfulService?.createRefrence(
      cleanLocalPath,
      params.stackId,
      params.projectId,
    );
    await contentfulService?.createWebhooks(
      cleanLocalPath,
      params.stackId,
      params.projectId,
    );
    await contentfulService?.createEnvironment(
      cleanLocalPath,
      params.stackId,
      params.projectId,
    );
    await contentfulService?.createAssets(
      cleanLocalPath,
      params.stackId,
      params.projectId,
      params.isTest,
    );
    await contentfulService?.createTaxonomy(
      cleanLocalPath,
      params.stackId,
      params.projectId,
    );
    await contentfulService?.createEntry(
      cleanLocalPath,
      params.stackId,
      params.projectId,
      params.contentTypes,
      params.project?.mapperKeys,
      params.project?.stackDetails?.master_locale,
      params.project,
    );
    await contentfulService?.createVersionFile(
      params.stackId,
      params.projectId,
    );
  }
}

class AemStrategy implements ICmsMigrationStrategy {
  async run(params: MigrationParams): Promise<void> {
    await aemService.createAssets({
      projectId: params.projectId,
      packagePath: params.packagePath,
      destinationStackId: params.stackId,
    });
    await aemService.createEntry({
      packagePath: params.packagePath,
      contentTypes: params.contentTypes,
      master_locale: params.project?.stackDetails?.master_locale,
      destinationStackId: params.stackId,
      projectId: params.projectId,
      keyMapper: params.project?.mapperKeys,
      project: params.project,
    });
    await aemService?.createLocale(
      params.req,
      params.stackId,
      params.projectId,
      params.project,
    );
    await aemService?.createVersionFile(params.stackId);
  }
}

class DrupalStrategy implements ICmsMigrationStrategy {
  async run(params: MigrationParams): Promise<void> {
    const dbConfig = {
      host: params.project?.legacy_cms?.mySQLDetails?.host,
      user: params.project?.legacy_cms?.mySQLDetails?.user,
      password: params.project?.legacy_cms?.mySQLDetails?.password || "",
      database: params.project?.legacy_cms?.mySQLDetails?.database,
      port: params.project?.legacy_cms?.mySQLDetails?.port || 3306,
    };

    // Get Drupal assets URL configuration from project, request body, or environment variables
    // Priority: project config > request body > environment variables > empty (auto-detection)
    const drupalAssetsConfig = {
      base_url:
        params.project?.legacy_cms?.assetsConfig?.base_url ||
        params.req.body?.assetsConfig?.base_url ||
        process.env.DRUPAL_ASSETS_BASE_URL ||
        "",
      public_path:
        params.project?.legacy_cms?.assetsConfig?.public_path ||
        params.req.body?.assetsConfig?.public_path ||
        process.env.DRUPAL_ASSETS_PUBLIC_PATH ||
        "",
    };

    // Run Drupal migration services in proper order (following test-drupal-services sequence)
    // Step 1: Generate dynamic queries from database analysis (MUST RUN FIRST)
    await drupalService?.createQuery(
      dbConfig,
      params.stackId,
      params.projectId,
    );

    // Step 2: Create assets from Drupal database
    await drupalService?.createAssets(
      dbConfig,
      params.stackId,
      params.projectId,
      params.isTest,
      drupalAssetsConfig,
    );

    // Step 3: Create references
    await drupalService?.createRefrence(
      dbConfig,
      params.stackId,
      params.projectId,
      params.isTest,
    );

    // Step 4: Create taxonomy
    await drupalService?.createTaxonomy(
      dbConfig,
      params.stackId,
      params.projectId,
    );

    // Step 5: Create entries
    await drupalService?.createEntry(
      dbConfig,
      params.stackId,
      params.projectId,
      params.isTest,
      params.project?.stackDetails?.master_locale,
      params.project,
      params.contentTypes,
    );

    // Step 6: Create locale
    await drupalService?.createLocale(
      dbConfig,
      params.stackId,
      params.projectId,
      params.project,
    );

    // Step 7: Create version file
    await drupalService?.createVersionFile(params.stackId, params.projectId);
  }
}

export const cmsMigrationStrategies: Record<string, ICmsMigrationStrategy> = {
    [CMS.SITECORE_V8]: new SitecoreStrategy(),
    [CMS.SITECORE_V9]: new SitecoreStrategy(),
    [CMS.SITECORE_V10]: new SitecoreStrategy(),
    [CMS.WORDPRESS]: new WordpressStrategy(),
    [CMS.CONTENTFUL]: new ContentfulStrategy(),
    [CMS.AEM]: new AemStrategy(),
    [CMS.DRUPAL]: new DrupalStrategy(),
}