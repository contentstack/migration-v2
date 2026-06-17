import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  mapAssetsToRows,
  buildSelectedRowIds,
  applySelectionToAssets,
  toSelectedMap,
  computeChangedUids,
} from '../assetMapper.utils';
import { AssetMapperType } from '../contentMapper.interface';

// Minimal AssetMapperType factory for the pure-logic tests.
const asset = (over: Partial<AssetMapperType>): AssetMapperType => ({
  id: 'a1',
  projectId: 'p1',
  otherCmsAssetUid: 'a1',
  filename: 'f.jpg',
  title: 'F',
  file_size: 100,
  assetPath: '/f.jpg',
  isUpdate: false,
  ...over,
});

describe('assetMapper.utils — formatFileSize', () => {
  it("returns '-' for missing / non-positive / non-numeric sizes", () => {
    expect(formatFileSize(undefined)).toBe('-');
    expect(formatFileSize(0)).toBe('-');
    expect(formatFileSize(-5)).toBe('-');
    expect(formatFileSize('abc')).toBe('-');
  });

  it('formats bytes, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize('512')).toBe('512 B'); // numeric strings accepted
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('assetMapper.utils — mapAssetsToRows', () => {
  it('marks rows selectable only when a Contentstack asset uid exists', () => {
    const rows = mapAssetsToRows([
      asset({ id: 'a1', contentstackAssetUid: 'cs-1' }),
      asset({ id: 'a2', contentstackAssetUid: undefined }),
    ]);
    expect(rows.map((r) => [r.id, r._canSelect])).toEqual([
      ['a1', true],
      ['a2', false],
    ]);
  });

  it('returns [] for undefined input', () => {
    expect(mapAssetsToRows(undefined)).toEqual([]);
  });
});

describe('assetMapper.utils — buildSelectedRowIds', () => {
  it('includes only rows that are selectable AND already isUpdate', () => {
    const result = buildSelectedRowIds([
      asset({ id: 'a1', _canSelect: true, isUpdate: true }),
      asset({ id: 'a2', _canSelect: true, isUpdate: false }), // not checked
      asset({ id: 'a3', _canSelect: false, isUpdate: true }), // not selectable
    ]);
    expect(result).toEqual({ a1: true });
  });

  it('returns {} for undefined input', () => {
    expect(buildSelectedRowIds(undefined)).toEqual({});
  });
});

describe('assetMapper.utils — applySelectionToAssets', () => {
  it('sets isUpdate per the selection for selectable rows and leaves others untouched', () => {
    const out = applySelectionToAssets(
      [
        asset({ id: 'a1', _canSelect: true, isUpdate: false }),
        asset({ id: 'a2', _canSelect: true, isUpdate: true }),
        asset({ id: 'a3', _canSelect: false, isUpdate: true }),
      ],
      { a1: true }, // only a1 selected
    );
    expect(out.map((r) => [r.id, r.isUpdate])).toEqual([
      ['a1', true],
      ['a2', false], // deselected
      ['a3', true], // non-selectable: unchanged
    ]);
  });

  it('returns [] for undefined input', () => {
    expect(applySelectionToAssets(undefined, {})).toEqual([]);
  });
});

describe('assetMapper.utils — toSelectedMap', () => {
  it('turns a selected-id array into a { id: true } map', () => {
    expect(toSelectedMap(['a1', 'a2'])).toEqual({ a1: true, a2: true });
  });

  it('returns {} for undefined input', () => {
    expect(toSelectedMap(undefined)).toEqual({});
  });
});

describe('assetMapper.utils — computeChangedUids', () => {
  it('returns only uids whose selected state flipped vs the persisted map', () => {
    const changed = computeChangedUids(
      { a1: true, a2: true, a3: false },
      { a1: true, a2: false }, // a2 newly checked, a3 absent (false) → no change
    );
    expect(changed.sort()).toEqual(['a2']);
  });

  it('detects a newly-unchecked uid', () => {
    expect(computeChangedUids({ a1: false }, { a1: true })).toEqual(['a1']);
  });

  it('returns [] when nothing changed', () => {
    expect(computeChangedUids({ a1: true }, { a1: true })).toEqual([]);
    expect(computeChangedUids(undefined, undefined)).toEqual([]);
  });
});
