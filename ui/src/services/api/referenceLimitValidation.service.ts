import { AxiosResponse } from 'axios';
import { postCall } from './service';

/**
 * Interface for reference violation data
 */
export interface ReferenceViolation {
  contentType: string;
  field: string;
  type: 'reference' | 'json_rte';
  current: number;
  limit: number;
  message: string;
}

/**
 * Interface for validation response
 */
export interface ReferenceValidationResponse {
  status: number;
  message: string;
  data: {
    isValid: boolean;
    violations: ReferenceViolation[];
    totalViolations: number;
    validationDetails: ReferenceViolation[];
  };
}

/**
 * Interface for reference usage summary
 */
export interface ReferenceUsageSummary {
  status: number;
  data: {
    totalContentTypes: number;
    totalReferenceFields: number;
    totalJsonRteFields: number;
    violationsFound: number;
    isCompliant: boolean;
    violations: ReferenceViolation[];
    validationMessage: string;
  };
}

/**
 * Validates reference limits for all content types in a project
 * @param orgId - Organization ID
 * @param projectId - Project ID
 * @param tokenPayload - User authentication token payload
 * @returns Promise<ReferenceValidationResponse>
 */
export const validateReferenceeLimits = async (
  orgId: string,
  projectId: string,
  tokenPayload: any
): Promise<ReferenceValidationResponse> => {
  try {
    console.info(`🔍 Validating reference limits for project: ${projectId}`);
    
    const response = await postCall(
      `/v2/projects/${projectId}/validate-reference-limits`,
      { token_payload: tokenPayload }
    );

    console.info(`✅ Reference validation response:`, {
      status: response.data.status,
      isValid: response.data.data?.isValid,
      violations: response.data.data?.totalViolations || 0
    });

    return response.data;
  } catch (error: any) {
    console.error('❌ Error validating reference limits:', error);
    
    // Handle validation errors (400) differently from server errors (500)
    if (error.response?.status === 400) {
      // This means validation completed but found violations
      return error.response.data;
    }
    
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to validate reference limits'
    );
  }
};

/**
 * Gets reference usage summary for a project
 * @param orgId - Organization ID
 * @param projectId - Project ID
 * @param tokenPayload - User authentication token payload
 * @returns Promise<ReferenceUsageSummary>
 */
export const getReferenceUsageSummary = async (
  orgId: string,
  projectId: string,
  tokenPayload: any
): Promise<ReferenceUsageSummary> => {
  try {
    console.info(`📊 Getting reference usage summary for project: ${projectId}`);
    
    const response = await postCall(
      `/v2/projects/${projectId}/reference-usage-summary`,
      { token_payload: tokenPayload }
    );

    console.info(`✅ Reference usage summary:`, {
      contentTypes: response.data.data?.totalContentTypes,
      violations: response.data.data?.violationsFound,
      compliant: response.data.data?.isCompliant
    });

    return response.data;
  } catch (error: any) {
    console.error('❌ Error getting reference usage summary:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to get reference usage summary'
    );
  }
};

/**
 * Formats violation messages for display in notifications
 * @param violations - Array of reference violations
 * @returns Array of formatted violation messages
 */
export const formatViolationMessages = (violations: ReferenceViolation[]): string[] => {
  return violations.map(violation => {
    const fieldType = violation.type === 'reference' ? 'Reference field' : 'JSON RTE field';
    const objectType = violation.type === 'reference' ? 'embedded references' : 'embedded objects';
    return `${violation.contentType}.${violation.field} - ${fieldType} has ${violation.current} ${objectType} from Contentful JSON, but limit is ${violation.limit}.`;
  });
};

/**
 * Formats violation messages for step transition blocking
 * @param violations - Array of reference violations
 * @returns Formatted message for step transition notification
 */
export const formatStepTransitionMessage = (violations: ReferenceViolation[]): string => {
  const violationCount = violations.length;
  const title = `Cannot proceed to Test Migration. Found ${violationCount} reference limit violation${violationCount > 1 ? 's' : ''}.`;
  
  const violationsList = violations.map((violation, index) => {
    const fieldType = violation.type === 'reference' ? 'Reference field' : 'JSON RTE field';
    const objectType = violation.type === 'reference' ? 'embedded references' : 'embedded objects';
    return `${index + 1}. CT: "${violation.contentType}" | Field: "${violation.field}" | ${fieldType} has ${violation.current} ${objectType}, limit is ${violation.limit}`;
  }).join('\n');
  
  return `${title}\n\n${violationsList}\n\nPlease reduce the number of references in the above fields before proceeding.`;
};

/**
 * Groups violations by content type for better display
 * @param violations - Array of reference violations
 * @returns Object with content types as keys and their violations as values
 */
export const groupViolationsByContentType = (violations: ReferenceViolation[]) => {
  return violations.reduce((groups: { [key: string]: ReferenceViolation[] }, violation) => {
    const contentType = violation.contentType;
    if (!groups[contentType]) {
      groups[contentType] = [];
    }
    groups[contentType].push(violation);
    return groups;
  }, {});
};
