import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeEntriesFromDatabase } from '../../../src/utils/entry-update.utils.js';

// Mock console methods to avoid noise in tests
const mockConsole = {
  info: vi.fn(),
  log: vi.fn(),
  error: vi.fn()
};
vi.stubGlobal('console', mockConsole);

// Mock constants
vi.mock('../../../src/constants/index.js', () => ({
  MIGRATION_DATA_CONFIG: {
    DATA: 'migration-data',
    ENTRIES_DIR_NAME: 'entries'
  }
}));

describe('entry-update.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('removeEntriesFromDatabase', () => {
    it('should return null when no entry mapper items found', async () => {
      // Mock project model
      vi.doMock('../../../src/models/project-lowdb.js', () => ({
        default: {
          read: vi.fn().mockResolvedValue(undefined),
          chain: {
            get: vi.fn().mockReturnValue({
              find: vi.fn().mockReturnValue({
                value: vi.fn().mockReturnValue({ 
                  id: 'test-project', 
                  iteration: 1, 
                  destination_stack_id: 'test-stack-id' 
                })
              })
            })
          }
        }
      }));

      // Mock entry mapper with empty data
      vi.doMock('../../../src/models/EntryMapper.js', () => {
        const factory: any = vi.fn().mockImplementation(() => factory);
        factory.read = vi.fn().mockResolvedValue(undefined);
        factory.chain = {
          get: vi.fn().mockReturnValue({
            value: vi.fn().mockReturnValue([]) // Empty array
          })
        };
        return { default: factory };
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('test-project');

      expect(result).toBeNull();
      expect(mockConsole.info).toHaveBeenCalledWith('No entry mapper items found or stackId missing, skipping removal.');
    });

    it('should return null when stackId is missing', async () => {
      // Mock project model without stackId
      vi.doMock('../../../src/models/project-lowdb.js', () => ({
        default: {
          read: vi.fn().mockResolvedValue(undefined),
          chain: {
            get: vi.fn().mockReturnValue({
              find: vi.fn().mockReturnValue({
                value: vi.fn().mockReturnValue({ 
                  id: 'test-project', 
                  iteration: 1, 
                  destination_stack_id: null // No stackId
                })
              })
            })
          }
        }
      }));

      // Mock entry mapper with data
      vi.doMock('../../../src/models/EntryMapper.js', () => {
        const factory: any = vi.fn().mockImplementation(() => factory);
        factory.read = vi.fn().mockResolvedValue(undefined);
        factory.chain = {
          get: vi.fn().mockReturnValue({
            value: vi.fn().mockReturnValue([
              { otherCmsEntryUid: 'entry-1', isUpdate: true }
            ])
          })
        };
        return { default: factory };
      });

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('test-project');

      expect(result).toBeNull();
      expect(mockConsole.info).toHaveBeenCalledWith('No entry mapper items found or stackId missing, skipping removal.');
    });

    it('should handle basic function execution path', async () => {
      // Mock project model
      vi.doMock('../../../src/models/project-lowdb.js', () => ({
        default: {
          read: vi.fn().mockResolvedValue(undefined),
          chain: {
            get: vi.fn().mockReturnValue({
              find: vi.fn().mockReturnValue({
                value: vi.fn().mockReturnValue({ 
                  id: 'test-project', 
                  iteration: 1, 
                  destination_stack_id: 'test-stack-id' 
                })
              })
            })
          }
        }
      }));

      // Mock entry mapper with data
      vi.doMock('../../../src/models/EntryMapper.js', () => {
        const factory: any = vi.fn().mockImplementation(() => factory);
        factory.read = vi.fn().mockResolvedValue(undefined);
        factory.chain = {
          get: vi.fn().mockReturnValue({
            value: vi.fn().mockReturnValue([
              {
                otherCmsEntryUid: 'entry-1',
                contentstackEntryUid: 'cs-entry-1',
                isUpdate: true,
                contentTypeId: 'article'
              }
            ])
          })
        };
        return { default: factory };
      });

      // Mock fs
      vi.doMock('node:fs', () => ({
        default: {
          existsSync: vi.fn().mockReturnValue(false), // Directory doesn't exist
          mkdirSync: vi.fn(),
          readdirSync: vi.fn(),
          readFileSync: vi.fn(),
          writeFileSync: vi.fn()
        }
      }));

      const { removeEntriesFromDatabase } = await import('../../../src/utils/entry-update.utils.js');
      const result = await removeEntriesFromDatabase('test-project');

      // Should return null because directory doesn't exist
      expect(result).toBeNull();
    });
  });
});