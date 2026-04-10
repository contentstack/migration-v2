import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDuplicateEntry } from '../../../src/utils/entry-duplicate.utils.js';

// Mock dependencies
vi.mock('../../../src/models/project-lowdb.js', () => {
  const mockChainGet = vi.fn();
  return {
    default: {
      read: vi.fn().mockResolvedValue(undefined),
      chain: {
        get: mockChainGet.mockReturnValue({
          find: vi.fn().mockReturnValue({
            value: vi.fn().mockReturnValue({ id: 'test-project', iteration: 1 })
          })
        })
      }
    }
  };
});

vi.mock('../../../src/models/EntryMapper.js', () => {
  const mockUpdate = vi.fn();
  const factory: any = vi.fn().mockImplementation(() => factory);
  factory.read = vi.fn().mockResolvedValue(undefined);
  factory.update = mockUpdate;
  return { default: factory };
});

describe('entry-duplicate.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDuplicateEntry', () => {
    it('should mark duplicate entries correctly', async () => {
      const mockEntryMapperData = {
        entry_mapper: [
          { contentTypeId: 'article', language: 'en', entryName: 'test-entry' },
          { contentTypeId: 'article', language: 'en', entryName: 'unique-entry' },
          { contentTypeId: 'article', language: 'en', entryName: 'test-entry' }, // duplicate
          { contentTypeId: 'page', language: 'en', entryName: 'test-entry' }, // different type, not duplicate
        ]
      };

      const { default: getEntryMapperDb } = await import('../../../src/models/EntryMapper.js');
      const mockEntryMapper = getEntryMapperDb('test-project', 1);
      
      // Mock the update function to simulate the duplicate marking logic
      (mockEntryMapper.update as ReturnType<typeof vi.fn>).mockImplementation(async (updateFn: any) => {
        updateFn(mockEntryMapperData);
      });

      await isDuplicateEntry('test-project');

      expect(mockEntryMapper.read).toHaveBeenCalled();
      expect(mockEntryMapper.update).toHaveBeenCalled();

      // Verify that duplicates were marked
      expect(mockEntryMapperData.entry_mapper[0].isDuplicateEntry).toBe(true);
      expect(mockEntryMapperData.entry_mapper[2].isDuplicateEntry).toBe(true);
      expect(mockEntryMapperData.entry_mapper[1].isDuplicateEntry).toBeUndefined();
      expect(mockEntryMapperData.entry_mapper[3].isDuplicateEntry).toBeUndefined();
    });

    it('should handle empty entry mapper data', async () => {
      const mockEntryMapperData = { entry_mapper: [] };

      const { default: getEntryMapperDb } = await import('../../../src/models/EntryMapper.js');
      const mockEntryMapper = getEntryMapperDb('test-project', 1);
      
      (mockEntryMapper.update as ReturnType<typeof vi.fn>).mockImplementation(async (updateFn: any) => {
        updateFn(mockEntryMapperData);
      });

      await expect(isDuplicateEntry('test-project')).resolves.toBeUndefined();
      expect(mockEntryMapper.update).toHaveBeenCalled();
    });

    it('should handle null entry mapper data', async () => {
      const mockEntryMapperData = { entry_mapper: null };

      const { default: getEntryMapperDb } = await import('../../../src/models/EntryMapper.js');
      const mockEntryMapper = getEntryMapperDb('test-project', 1);
      
      (mockEntryMapper.update as ReturnType<typeof vi.fn>).mockImplementation(async (updateFn: any) => {
        updateFn(mockEntryMapperData);
      });

      await expect(isDuplicateEntry('test-project')).resolves.toBeUndefined();
      expect(mockEntryMapper.update).toHaveBeenCalled();
    });
  });
});