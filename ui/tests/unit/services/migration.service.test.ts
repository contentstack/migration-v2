import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCall, mockPostCall, mockPutCall, mockPatchCall } = vi.hoisted(() => ({
  mockGetCall: vi.fn(),
  mockPostCall: vi.fn(),
  mockPutCall: vi.fn(),
  mockPatchCall: vi.fn()
}));

vi.mock('../../../src/services/api/service', () => ({
  getCall: mockGetCall,
  postCall: mockPostCall,
  putCall: mockPutCall,
  patchCall: mockPatchCall
}));

vi.mock('../../../src/utilities/constants', () => ({
  API_VERSION: 'v2',
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {},
  EXECUTION_LOGS_ERROR_TEXT: { ERROR: 'Error in Getting Migration Logs' }
}));

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => 'mock-app-token')
}));

import {
  getMigrationData,
  updateLegacyCMSData,
  updateAffixData,
  updateFileFormatData,
  updateDestinationStack,
  updateCurrentStepData,
  affixConfirmation,
  fileformatConfirmation,
  getContentTypes,
  getFieldMapping,
  updateContentType,
  resetToInitialMapping,
  getExistingContentTypes,
  getExistingGlobalFields,
  removeContentMapper,
  updateContentMapper,
  updateStackDetails,
  getOrgDetails,
  createTestStack,
  createTestMigration,
  startMigration,
  updateMigrationKey,
  updateLocaleMapper,
  getExistingTaxonomies,
  getMigrationLogs
} from '../../../src/services/api/migration.service';

describe('services/api/migration.service', () => {
  const orgId = 'org-123';
  const projectId = 'proj-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMigrationData', () => {
    it('should call getCall with org and project ID', () => {
      const mockResponse = { status: 200, data: {} };
      mockGetCall.mockResolvedValue(mockResponse);

      getMigrationData(orgId, projectId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateLegacyCMSData', () => {
    it('should call putCall with legacy-cms endpoint', () => {
      const data = { cms: 'wordpress' };
      mockPutCall.mockResolvedValue({ status: 200 });

      updateLegacyCMSData(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/legacy-cms`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateAffixData', () => {
    it('should call putCall with affix endpoint', () => {
      const data = { affix: 'cs' };
      mockPutCall.mockResolvedValue({ status: 200 });

      updateAffixData(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/affix`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateFileFormatData', () => {
    it('should call putCall with file-format endpoint', () => {
      const data = { file_format: 'json' };
      mockPutCall.mockResolvedValue({ status: 200 });

      updateFileFormatData(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/file-format`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateDestinationStack', () => {
    it('should call putCall with destination-stack endpoint', () => {
      const data = { stack_id: 'stack-1' };
      mockPutCall.mockResolvedValue({ status: 200 });

      updateDestinationStack(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/destination-stack`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateCurrentStepData', () => {
    it('should call putCall with current-step endpoint', () => {
      const data = { step: 2 };
      mockPutCall.mockResolvedValue({ status: 200 });

      updateCurrentStepData(orgId, projectId, data);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/current-step`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });

    it('should use empty object as default data', () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      updateCurrentStepData(orgId, projectId);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/current-step`,
        {},
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('affixConfirmation', () => {
    it('should call putCall with affix_confirmation endpoint', () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      affixConfirmation(orgId, projectId, { confirmed: true });
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/affix_confirmation`,
        { confirmed: true },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('fileformatConfirmation', () => {
    it('should call putCall with fileformat_confirmation endpoint', () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      fileformatConfirmation(orgId, projectId, { confirmed: true });
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/fileformat_confirmation`,
        { confirmed: true },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getContentTypes', () => {
    it('should call getCall with encoded search text', () => {
      mockGetCall.mockResolvedValue({ status: 200, data: {} });

      getContentTypes('proj-1', 0, 10, 'search text');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/mapper/contentTypes/proj-1/0/10/search%20text?',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getFieldMapping', () => {
    it('should call getCall with content type and pagination', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: {} });

      await getFieldMapping('ct-1', 0, 10, 'field', 'proj-1');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/mapper/fieldMapping/proj-1/ct-1/0/10/field?',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateContentType', () => {
    it('should call putCall with content type update data', async () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      await updateContentType(orgId, projectId, 'ct-1', { mapping: {} });
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/mapper/contentTypes/${orgId}/${projectId}/ct-1`,
        { mapping: {} },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('resetToInitialMapping', () => {
    it('should call putCall with reset endpoint', async () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      await resetToInitialMapping(orgId, projectId, 'ct-1', {});
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/mapper/resetFields/${orgId}/${projectId}/ct-1`,
        {},
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getExistingContentTypes', () => {
    it('should call getCall with content type uid', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: [] });

      await getExistingContentTypes('proj-1', 'ct-1');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/mapper/proj-1/contentTypes/ct-1',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });

    it('should call getCall without content type uid when not provided', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: [] });

      await getExistingContentTypes('proj-1');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/mapper/proj-1/contentTypes/',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getExistingGlobalFields', () => {
    it('should call getCall with global field uid', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: [] });

      await getExistingGlobalFields('proj-1', 'gf-1');
      expect(mockGetCall).toHaveBeenCalledWith(
        'v2/mapper/proj-1/globalFields/gf-1',
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('removeContentMapper', () => {
    it('should call getCall for content-mapper endpoint', async () => {
      mockGetCall.mockResolvedValue({ status: 200 });

      await removeContentMapper(orgId, projectId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/mapper/${orgId}/${projectId}/content-mapper`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateContentMapper', () => {
    it('should call patchCall with content_mapper wrapped data', async () => {
      mockPatchCall.mockResolvedValue({ status: 200 });
      const data = { key: 'value' };

      await updateContentMapper(orgId, projectId, data);
      expect(mockPatchCall).toHaveBeenCalledWith(
        `v2/mapper/${orgId}/${projectId}/mapper_keys`,
        { content_mapper: data },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateStackDetails', () => {
    it('should call patchCall with stack_details wrapped data', async () => {
      mockPatchCall.mockResolvedValue({ status: 200 });
      const data = { locale: 'en-us' };

      await updateStackDetails(orgId, projectId, data);
      expect(mockPatchCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/stack-details`,
        { stack_details: data },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getOrgDetails', () => {
    it('should call getCall with org details endpoint', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: {} });

      await getOrgDetails(orgId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/get_org_details`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('createTestStack', () => {
    it('should call postCall with test stack data', async () => {
      mockPostCall.mockResolvedValue({ status: 201 });

      await createTestStack(orgId, projectId, { name: 'test-stack' });
      expect(mockPostCall).toHaveBeenCalledWith(
        `v2/migration/create-test-stack/${orgId}/${projectId}`,
        { name: 'test-stack' },
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('createTestMigration', () => {
    it('should call postCall with empty body', async () => {
      mockPostCall.mockResolvedValue({ status: 200 });

      await createTestMigration(orgId, projectId);
      expect(mockPostCall).toHaveBeenCalledWith(
        `v2/migration/test-stack/${orgId}/${projectId}`,
        {},
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('startMigration', () => {
    it('should call postCall with migration start endpoint', async () => {
      mockPostCall.mockResolvedValue({ status: 200 });

      await startMigration(orgId, projectId);
      expect(mockPostCall).toHaveBeenCalledWith(
        `v2/migration/start/${orgId}/${projectId}`,
        {},
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateMigrationKey', () => {
    it('should call putCall with migration-execution endpoint', async () => {
      mockPutCall.mockResolvedValue({ status: 200 });

      await updateMigrationKey(orgId, projectId);
      expect(mockPutCall).toHaveBeenCalledWith(
        `v2/org/${orgId}/project/${projectId}/migration-excution`,
        {},
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('updateLocaleMapper', () => {
    it('should call postCall with locale data', async () => {
      mockPostCall.mockResolvedValue({ status: 200 });
      const data = { locales: { 'en-us': 'en-us' } };

      await updateLocaleMapper(projectId, data);
      expect(mockPostCall).toHaveBeenCalledWith(
        `v2/migration/updateLocales/${projectId}`,
        data,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getExistingTaxonomies', () => {
    it('should call getCall with taxonomies endpoint', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: [] });

      await getExistingTaxonomies(projectId);
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/mapper/${projectId}/taxonomies`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });
  });

  describe('getMigrationLogs', () => {
    it('should call getCall with all parameters in the URL', async () => {
      mockGetCall.mockResolvedValue({ status: 200, data: { logs: [] } });

      await getMigrationLogs(orgId, projectId, 'stack-1', 0, 10, 0, 10, 'search', 'all');
      expect(mockGetCall).toHaveBeenCalledWith(
        `v2/migration/get_migration_logs/${orgId}/${projectId}/stack-1/0/10/0/10/search/all`,
        expect.objectContaining({ headers: { app_token: 'mock-app-token' } })
      );
    });

    it('should throw with formatted message on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('timeout'); });
      await expect(getMigrationLogs(orgId, projectId, 's', 0, 10, 0, 10, '', 'all'))
        .rejects.toThrow('Error in Getting Migration Logs: timeout');
    });

    it('should throw generic message on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw null; });
      await expect(getMigrationLogs(orgId, projectId, 's', 0, 10, 0, 10, '', 'all'))
        .rejects.toThrow('Unknown Error in Getting Migration Logs');
    });
  });

  describe('error handling for migration service functions', () => {
    it('updateLegacyCMSData should throw on Error', () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => updateLegacyCMSData(orgId, projectId, {})).toThrow('err');
    });

    it('updateLegacyCMSData should throw generic on non-Error', () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      expect(() => updateLegacyCMSData(orgId, projectId, {})).toThrow('Unknown error');
    });

    it('updateAffixData should throw on Error', () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => updateAffixData(orgId, projectId, {})).toThrow('err');
    });

    it('updateAffixData should throw generic on non-Error', () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      expect(() => updateAffixData(orgId, projectId, {})).toThrow('Unknown error');
    });

    it('updateFileFormatData should throw on Error', () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => updateFileFormatData(orgId, projectId, {})).toThrow('err');
    });

    it('updateFileFormatData should throw generic on non-Error', () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      expect(() => updateFileFormatData(orgId, projectId, {})).toThrow('Unknown error');
    });

    it('updateDestinationStack should throw on Error', () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => updateDestinationStack(orgId, projectId, {})).toThrow('err');
    });

    it('updateDestinationStack should throw generic on non-Error', () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      expect(() => updateDestinationStack(orgId, projectId, {})).toThrow('Unknown error');
    });

    it('updateCurrentStepData should throw on Error', () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => updateCurrentStepData(orgId, projectId, {})).toThrow('err');
    });

    it('updateCurrentStepData should throw generic on non-Error', () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      expect(() => updateCurrentStepData(orgId, projectId, {})).toThrow('Unknown error');
    });

    it('getMigrationData should throw on Error', () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => getMigrationData(orgId, projectId)).toThrow('Error in getting migrationData: err');
    });

    it('getMigrationData should throw generic on non-Error', () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      expect(() => getMigrationData(orgId, projectId)).toThrow('Unknown error in getting migrationData');
    });

    it('getContentTypes should throw on Error', () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      expect(() => getContentTypes('p', 0, 10, '')).toThrow('err');
    });

    it('getContentTypes should throw generic on non-Error', () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      expect(() => getContentTypes('p', 0, 10, '')).toThrow('Unknown error');
    });

    it('getFieldMapping should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getFieldMapping('ct', 0, 10, '', 'p')).rejects.toThrow('err');
    });

    it('getFieldMapping should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getFieldMapping('ct', 0, 10, '', 'p')).rejects.toThrow('Unknown error');
    });

    it('updateContentType should throw on Error', async () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      await expect(updateContentType(orgId, projectId, 'ct', {})).rejects.toThrow('err');
    });

    it('updateContentType should throw generic on non-Error', async () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      await expect(updateContentType(orgId, projectId, 'ct', {})).rejects.toThrow('Unknown error');
    });

    it('resetToInitialMapping should throw on Error', async () => {
      mockPutCall.mockImplementation(() => { throw new Error('err'); });
      await expect(resetToInitialMapping(orgId, projectId, 'ct', {})).rejects.toThrow('err');
    });

    it('resetToInitialMapping should throw generic on non-Error', async () => {
      mockPutCall.mockImplementation(() => { throw 0; });
      await expect(resetToInitialMapping(orgId, projectId, 'ct', {})).rejects.toThrow('Unknown error');
    });

    it('getExistingContentTypes should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getExistingContentTypes('p')).rejects.toThrow('err');
    });

    it('getExistingContentTypes should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getExistingContentTypes('p')).rejects.toThrow('Unknown error');
    });

    it('getExistingGlobalFields should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getExistingGlobalFields('p')).rejects.toThrow('err');
    });

    it('getExistingGlobalFields should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getExistingGlobalFields('p')).rejects.toThrow('Unknown error');
    });

    it('updateContentMapper should throw on Error', async () => {
      mockPatchCall.mockImplementation(() => { throw new Error('err'); });
      await expect(updateContentMapper(orgId, projectId, {})).rejects.toThrow('err');
    });

    it('updateContentMapper should throw generic on non-Error', async () => {
      mockPatchCall.mockImplementation(() => { throw 0; });
      await expect(updateContentMapper(orgId, projectId, {})).rejects.toThrow('Unknown error');
    });

    it('getExistingTaxonomies should throw on Error', async () => {
      mockGetCall.mockImplementation(() => { throw new Error('err'); });
      await expect(getExistingTaxonomies(projectId)).rejects.toThrow('err');
    });

    it('getExistingTaxonomies should throw generic on non-Error', async () => {
      mockGetCall.mockImplementation(() => { throw 0; });
      await expect(getExistingTaxonomies(projectId)).rejects.toThrow('Unknown error');
    });
  });
});
