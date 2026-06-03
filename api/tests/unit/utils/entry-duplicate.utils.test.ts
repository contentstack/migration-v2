import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProjectRead = vi.fn();
const mockChainGet = vi.fn();
const mockEntryRead = vi.fn();
const mockEntryUpdate = vi.fn();

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: { get: mockChainGet },
  },
}));

vi.mock('../../../src/models/EntryMapper.js', () => ({
  default: vi.fn(() => ({
    read: mockEntryRead,
    update: mockEntryUpdate,
  })),
}));

describe('entry-duplicate.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockChainGet.mockReturnValue({
      find: vi.fn().mockReturnValue({
        value: vi.fn().mockReturnValue({ id: 'p1', iteration: 2 }),
      }),
    });
    mockEntryRead.mockResolvedValue(undefined);
  });

  it('marks duplicate entries sharing contentTypeId, language, and entryName', async () => {
    const rows = [
      { contentTypeId: 'ct', language: 'en', entryName: 'e1', isDuplicateEntry: false },
      { contentTypeId: 'ct', language: 'en', entryName: 'e1', isDuplicateEntry: false },
    ];
    mockEntryUpdate.mockImplementation(async (fn: (d: { entry_mapper: typeof rows }) => void) => {
      fn({ entry_mapper: rows });
    });

    const { isDuplicateEntry } = await import('../../../src/utils/entry-duplicate.utils.js');
    await isDuplicateEntry('p1');

    expect(rows[0].isDuplicateEntry).toBe(true);
    expect(rows[1].isDuplicateEntry).toBe(true);
  });

  it('leaves unique entries unchanged', async () => {
    const rows = [
      { contentTypeId: 'ct', language: 'en', entryName: 'a', isDuplicateEntry: false },
      { contentTypeId: 'ct', language: 'en', entryName: 'b', isDuplicateEntry: false },
    ];
    mockEntryUpdate.mockImplementation(async (fn: (d: { entry_mapper: typeof rows }) => void) => {
      fn({ entry_mapper: rows });
    });

    const { isDuplicateEntry } = await import('../../../src/utils/entry-duplicate.utils.js');
    await isDuplicateEntry('p1');

    expect(rows.every((r) => !r.isDuplicateEntry)).toBe(true);
  });
});
