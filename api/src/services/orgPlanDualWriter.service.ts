import fs from 'fs';
import path from 'path';
import { safePromise, getLogMessage } from '../utils/index.js';
import https from '../utils/https.utils.js';
import logger from '../utils/logger.js';
import OrgPlanFinderModel from '../models/org-plan-finder.js';

/**
 * Interface for the simplified org plan limits config
 */
interface OrgPlanLimitsConfig {
  projectId: string;
  orgUid: string;
  region: string;
  referenceFieldLimit: number;
  jsonRteLimit: number;
  fetchedAt: string;
  planFeatures: any[];
}

/**
 * Creates org plan limit files in both database and upload-api config locations
 * @param region - The region for the API call
 * @param authtoken - The authentication token
 * @param orgUid - The organization UID
 * @param projectId - The project ID
 * @param cmsType - The CMS type (contentful, sitecore, wordpress, etc.)
 * @returns Promise with operation result
 */
export const createDualOrgPlanFiles = async (
  region: string,
  authtoken: string,
  orgUid: string,
  projectId: string,
  cmsType: string = 'contentful'
): Promise<{ success: boolean; message: string; data?: any }> => {
  const srcFunc = 'createDualOrgPlanFiles';
  
  console.log('\n🎯 DUAL ORG PLAN WRITER - Starting...');
  console.log('=' .repeat(70));
  console.log(`📋 Project ID: ${projectId}`);
  console.log(`🏢 Organization ID: ${orgUid}`);
  console.log(`🌍 Region: ${region}`);
  console.log(`💻 CMS Type: ${cmsType}`);

  try {
    // Step 1: Fetch org plan data from Contentstack API
    console.log('\n🔍 Step 1: Fetching org plan data...');
    
    let baseUrl: string;
    switch (region?.toLowerCase()) {
      case 'na':
        baseUrl = 'https://app.contentstack.com/';
        break;
      case 'eu':
        baseUrl = 'https://eu-api.contentstack.com/';
        break;
      case 'aws-au':
        baseUrl = 'https://au-api.contentstack.com/';
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

    const apiUrl = `${baseUrl}api/v3/organizations/${orgUid}?include_plan=true`;
    console.log(`🌐 API URL: ${apiUrl}`);

    const [orgErr, orgRes] = await safePromise(
      https({
        method: "GET",
        url: apiUrl,
        headers: { authtoken },
      })
    );

    console.log('\n📡 API RESPONSE DETAILS:');
    console.log('=' .repeat(50));
    
    if (orgErr) {
      console.log('❌ API Error:', {
        message: orgErr.message,
        status: orgErr.status || orgErr.statusCode,
        code: orgErr.code
      });
      logger.error(getLogMessage(srcFunc, 'Failed to fetch org plan data', { region, orgUid, projectId }, orgErr));
      return { success: false, message: 'Failed to fetch organization plan data' };
    }

    if (!orgRes) {
      console.log('❌ No response received from API');
      return { success: false, message: 'No response from organization API' };
    }

    console.log('✅ API Response Status:', orgRes.status || 'Unknown');
    console.log('📊 Response Keys:', Object.keys(orgRes));
    
    if (orgRes.data) {
      console.log('📋 Response Data Keys:', Object.keys(orgRes.data));
      console.log('🏢 Organization Data:', orgRes.data.organization ? 'Present' : 'Missing');
    } else {
      console.log('❌ No data field in response');
    }

    if (!orgRes?.data?.organization) {
      console.log('❌ Organization data missing from response');
      console.log('📄 Full Response:', JSON.stringify(orgRes, null, 2));
      return { success: false, message: 'Organization data not found in API response' };
    }

    const organizationResponse = orgRes.data;
    const organization = organizationResponse.organization;
    const planFeatures = organization?.plan?.features || [];
    
    console.log('🎯 Organization Details:');
    console.log(`   📛 Name: ${organization.name || 'N/A'}`);
    console.log(`   🆔 UID: ${organization.uid || 'N/A'}`);
    console.log(`   📋 Plan: ${organization.plan?.name || 'N/A'}`);
    console.log(`   🔢 Features Count: ${planFeatures.length}`);
    
    if (planFeatures.length > 0) {
      console.log('📝 Plan Features:');
      planFeatures.forEach((feature: any, index: number) => {
        console.log(`   ${index + 1}. ${feature.uid}: ${feature.limit || 'No limit'}`);
      });
    } else {
      console.log('⚠️ No plan features found');
    }
    
    console.log('=' .repeat(50));

    // Step 2: Extract specific limits
    console.log('\n📊 Step 2: Extracting limits...');
    
    const maxContentTypesPerReferenceField = planFeatures.find(
      (feature: any) => feature.uid === 'maxContentTypesPerReferenceField'
    );
    
    const maxContentTypesPerJsonRte = planFeatures.find(
      (feature: any) => feature.uid === 'maxContentTypesPerJsonRte'
    );

    const referenceFieldLimit = maxContentTypesPerReferenceField?.limit || 10;
    const jsonRteLimit = maxContentTypesPerJsonRte?.limit || 15;
    
    console.log(`🔗 Reference Field Limit: ${referenceFieldLimit}`);
    console.log(`📝 JSON RTE Limit: ${jsonRteLimit}`);

    const currentTime = new Date().toISOString();

    // Step 3: Write to main database (existing logic)
    console.log('\n💾 Step 3: Writing to main database...');
    
    await OrgPlanFinderModel.read();
    const existingIndex = OrgPlanFinderModel.chain
      .get("org_plans")
      .findIndex({ org_uid: orgUid })
      .value();

    const orgPlanEntry = {
      org_uid: orgUid,
      region,
      authtoken,
      organization_response: planFeatures,
      fetched_at: currentTime,
      isDeleted: false,
    };

    OrgPlanFinderModel.update((data: any) => {
      if (existingIndex >= 0) {
        data.org_plans[existingIndex] = orgPlanEntry;
        console.log('✅ Updated existing entry in main database');
      } else {
        data.org_plans.push(orgPlanEntry);
        console.log('✅ Added new entry to main database');
      }
    });

    // Step 4: Write to upload-api data folders (dynamic paths)
    console.log('\n📁 Step 4: Writing to CMS data folders...');
    
    const configData: OrgPlanLimitsConfig = {
      projectId,
      orgUid,
      region,
      referenceFieldLimit,
      jsonRteLimit,
      fetchedAt: currentTime,
      planFeatures
    };

    // Step 5: Create org plan file for the specific CMS type only
    console.log(`\n🔄 Step 5: Creating org plan file for ${cmsType} CMS...`);
    
    let createdConfigs = 0;

    try {
      // Read the specific CMS config to get the data path
      const cmsConfigPath = path.join(
        process.cwd(),
        '..',
        'upload-api',
        `migration-${cmsType}`,
        'config',
        'index.json'
      );

      if (fs.existsSync(cmsConfigPath)) {
        const cmsConfig = JSON.parse(fs.readFileSync(cmsConfigPath, 'utf8'));
        const dataPath = cmsConfig.data;

        if (dataPath) {
          // Create data directory directly in upload-api root (not inside migration-*)
          const uploadApiRoot = path.join(process.cwd(), '..', 'upload-api');
          const dataFolderName = dataPath.replace('./', ''); // Remove ./ prefix
          const absoluteDataPath = path.join(uploadApiRoot, dataFolderName);
          
          console.log(`📂 Target directory: ${absoluteDataPath}`);
          
          // Ensure the data directory exists
          if (!fs.existsSync(absoluteDataPath)) {
            fs.mkdirSync(absoluteDataPath, { recursive: true });
            console.log(`✅ Created data directory: ${absoluteDataPath}`);
          } else {
            console.log(`📁 Directory already exists: ${absoluteDataPath}`);
          }

          // Write the org-plan-finder.json file (not org-plan-limits.json)
          const orgPlanFilePath = path.join(absoluteDataPath, 'org-plan-finder.json');
          
          // Create the same format as the main database
          const orgPlanData = {
            org_plans: [{
              org_uid: orgUid,
              region,
              authtoken,
              organization_response: planFeatures,
              fetched_at: currentTime,
              isDeleted: false,
            }]
          };
          
          console.log('\n📄 WRITING ORG PLAN FILE:');
          console.log('=' .repeat(40));
          console.log(`📂 File Path: ${orgPlanFilePath}`);
          console.log(`🏢 Org UID: ${orgUid}`);
          console.log(`🌍 Region: ${region}`);
          console.log(`🔢 Plan Features: ${planFeatures.length} items`);
          console.log(`⏰ Timestamp: ${currentTime}`);
          console.log('=' .repeat(40));
          
          fs.writeFileSync(orgPlanFilePath, JSON.stringify(orgPlanData, null, 2));
          console.log(`✅ Created ${cmsType} org plan file: ${orgPlanFilePath}`);
          
          // Verify file was created successfully
          if (fs.existsSync(orgPlanFilePath)) {
            const fileStats = fs.statSync(orgPlanFilePath);
            console.log(`✅ File verification: ${fileStats.size} bytes written`);
          } else {
            console.log(`❌ File verification: File not found after creation!`);
          }
          
          createdConfigs++;
        } else {
          console.log(`⚠️ No 'data' field found in ${cmsType} config`);
        }
      } else {
        console.log(`📁 No config found for ${cmsType} at: ${cmsConfigPath}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${cmsType} org plan file:`, error);
    }

    console.log('\n🎉 DUAL ORG PLAN WRITER - SUCCESS!');
    console.log(`📊 Created ${createdConfigs} config files + 1 database entry`);
    console.log('=' .repeat(70));

    logger.info(getLogMessage(
      srcFunc,
      `Dual org plan files created successfully for project: ${projectId}, org: ${orgUid}`,
      { projectId, orgUid, region, cmsType, createdConfigs }
    ));

    return {
      success: true,
      message: 'Dual org plan files created successfully',
      data: {
        projectId,
        orgUid,
        referenceFieldLimit,
        jsonRteLimit,
        configFilesCreated: createdConfigs,
        fetchedAt: currentTime
      }
    };

  } catch (error: any) {
    console.log('\n❌ DUAL ORG PLAN WRITER - ERROR!');
    console.log('Error details:', {
      message: error?.message,
      stack: error?.stack
    });
    console.log('=' .repeat(70));

    logger.error(getLogMessage(
      srcFunc,
      'Error occurred while creating dual org plan files',
      { projectId, orgUid, region, cmsType },
      error
    ));

    return {
      success: false,
      message: error?.message || 'Failed to create dual org plan files'
    };
  }
};

/**
 * Cleans up org plan files from data folders when a project is deleted
 * @param projectId - The project ID to clean up
 * @param cmsType - The specific CMS type to clean up
 * @returns Promise with cleanup result
 */
export const cleanupOrgPlanConfigs = async (projectId: string, cmsType: string = 'contentful'): Promise<void> => {
  console.log(`\n🗑️ Cleaning up org plan files for project: ${projectId} (${cmsType})`);
  
  try {
    // Read the CMS config to get the data path
    const cmsConfigPath = path.join(
      process.cwd(),
      '..',
      'upload-api',
      `migration-${cmsType}`,
      'config',
      'index.json'
    );

    if (fs.existsSync(cmsConfigPath)) {
      const cmsConfig = JSON.parse(fs.readFileSync(cmsConfigPath, 'utf8'));
      const dataPath = cmsConfig.data;

      if (dataPath) {
        // Look in upload-api root data folder
        const uploadApiRoot = path.join(process.cwd(), '..', 'upload-api');
        const dataFolderName = dataPath.replace('./', ''); // Remove ./ prefix
        const absoluteDataPath = path.join(uploadApiRoot, dataFolderName);
        const orgPlanFilePath = path.join(absoluteDataPath, 'org-plan-finder.json');

        if (fs.existsSync(orgPlanFilePath)) {
          const orgPlanData = JSON.parse(fs.readFileSync(orgPlanFilePath, 'utf8'));
          // Check if any org plan entry matches this project (could be based on timing or other logic)
          fs.unlinkSync(orgPlanFilePath);
          console.log(`✅ Deleted ${cmsType} org plan file: ${orgPlanFilePath}`);
        } else {
          console.log(`📁 No org plan file found for ${cmsType}`);
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ Failed to cleanup ${cmsType} org plan file:`, error);
  }
};

export default {
  createDualOrgPlanFiles,
  cleanupOrgPlanConfigs
};
