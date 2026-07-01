import { describe, it, expect } from 'vitest';
import {
  mapEntriesToRows,
  buildSelectedEntryRowIds,
  applySelectionToEntries,
  selectableInitialRows,
  filterContentTypesByStatus,
  applyContentTypeStatus,
} from '../entryMapper.utils';
import { ContentType, EntryMapperType } from '../contentMapper.interface';

const entry = (over: Partial<EntryMapperType>): EntryMapperType => ({
  id: 'e1',
  projectId: 'p1',
  contentTypeId: 'ct1',
  contentTypeUid: 'ct_1',
  entryName: 'Entry 1',
  otherCmsEntryUid: 'e1',
  isUpdate: false,
  ...over,
});

const ct = (over: Partial<ContentType>): ContentType => ({
  contentstackTitle: 'T',
  contentstackUid: 'ct_1',
  isUpdated: false,
  otherCmsTitle: 'OT',
  otherCmsUid: 'oct_1',
  updateAt: '',
  id: 'ct1',
  status: '1',
  type: 'content_type',
  ...over,
});

describe('entryMapper.utils — mapEntriesToRows', () => {
  it('marks rows selectable only when a Contentstack entry uid exists', () => {
    const rows = mapEntriesToRows([
      entry({ id: 'e1', contentstackEntryUid: 'cs-1' }),
      entry({ id: 'e2', contentstackEntryUid: undefined }),
    ]);
    expect(rows.map((r) => [r.id, r._canSelect])).toEqual([
      ['e1', true],
      ['e2', false],
    ]);
  });

  it('returns [] for undefined input', () => {
    expect(mapEntriesToRows(undefined)).toEqual([]);
  });
});

describe('entryMapper.utils — buildSelectedEntryRowIds', () => {
  it('includes only rows that are selectable AND already isUpdate', () => {
    expect(
      buildSelectedEntryRowIds([
        entry({ id: 'e1', _canSelect: true, isUpdate: true }),
        entry({ id: 'e2', _canSelect: true, isUpdate: false }),
        entry({ id: 'e3', _canSelect: false, isUpdate: true }),
      ]),
    ).toEqual({ e1: true });
  });

  it('returns {} for undefined input', () => {
    expect(buildSelectedEntryRowIds(undefined)).toEqual({});
  });
});

describe('entryMapper.utils — applySelectionToEntries', () => {
  it('sets isUpdate per the selection for selectable rows; non-selectable untouched', () => {
    const out = applySelectionToEntries(
      [
        entry({ id: 'e1', _canSelect: true, isUpdate: false }),
        entry({ id: 'e2', _canSelect: true, isUpdate: true }),
        entry({ id: 'e3', _canSelect: false, isUpdate: true }),
      ],
      { e1: true },
    );
    expect(out.map((r) => [r.id, r.isUpdate])).toEqual([
      ['e1', true],
      ['e2', false],
      ['e3', true],
    ]);
  });

  it('returns [] for undefined input', () => {
    expect(applySelectionToEntries(undefined, {})).toEqual([]);
  });
});

describe('entryMapper.utils — selectableInitialRows', () => {
  it('keeps only rows that are not yet isUpdate', () => {
    const rows = selectableInitialRows([
      entry({ id: 'e1', isUpdate: false }),
      entry({ id: 'e2', isUpdate: true }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['e1']);
  });

  it('returns [] for undefined input', () => {
    expect(selectableInitialRows(undefined)).toEqual([]);
  });
});

describe('entryMapper.utils — filterContentTypesByStatus', () => {
  // CONTENT_MAPPING_STATUS: '1'->Mapped, '2'->Updated, '3'->Failed, '4'->All
  it("filters by the status label (e.g. 'Updated' → status '2')", () => {
    const list = [
      ct({ id: 'a', status: '1' }), // Mapped
      ct({ id: 'b', status: '2' }), // Updated
      ct({ id: 'c', status: '2' }), // Updated
    ];
    expect(filterContentTypesByStatus(list, 'Updated').map((c) => c.id)).toEqual(['b', 'c']);
    expect(filterContentTypesByStatus(list, 'Mapped').map((c) => c.id)).toEqual(['a']);
    expect(filterContentTypesByStatus(list, 'Failed')).toEqual([]);
  });

  it('returns [] for undefined input', () => {
    expect(filterContentTypesByStatus(undefined, 'Updated')).toEqual([]);
  });
});

describe('entryMapper.utils — applyContentTypeStatus', () => {
  it("sets the target content type to '2' when it has a selection, others untouched", () => {
    const list = [ct({ id: 'a', status: '1' }), ct({ id: 'b', status: '1' })];
    const out = applyContentTypeStatus(list, 'a', true);
    expect(out.map((c) => [c.id, c.status])).toEqual([
      ['a', '2'],
      ['b', '1'],
    ]);
  });

  it("sets the target content type back to '1' when it has no selection", () => {
    const list = [ct({ id: 'a', status: '2' })];
    expect(applyContentTypeStatus(list, 'a', false)[0].status).toBe('1');
  });

  it('returns [] for undefined input', () => {
    expect(applyContentTypeStatus(undefined, 'a', true)).toEqual([]);
  });
});
