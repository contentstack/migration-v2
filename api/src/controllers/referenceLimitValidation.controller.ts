import { Request, Response } from "express";
import { referenceLimitValidationService } from "../services/referenceLimitValidation.service.js";
import { getLogMessage } from "../utils/index.js";
import logger from "../utils/logger.js";
import { HTTP_CODES } from "../constants/index.js";

/**
 * Controller to validate reference limits for a project
 */
const validateReferenceeLimits = async (req: Request, res: Response) => {
  const srcFunc = "validateReferenceLimits";
  const { projectId } = req.params;

  try {
    console.log(`\n🎯 CONTROLLER - Reference limit validation requested for project: ${projectId}`);
    
    const validationResult = await referenceLimitValidationService.validateReferenceeLimits(req);
    
    // Return appropriate status based on validation result
    const statusCode = validationResult.isValid ? HTTP_CODES.OK : HTTP_CODES.BAD_REQUEST;
    
    logger.info(
      getLogMessage(
        srcFunc,
        `Reference limit validation completed for project ${projectId}. Valid: ${validationResult.isValid}`,
        req.body.token_payload
      )
    );

    res.status(statusCode).json({
      status: statusCode,
      message: validationResult.validationSummary,
      data: {
        isValid: validationResult.isValid,
        violations: validationResult.violations,
        totalViolations: validationResult.totalViolations,
        validationDetails: validationResult.violations.map(v => ({
          contentType: v.contentTypeName,
          field: v.fieldName,
          type: v.fieldType,
          current: v.currentCount,
          limit: v.allowedLimit,
          message: v.violation
        }))
      }
    });

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error in reference limit validation controller for project ${projectId}`,
        req.body.token_payload,
        error
      )
    );

    res.status(HTTP_CODES.SERVER_ERROR).json({
      status: HTTP_CODES.SERVER_ERROR,
      message: error.message || "Internal server error during reference limit validation",
      data: null
    });
  }
};

/**
 * Controller to get reference usage summary for a project
 */
const getReferenceUsageSummary = async (req: Request, res: Response) => {
  const srcFunc = "getReferenceUsageSummary";

  try {
    const result = await referenceLimitValidationService.getReferenceUsageSummary(req);
    
    logger.info(
      getLogMessage(
        srcFunc,
        `Reference usage summary requested for project ${req.params.projectId}`,
        req.body.token_payload
      )
    );

    res.status(result.status).json(result);

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error in reference usage summary controller`,
        req.body.token_payload,
        error
      )
    );

    res.status(HTTP_CODES.SERVER_ERROR).json({
      status: HTTP_CODES.SERVER_ERROR,
      message: error.message || "Internal server error",
      data: null
    });
  }
};

export const referenceLimitValidationController = {
  validateReferenceeLimits,
  getReferenceUsageSummary
};
