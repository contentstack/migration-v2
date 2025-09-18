import { Request } from "express";
import { getLogMessage, safePromise } from "../utils/index.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";
import logger from "../utils/logger.js";
import ContentTypesMapperModelLowdb from "../models/contentTypesMapper-lowdb.js";
import FieldMapperModel from "../models/FieldMapper.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import { orgService } from "./org.service.js";

/**
 * Interface for reference limit validation result
 */
export interface ReferenceValidationResult {
  isValid: boolean;
  violations: ReferenceViolation[];
  totalViolations: number;
  validationSummary: string;
}

/**
 * Interface for individual reference limit violation
 */
export interface ReferenceViolation {
  contentTypeName: string;
  contentTypeUid: string;
  fieldName: string;
  fieldUid: string;
  fieldType: 'reference' | 'json_rte';
  currentCount: number;
  allowedLimit: number;
  violation: string;
}

/**
 * Validates reference limits for all content types in a project
 * @param req - The request object containing project ID and token payload
 * @returns Validation result with any violations found
 */
const validateReferenceeLimits = async (req: Request): Promise<ReferenceValidationResult> => {
  const srcFunc = "validateReferenceLimits";
  const { projectId } = req.params;
  const { token_payload } = req.body;

  console.log("\n🔍 REFERENCE LIMIT VALIDATION - Starting...");
  console.log("=" .repeat(60));
  console.log(`📋 Project ID: ${projectId}`);

  try {
    // Step 1: Get org plan limits for this project
    console.log("\n📊 Step 1: Getting org plan limits...");
    const orgLimitsReq = {
      ...req,
      body: { org_uid: token_payload?.organization?.uid || req.body.token_payload?.organization?.uid }
    } as Request;
    
    const orgLimitsResult = await orgService.getOrgPlanDetails(orgLimitsReq);
    
    if (orgLimitsResult.status !== HTTP_CODES.OK || !orgLimitsResult.data?.org_plan) {
      console.log("⚠️ Could not fetch org plan limits, using defaults");
      // Use default limits if org plan not available
      var referenceFieldLimit = 10;
      var jsonRteLimit = 15;
    } else {
      const planFeatures = orgLimitsResult.data.org_plan.organization_response;
      const maxContentTypesPerReferenceField = planFeatures.find(
        (feature: any) => feature.uid === 'maxContentTypesPerReferenceField'
      );
      const maxContentTypesPerJsonRte = planFeatures.find(
        (feature: any) => feature.uid === 'maxContentTypesPerJsonRte'
      );
      
      referenceFieldLimit = maxContentTypesPerReferenceField?.limit || 10;
      jsonRteLimit = maxContentTypesPerJsonRte?.limit || 15;
    }

    console.log(`🔗 Reference Field Limit: ${referenceFieldLimit}`);
    console.log(`📝 JSON RTE Limit: ${jsonRteLimit}`);

    // Step 2: Get all content types for this project
    console.log("\n📚 Step 2: Getting content types...");
    await ProjectModelLowdb.read();
    const projectDetails = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();

    if (!projectDetails?.content_mapper?.length) {
      console.log("✅ No content types found - validation passed");
      return {
        isValid: true,
        violations: [],
        totalViolations: 0,
        validationSummary: "No content types to validate"
      };
    }

    // Step 3: Get content type details
    console.log(`📋 Found ${projectDetails.content_mapper.length} content types to validate`);
    await ContentTypesMapperModelLowdb.read();
    await FieldMapperModel.read();

    const violations: ReferenceViolation[] = [];

    // Step 4: Validate each content type
    for (const contentTypeId of projectDetails.content_mapper) {
      const contentType = ContentTypesMapperModelLowdb.chain
        .get("ContentTypesMappers")
        .find({ id: contentTypeId, projectId: projectId })
        .value();

      if (!contentType?.fieldMapping?.length) {
        continue;
      }

      console.log(`\n🔍 Validating: ${contentType.otherCmsTitle}`);

      // Step 5: Validate each field in the content type
      for (const fieldId of contentType.fieldMapping) {
        const field = FieldMapperModel.chain
          .get("field_mapper")
          .find({ id: fieldId, projectId: projectId, contentTypeId: contentTypeId })
          .value();

        if (!field) continue;

        // Check reference fields (from contentful JSON embedded objects)
        if (field.contentstackFieldType === 'reference' && field.refrenceTo) {
          // Handle both single reference and array of references from contentful JSON
          let currentCount = 0;
          if (Array.isArray(field.refrenceTo)) {
            currentCount = field.refrenceTo.length;
          } else if (field.refrenceTo?.uid) {
            currentCount = 1;
          }

          if (currentCount > referenceFieldLimit) {
            violations.push({
              contentTypeName: contentType.otherCmsTitle,
              contentTypeUid: contentType.otherCmsUid,
              fieldName: field.otherCmsField,
              fieldUid: field.contentstackFieldUid,
              fieldType: 'reference',
              currentCount,
              allowedLimit: referenceFieldLimit,
              violation: `${contentType.otherCmsTitle}.${field.otherCmsField} - Reference field has ${currentCount} embedded references from Contentful JSON, but limit is ${referenceFieldLimit}.`
            });
            console.log(`❌ VIOLATION: ${field.otherCmsField} has ${currentCount} embedded references (limit: ${referenceFieldLimit})`);
          } else if (currentCount > 0) {
            console.log(`✅ OK: ${field.otherCmsField} has ${currentCount} embedded references (limit: ${referenceFieldLimit})`);
          }
        }

        // Check JSON RTE fields (embedded objects from contentful JSON)
        if (field.contentstackFieldType === 'json' && field.advanced?.embedObjects?.length) {
          const currentCount = field.advanced.embedObjects.length;
          if (currentCount > jsonRteLimit) {
            violations.push({
              contentTypeName: contentType.otherCmsTitle,
              contentTypeUid: contentType.otherCmsUid,
              fieldName: field.otherCmsField,
              fieldUid: field.contentstackFieldUid,
              fieldType: 'json_rte',
              currentCount,
              allowedLimit: jsonRteLimit,
              violation: `${contentType.otherCmsTitle}.${field.otherCmsField} - JSON RTE field has ${currentCount} embedded objects from Contentful JSON, but limit is ${jsonRteLimit}.`
            });
            console.log(`❌ VIOLATION: ${field.otherCmsField} has ${currentCount} embedded objects (limit: ${jsonRteLimit})`);
          } else {
            console.log(`✅ OK: ${field.otherCmsField} has ${currentCount} embedded objects (limit: ${jsonRteLimit})`);
          }
        }
      }
    }

    // Step 6: Generate validation result
    const isValid = violations.length === 0;
    const validationSummary = isValid 
      ? `All content types are within reference limits (Reference: ${referenceFieldLimit}, JSON RTE: ${jsonRteLimit})`
      : `Found ${violations.length} reference limit violations. Please review and update the affected fields.`;

    console.log("\n📊 VALIDATION RESULT:");
    console.log(`✅ Valid: ${isValid}`);
    console.log(`⚠️ Violations: ${violations.length}`);
    console.log("=" .repeat(60));

    logger.info(
      getLogMessage(
        srcFunc,
        `Reference limit validation completed for project ${projectId}. Violations: ${violations.length}`,
        token_payload
      )
    );

    return {
      isValid,
      violations,
      totalViolations: violations.length,
      validationSummary
    };

  } catch (error: any) {
    console.error("❌ Error in reference limit validation:", error);
    logger.error(
      getLogMessage(
        srcFunc,
        `Error validating reference limits for project ${projectId}`,
        token_payload,
        error
      )
    );

    return {
      isValid: false,
      violations: [],
      totalViolations: 0,
      validationSummary: `Validation failed: ${error.message}`
    };
  }
};

/**
 * Gets a summary of reference usage across all content types
 * @param req - The request object containing project ID and token payload
 * @returns Summary of reference usage
 */
const getReferenceUsageSummary = async (req: Request) => {
  const srcFunc = "getReferenceUsageSummary";
  const { projectId } = req.params;

  try {
    const validationResult = await validateReferenceeLimits(req);
    
    const summary = {
      totalContentTypes: 0,
      totalReferenceFields: 0,
      totalJsonRteFields: 0,
      violationsFound: validationResult.totalViolations,
      isCompliant: validationResult.isValid,
      violations: validationResult.violations,
      validationMessage: validationResult.validationSummary
    };

    // Count totals from violations and valid fields
    await ProjectModelLowdb.read();
    const projectDetails = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();

    if (projectDetails?.content_mapper?.length) {
      summary.totalContentTypes = projectDetails.content_mapper.length;
    }

    logger.info(
      getLogMessage(
        srcFunc,
        `Reference usage summary generated for project ${projectId}`,
        {}
      )
    );

    return {
      status: HTTP_CODES.OK,
      data: summary
    };

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error generating reference usage summary for project ${projectId}`,
        {},
        error
      )
    );

    return {
      status: HTTP_CODES.SERVER_ERROR,
      message: error.message || HTTP_TEXTS.INTERNAL_ERROR
    };
  }
};

export const referenceLimitValidationService = {
  validateReferenceeLimits,
  getReferenceUsageSummary
};
