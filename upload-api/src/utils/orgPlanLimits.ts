import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for organization plan limits
 */
interface OrgPlanLimits {
  referenceFieldLimit: number;
  jsonRteLimit: number;
  orgUid: string | null;
  fetched_at: string | null;
}

/**
 * Interface for organization plan entry from org-plan-finder.json
 */
interface OrgPlanEntry {
  org_uid: string;
  region: string;
  authtoken: string;
  organization_response: any[];
  fetched_at: string;
  isDeleted?: boolean;
}

/**
 * Interface for project data from project.json
 */
interface ProjectEntry {
  id: string;
  org_id: string;
  [key: string]: any;
}

/**
 * Gets the data folder path for a specific CMS type by reading its config
 * @param cmsType - The CMS type (contentful, sitecore, wordpress, etc.)
 * @returns The data folder path or null if not found
 */
const getCMSDataPath = (cmsType: string): string | null => {
  try {
    // Fixed path: should look in upload-api/migration-*/config/
    const configPath = path.join(__dirname, `../../migration-${cmsType}/config/index.json`);
    
    if (!fs.existsSync(configPath)) {
      console.log(`📁 No config found for ${cmsType} at: ${configPath}`);
      return null;
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const dataPath = configData.data;
    
    if (!dataPath) {
      console.log(`⚠️ No 'data' field found in ${cmsType} config`);
      return null;
    }

    // The data path should be relative to upload-api root, not migration folder
    const uploadApiRoot = path.join(__dirname, '../..');
    const dataFolderName = dataPath.replace('./', ''); // Remove ./ prefix
    const absoluteDataPath = path.join(uploadApiRoot, dataFolderName);
    console.log(`📂 ${cmsType} data path: ${absoluteDataPath}`);
    
    return absoluteDataPath;
  } catch (error: any) {
    console.error(`❌ Error reading ${cmsType} config:`, error.message);
    return null;
  }
};

/**
 * Fetches organization plan limits from the org-plan-finder.json file
 * @param orgUid - The organization UID to fetch limits for
 * @returns An object containing the plan limits
 */
export const getOrgPlanLimits = (orgUid: string): OrgPlanLimits => {
  try {
    // Path to the org-plan-finder.json file in the API database
    const orgPlanPath = path.join(__dirname, '../../api/database/org-plan-finder.json');
    
    // Check if the file exists
    if (!fs.existsSync(orgPlanPath)) {
      console.warn('⚠️ org-plan-finder.json not found, using default limits');
      return getDefaultLimits();
    }

    // Read and parse the org plan data
    const orgPlanData = JSON.parse(fs.readFileSync(orgPlanPath, 'utf8'));
    
    // Find the organization entry
    const orgEntry: OrgPlanEntry | undefined = orgPlanData.org_plans?.find(
      (plan: OrgPlanEntry) => plan.org_uid === orgUid
    );
    
    if (!orgEntry || !orgEntry.organization_response) {
      console.warn(`⚠️ Organization ${orgUid} not found in org-plan-finder.json, using default limits`);
      return getDefaultLimits();
    }

    // Extract the plan features
    const planFeatures = orgEntry.organization_response;
    
    // Find specific limit features
    const maxContentTypesPerReferenceField = planFeatures.find(
      (feature: any) => feature.uid === 'maxContentTypesPerReferenceField'
    );
    
    const maxContentTypesPerJsonRte = planFeatures.find(
      (feature: any) => feature.uid === 'maxContentTypesPerJsonRte'
    );

    const limits: OrgPlanLimits = {
      referenceFieldLimit: maxContentTypesPerReferenceField?.limit || 10, // Default to 10 if not found
      jsonRteLimit: maxContentTypesPerJsonRte?.limit || 15, // Default to 15 if not found
      orgUid: orgUid,
      fetched_at: orgEntry.fetched_at
    };

    console.log(`✅ Org plan limits loaded for ${orgUid}:`, {
      referenceFieldLimit: limits.referenceFieldLimit,
      jsonRteLimit: limits.jsonRteLimit
    });

    return limits;

  } catch (error: any) {
    console.error('❌ Error reading org plan limits:', error.message);
    return getDefaultLimits();
  }
};

/**
 * Returns default limits when org plan data is not available
 * @returns Default limit values
 */
export const getDefaultLimits = (): OrgPlanLimits => {
  console.log('📋 Using default limits');
  return {
    referenceFieldLimit: 10, // Default reference field limit
    jsonRteLimit: 15,        // Default JSON RTE limit
    orgUid: null,
    fetched_at: null
  };
};

/**
 * Caches org plan limits to avoid repeated file reads
 */
const orgLimitCache = new Map<string, OrgPlanLimits>();

/**
 * Gets org plan limits with caching
 * @param orgUid - The organization UID
 * @returns Cached or fresh org plan limits
 */
export const getCachedOrgPlanLimits = (orgUid: string): OrgPlanLimits => {
  // Check cache first
  if (orgLimitCache.has(orgUid)) {
    const cached = orgLimitCache.get(orgUid)!;
    console.log(`📦 Using cached limits for ${orgUid}`);
    return cached;
  }

  // Fetch fresh data and cache it
  const limits = getOrgPlanLimits(orgUid);
  orgLimitCache.set(orgUid, limits);
  
  return limits;
};

/**
 * Detects the current CMS type based on the calling context
 * @returns The detected CMS type or 'contentful' as default
 */
const detectCurrentCMSType = (): string => {
  try {
    // Get the stack trace to see which file called this
    const stack = new Error().stack;
    if (stack) {
      if (stack.includes('migration-contentful')) return 'contentful';
      if (stack.includes('migration-sitecore')) return 'sitecore';
      if (stack.includes('migration-wordpress')) return 'wordpress';
    }
    
    // Check current working directory
    const cwd = process.cwd();
    if (cwd.includes('migration-contentful')) return 'contentful';
    if (cwd.includes('migration-sitecore')) return 'sitecore';
    if (cwd.includes('migration-wordpress')) return 'wordpress';
    
    // Default fallback
    return 'contentful';
  } catch (error) {
    return 'contentful';
  }
};

/**
 * Finds org plan file for a specific CMS type
 * @param projectId - The project ID to look for
 * @param cmsType - The specific CMS type to check
 * @returns The matching config found, or null
 */
const findConfigForSpecificCMS = (projectId: string, cmsType: string): OrgPlanLimits | null => {
  try {
    console.log(`🔍 Looking for org plan in ${cmsType} data folder...`);
    
    const dataPath = getCMSDataPath(cmsType);
    if (!dataPath) {
      console.log(`❌ Could not determine data path for ${cmsType}`);
      return null;
    }
    
    const orgPlanPath = path.join(dataPath, 'org-plan-finder.json'); // Correct filename!
    console.log(`📂 Checking: ${orgPlanPath}`);
    
    if (fs.existsSync(orgPlanPath)) {
      const orgPlanData = JSON.parse(fs.readFileSync(orgPlanPath, 'utf8'));
      
      // Extract from org_plans array (same format as main database)
      if (orgPlanData.org_plans && orgPlanData.org_plans.length > 0) {
        const orgPlan = orgPlanData.org_plans[0]; // Take first org plan
        const planFeatures = orgPlan.organization_response || [];
        
        // Extract specific limits
        const maxContentTypesPerReferenceField = planFeatures.find(
          (feature: any) => feature.uid === 'maxContentTypesPerReferenceField'
        );
        const maxContentTypesPerJsonRte = planFeatures.find(
          (feature: any) => feature.uid === 'maxContentTypesPerJsonRte'
        );
        
        const limits = {
          referenceFieldLimit: maxContentTypesPerReferenceField?.limit || 10,
          jsonRteLimit: maxContentTypesPerJsonRte?.limit || 15,
          orgUid: orgPlan.org_uid,
          fetched_at: orgPlan.fetched_at
        };
        
        console.log(`🎯 FOUND: Org plan in ${cmsType} data folder!`);
        console.log(`   🔗 Reference Field Limit: ${limits.referenceFieldLimit}`);
        console.log(`   📝 JSON RTE Limit: ${limits.jsonRteLimit}`);
        
        return limits;
      }
    } else {
      console.log(`📁 No org plan file found at: ${orgPlanPath}`);
    }
  } catch (error) {
    console.log(`⚠️ Error checking ${cmsType} data folder:`, error);
  }
  
  return null;
};

/**
 * Gets org plan limits by project ID - NEW OPTIMIZED VERSION
 * First tries to read from local config, falls back to database lookup
 * @param projectId - The project ID
 * @param cmsType - The CMS type (contentful, sitecore, wordpress, etc.) - optional for auto-detection
 * @returns Org plan limits for the project's organization
 */
export const getOrgPlanLimitsByProject = (projectId: string, cmsType?: string): OrgPlanLimits => {
  try {
    // Auto-detect CMS type if not provided
    const detectedCmsType = cmsType || detectCurrentCMSType();
    console.log(`🎯 CMS Type: ${detectedCmsType} (${cmsType ? 'provided' : 'auto-detected'})`);
    
    // STEP 1: Try specific CMS type first - READ FROM DATA FOLDER!
    if (detectedCmsType) {
      const dataPath = getCMSDataPath(detectedCmsType);
      
      if (dataPath) {
        const orgPlanPath = path.join(dataPath, 'org-plan-limits.json');
        console.log(`🔍 Looking for ${detectedCmsType} org plan at: ${orgPlanPath}`);
        
        if (fs.existsSync(orgPlanPath)) {
          console.log(`✅ Org plan file found for ${detectedCmsType}`);
          const configData = JSON.parse(fs.readFileSync(orgPlanPath, 'utf8'));
          
          // Verify this config is for the correct project
          if (configData.projectId === projectId) {
            console.log(`🚀 FAST PATH: Using ${detectedCmsType} data folder for project ${projectId}`);
            return {
              referenceFieldLimit: configData.referenceFieldLimit || 10,
              jsonRteLimit: configData.jsonRteLimit || 15,
              orgUid: configData.orgUid,
              fetched_at: configData.fetchedAt
            };
          } else {
            console.log(`⚠️ Org plan found but for different project (${configData.projectId} vs ${projectId})`);
          }
        } else {
          console.log(`📁 No org plan found at: ${orgPlanPath}`);
          console.log(`📂 Data directory exists: ${fs.existsSync(dataPath)}`);
        }
      } else {
        console.log(`❌ Could not determine data path for ${detectedCmsType}`);
      }
    }
    
    // STEP 2: Check specific CMS type only
    console.log(`🔄 SPECIFIC CHECK: Looking for org plan in ${detectedCmsType} for project ${projectId}...`);
    const specificConfig = findConfigForSpecificCMS(projectId, detectedCmsType);
    if (specificConfig) {
      return specificConfig;
    }

    // STEP 3: FINAL FALLBACK - Use defaults
    console.log(`📋 FINAL FALLBACK: No org plan data found anywhere, using default limits for project ${projectId}`);
    return getDefaultLimits();

  } catch (error: any) {
    console.error('❌ Error in getOrgPlanLimitsByProject:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return getDefaultLimits();
  }
};

/**
 * Clears the org limits cache (useful for testing or when data changes)
 */
export const clearOrgLimitsCache = (): void => {
  orgLimitCache.clear();
  console.log('🗑️ Org limits cache cleared');
};

/**
 * Gets cache statistics for monitoring
 */
export const getOrgLimitsCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: orgLimitCache.size,
    keys: Array.from(orgLimitCache.keys())
  };
};

/**
 * SUPER SIMPLE VERSION - Auto-detects everything!
 * Use this when you just want limits without specifying anything
 * @param projectId - The project ID
 * @returns Org plan limits with full auto-detection
 */
export const getOrgLimits = (projectId: string): OrgPlanLimits => {
  return getOrgPlanLimitsByProject(projectId);
};

// Default export for convenience
export default {
  getOrgPlanLimits,
  getCachedOrgPlanLimits,
  getOrgPlanLimitsByProject,
  getOrgLimits,
  getDefaultLimits,
  clearOrgLimitsCache,
  getOrgLimitsCacheStats
};
