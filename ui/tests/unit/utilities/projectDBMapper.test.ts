import { describe, it, expect } from 'vitest';
import { createObject } from '../../../src/utilities/projectDBMapper';
import { createMockProject } from '../../fixtures/user.fixture';

describe('utilities/projectDBMapper', () => {
  describe('createObject', () => {
    it('should map project data to the correct structure', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      expect(result).toHaveProperty('legacy_cms');
      expect(result).toHaveProperty('destination_stack');
      expect(result).toHaveProperty('content_mapping');
      expect(result).toHaveProperty('stackDetails');
      expect(result).toHaveProperty('mapperKeys');
    });

    it('should correctly map legacy_cms fields', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      expect(result.legacy_cms.selectedCms.cms_id).toBe('wordpress');
      expect(result.legacy_cms.selectedCms.allowed_file_formats).toEqual(['json']);
      expect(result.legacy_cms.affix).toBe('cs');
      expect(result.legacy_cms.file_format).toBe('json');
    });

    it('should correctly map uploadedFile details', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      expect(result.legacy_cms.uploadedFile.file_details.localPath).toBe('/path/to/file');
      expect(result.legacy_cms.uploadedFile.file_details.isLocalPath).toBe(true);
      expect(result.legacy_cms.uploadedFile.isValidated).toBe(true);
    });

    it('should correctly map AWS details', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      const awsData = result.legacy_cms.uploadedFile.file_details.awsData;
      expect(awsData.awsRegion).toBe('us-east-1');
      expect(awsData.bucketName).toBe('test-bucket');
      expect(awsData.bucketKey).toBe('test-key');
    });

    it('should correctly map destination_stack fields', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      expect(result.destination_stack.selectedOrg.value).toBe('org-123');
      expect(result.destination_stack.selectedOrg.label).toBe('Test Org');
      expect(result.destination_stack.selectedStack.value).toBe('stack-123');
      expect(result.destination_stack.selectedStack.label).toBe('Test Stack');
      expect(result.destination_stack.selectedStack.master_locale).toBe('en-us');
    });

    it('should correctly map stackArray', () => {
      const projectData = createMockProject();
      const result = createObject(projectData);

      expect(result.destination_stack.stackArray.value).toBe('stack-123');
      expect(result.destination_stack.stackArray.created_at).toBe('2024-01-01');
    });

    it('should handle missing/undefined project data gracefully', () => {
      const result = createObject({});

      expect(result.legacy_cms.selectedCms.cms_id).toBeUndefined();
      expect(result.legacy_cms.affix).toBeUndefined();
      expect(result.destination_stack.selectedOrg.value).toBeUndefined();
      expect(result.content_mapping).toBeUndefined();
    });

    it('should pass through content_mapping and mapperKeys directly', () => {
      const projectData = createMockProject({
        content_mapping: { ct1: 'mapped1' },
        mapperKeys: { key1: 'val1' }
      });
      const result = createObject(projectData);

      expect(result.content_mapping).toEqual({ ct1: 'mapped1' });
      expect(result.mapperKeys).toEqual({ key1: 'val1' });
    });
  });
});
