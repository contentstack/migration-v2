import { ObjectType } from '../../utilities/constants.interface';
import { API_VERSION, EXECUTION_LOGS_ERROR_TEXT } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall, patchCall } from './service';

const options = () => ({
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
});

export const getMigrationData = (orgId: string, projectId: string) => {
  try {
    return getCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in getting migrationData: ${error.message}`);
    } else {
      throw new Error('Unknown error in getting migrationData');
    }
  }
};

export const updateLegacyCMSData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/legacy-cms`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateAffixData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/affix`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateFileFormatData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/file-format`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateSourceConfigData = (
  orgId: string,
  projectId: string,
  data: ObjectType
) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/source-config`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateDestinationStack = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/destination-stack`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateCurrentStepData = (orgId: string, projectId: string, data: ObjectType = {}) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/current-step`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const affixConfirmation = (orgId: string, projectId: string, data: ObjectType = {}) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/affix_confirmation`,
      data,
      options()
    );
  } catch (error) {
    return error;
  }
};

export const fileformatConfirmation = (orgId: string, projectId: string, data: ObjectType = {}) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/fileformat_confirmation`,
      data,
      options()
    );
  } catch (error) {
    return error;
  }
};

export const getContentTypes = (
  projectId: string,
  skip: number,
  limit: number,
  searchText: string,
  filter?: 'new' | 'old'
) => {
  try {
    const encodedSearchText = encodeURIComponent(searchText);
    // Delta migration (iteration > 1): 'new' → first-time content types for Step 3 (field
    // mapping), 'old' → already-migrated content types for Step 4 (entry mapping). Ignored on
    // iteration 1 by the backend.
    const filterQuery = filter ? `&filter=${filter}` : '';
    return getCall(
      `${API_VERSION}/mapper/contentTypes/${projectId}/${skip}/${limit}/${encodedSearchText}?${filterQuery}`,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getFieldMapping = async (
  contentTypeId: string,
  skip: number,
  limit: number,
  searchText: string,
  projectId: string
) => {
  try {
    const encodedSearchText = encodeURIComponent(searchText);
    return await getCall(
      `${API_VERSION}/mapper/fieldMapping/${projectId}/${contentTypeId}/${skip}/${limit}/${encodedSearchText}?`,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

// export const getExistingContentTypes = async (projectId: string) => {
//   try {
//     return await getCall(`${API_VERSION}/mapper/${projectId}`, options);
//     return await getCall(`${API_VERSION}/mapper/${projectId}/${contentTypeUid}`, options);
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`${error.message}`);
//     } else {
//       throw new Error('Unknown error');
//     }
//   }
// };

// export const getSingleGlobalField = async (projectId: string, globalFieldUid: string) => {
//   try {
//     return await getCall(`${API_VERSION}/mapper/${projectId}/globalFields/${globalFieldUid}`, options);
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`${error.message}`);
//     } else {
//       throw new Error('Unknown error');
//     }
//   }
// };

export const updateContentType = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/contentTypes/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const resetToInitialMapping = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/resetFields/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getExistingContentTypes = async (projectId: string, contentTypeUid?: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}/contentTypes/${contentTypeUid ?? ''}`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
}

export const getExistingGlobalFields = async (projectId: string, globalFieldUid?: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}/globalFields/${globalFieldUid ?? ''}`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
}


export const removeContentMapper = async (orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${orgId}/${projectId}/content-mapper`, options());
  } catch (error) {
    return error;

  }
}

export const updateContentMapper = async (
  orgId: string,
  projectId: string,
  data: ObjectType
) => {
  const mapperKeys = { content_mapper: data }

  try {
    return await patchCall(
      `${API_VERSION}/mapper/${orgId}/${projectId}/mapper_keys`,
      mapperKeys,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateStackDetails = async (orgId: string, projectId: string, data: ObjectType) => {
  try {
    const Data = { stack_details: data };
    return await patchCall(`${API_VERSION}/org/${orgId}/project/${projectId}/stack-details`, Data, options());
  } catch (error) {
    return error;

  }
}

export const getOrgDetails = async (orgId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/get_org_details`, options());
  } catch (error) {
    return error;
  }
}

export const createTestStack = async (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/create-test-stack/${orgId}/${projectId}`,
      data,
      options()
    );
  } catch (error) {
    return error;
  }
};

/** Test migration can run for a long time (full Contentstack import). */
const TEST_MIGRATION_TIMEOUT_MS = 3 * 60 * 60 * 1000;

export const createTestMigration = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/test-stack/${orgId}/${projectId}`,
      {},
      { ...options(), timeout: TEST_MIGRATION_TIMEOUT_MS }
    );
  } catch (error) {
    return error;
  }
};

const FINAL_MIGRATION_TIMEOUT_MS = 6 * 60 * 60 * 1000;

export const startMigration = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/start/${orgId}/${projectId}`,
      {},
      { ...options(), timeout: FINAL_MIGRATION_TIMEOUT_MS }
    );
  } catch (error) {
    return error;
  }
};

export const exportSourceStack = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/source/export/${orgId}/${projectId}`,
      {},
      options()
    );
  } catch (error) {
    return error;
  }
};

export const validateSourceExport = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/source/validate/${orgId}/${projectId}`,
      {},
      options()
    );
  } catch (error) {
    return error;
  }
};

export const runSourceAudit = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/audit/run/${orgId}/${projectId}`,
      {},
      options()
    );
  } catch (error) {
    return error;
  }
};

export const getSourceAudit = async (projectId: string, moduleName = 'all') => {
  try {
    return await getCall(
      `${API_VERSION}/migration/audit/${projectId}/${moduleName}`,
      options()
    );
  } catch (error) {
    return error;
  }
};

export const updateAuditSelections = async (orgId: string, projectId: string, excludedItems: any[], selectionStats: any) => {
  const url = `${API_VERSION}/org/${orgId}/project/${projectId}`;
  const payload = { 
    legacy_cms: {
      audit: {
        excludedItems, 
        selectionStats,
        updated_at: new Date().toISOString()
      }
    }
  };
  
  try {
    const response = await putCall(url, payload, options());
    return response;
  } catch (error) {
    console.error('API Error - updateAuditSelections:', error);
    return error;
  }
};

/** Persists audit summary to project JSON so updateCurrentStep(AUDIT→CONTENT_MAPPING) can pass. */
export const persistAuditSummary = async (
  orgId: string,
  projectId: string,
  summary: unknown
) => {
  const url = `${API_VERSION}/org/${orgId}/project/${projectId}`;
  const payload = {
    legacy_cms: {
      audit: {
        summary,
        summary_generated_at: new Date().toISOString()
      }
    }
  };
  try {
    return await putCall(url, payload, options());
  } catch (error) {
    console.error('API Error - persistAuditSummary:', error);
    return error;
  }
};

export const updateMigrationKey = async (orgId: string, projectId: string) => {
  try {
    return await putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/migration-excution`, {}, options());
  } catch (error) {
    return error;
  }
};

export const updateLocaleMapper = async(projectId: string, data: any) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/updateLocales/${projectId}`, data, options());
  } catch (error) {
    return error;
  }
}

export const getExistingTaxonomies = async (projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}/taxonomies`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getMigrationLogs = async (orgId: string, projectId: string, stackId: string, skip:number , limit:number  , startIndex:number, stopIndex:number,searchText:string, filter: string ) => {
  try {
      return await getCall(
        `${API_VERSION}/migration/get_migration_logs/${orgId}/${projectId}/${stackId}/${skip}/${limit}/${startIndex}/${stopIndex}/${searchText}/${filter}`,
        options()
      );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${EXECUTION_LOGS_ERROR_TEXT.ERROR}: ${error.message}`);
    } else {
      throw new Error(`Unknown ${EXECUTION_LOGS_ERROR_TEXT.ERROR}`);
    }
  }
}

export const restartMigration = async (orgId: string, projectId: string) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/restart/${orgId}/${projectId}`, {}, options());
  } catch (error) {
    return error;
  }
}

export const getEntryMapping = async (
  contentTypeId: string,
  skip: number,
  limit: number,
  searchText: string,
  projectId: string,
  locale?: string
) => {
  try {
    const encodedSearchText = encodeURIComponent(searchText);
    const localeQuery = locale ? `locale=${encodeURIComponent(locale)}` : '';
    return await getCall(
      `${API_VERSION}/mapper/entryMapping/${projectId}/${contentTypeId}/${skip}/${limit}/${encodedSearchText}?${localeQuery}`,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};
export const updateEntryMapper = async (
  projectId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/updateEntryStatus/${projectId}`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getAssetMapping = async (
  skip: number,
  limit: number,
  searchText: string,
  projectId: string
) => {
  try {
    const encodedSearchText = encodeURIComponent(searchText);
    return await getCall(
      `${API_VERSION}/mapper/assetMapping/${projectId}/${skip}/${limit}/${encodedSearchText}?`,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateAssetMapper = async (
  projectId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/updateAssetStatus/${projectId}`,
      data,
      options()
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

