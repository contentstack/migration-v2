import { createRequire } from 'node:module';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The delta entry-update migration script (run by `cm:stacks:migration`). It is
// plain CommonJS executed by the CLI, so we load it with the real `require`
// rather than the vitest module system. The pure helpers are attached to the
// default function export for testing.
const require = createRequire(import.meta.url);
const script = require('../../../src/utils/entry-update-script.cjs');
const { isAssetField, resolveAssetField, mergeFlatPayloadIntoEntry } = script;

describe('entry-update-script — isAssetField', () => {
  it('is true only for objects carrying urlPath + filename', () => {
    expect(isAssetField({ urlPath: '/x', filename: 'f.jpg' })).toBe(true);
  });

  it('is false for non-asset shapes', () => {
    expect(isAssetField(null)).toBeFalsy();
    expect(isAssetField('str')).toBeFalsy();
    expect(isAssetField(['/x'])).toBe(false);
    expect(isAssetField({ urlPath: '/x' })).toBeFalsy(); // missing filename
    expect(isAssetField({ filename: 'f' })).toBeFalsy(); // missing urlPath
  });
});

describe('entry-update-script — resolveAssetField (3-way resolution)', () => {
  const field = 'pic';
  const uid = 'e1';

  it('returns stackValue/updateValue when the update has no source uid', () => {
    const stackValue = { uid: 'cs-stack' };
    expect(resolveAssetField(field, uid, { filename: 'f' }, stackValue, {}, {})).toBe(stackValue);
    expect(resolveAssetField(field, uid, { filename: 'f' }, undefined, {}, {})).toEqual({ filename: 'f' });
  });

  it('prefers a newly-imported asset (newMapping wins), merging onto the stack object', () => {
    const out = resolveAssetField(field, uid, { uid: 'src-1' }, { uid: 'cs-old', title: 'keep' }, {}, { 'src-1': 'cs-new' });
    expect(out).toEqual({ uid: 'cs-new', title: 'keep' });
  });

  it('newMapping with no stack object yields just the new uid', () => {
    const out = resolveAssetField(field, uid, { uid: 'src-1' }, undefined, {}, { 'src-1': 'cs-new' });
    expect(out).toEqual({ uid: 'cs-new' });
  });

  it('keeps a user-modified stack asset over the old mapping', () => {
    const stackValue = { uid: 'cs-user-changed' };
    const out = resolveAssetField(field, uid, { uid: 'src-1' }, stackValue, { 'src-1': 'cs-old' }, {});
    expect(out).toBe(stackValue);
  });

  it('keeps the original mapped asset when the stack still matches', () => {
    const stackValue = { uid: 'cs-old' };
    const out = resolveAssetField(field, uid, { uid: 'src-1' }, stackValue, { 'src-1': 'cs-old' }, {});
    expect(out).toBe(stackValue);
  });

  it('falls back to updateValue+oldUid when old mapping exists but no stack object', () => {
    const out = resolveAssetField(field, uid, { uid: 'src-1', filename: 'f' }, null, { 'src-1': 'cs-old' }, {});
    expect(out).toEqual({ uid: 'cs-old', filename: 'f' });
  });

  it('keeps the stack asset when there is no mapping at all', () => {
    const stackValue = { uid: 'cs-stack' };
    expect(resolveAssetField(field, uid, { uid: 'src-1' }, stackValue, {}, {})).toBe(stackValue);
  });
});

describe('entry-update-script — mergeFlatPayloadIntoEntry', () => {
  it('merges flat fields into entry.content, resolves assets, and skips reserved keys', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const entry: any = { title: 'old', content: {}, update };

    const updateData = {
      uid: 'should-be-skipped',
      _version: 9,
      title: 'new title',
      body: 'hello',
      pic: { urlPath: '/p', filename: 'p.jpg', uid: 'src-1' },
    };

    await mergeFlatPayloadIntoEntry(entry, 'e1', updateData, {}, { 'src-1': 'cs-new' });

    expect(entry.title).toBe('new title');
    expect(entry.content.body).toBe('hello');
    expect(entry.content.pic).toEqual({ uid: 'cs-new' }); // asset resolved via newMapping
    expect(entry.content.uid).toBeUndefined(); // reserved key skipped
    expect(entry.content._version).toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('entry-update-script — main task runner', () => {
  let tasks: Array<{ title: string; task: () => Promise<void> }>;
  let migration: { addTask: (t: any) => void };

  beforeEach(() => {
    tasks = [];
    migration = { addTask: (t: any) => tasks.push(t) };
  });

  it('registers an asset-replace task and an entry-update task, and runs them', async () => {
    const replace = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const fakeEntry = { content: { body: 'old' }, update };
    const fetch = vi.fn().mockResolvedValue(fakeEntry);
    const entry = vi.fn(() => ({ fetch }));
    const contentType = vi.fn(() => ({ entry }));
    const asset = vi.fn(() => ({ replace }));
    const stackSDKInstance = { contentType, asset };

    const config = {
      __assetUpdates__: [{ uid: 'cs-a', filePath: '/f/a1/p.jpg', filename: 'p.jpg', title: 'P' }],
      __assetMapping__: { old: {}, new: {} },
      page: { 'cs-1': { content: { body: 'new' } } },
    };

    await script({ migration, config, stackSDKInstance });

    // asset-update task is added (because __assetUpdates__ is non-empty), then entries
    expect(tasks).toHaveLength(2);

    await tasks[0].task();
    expect(asset).toHaveBeenCalledWith('cs-a');
    expect(replace).toHaveBeenCalledWith({ upload: '/f/a1/p.jpg', title: 'P' });

    await tasks[1].task();
    expect(contentType).toHaveBeenCalledWith('page');
    expect(entry).toHaveBeenCalledWith('cs-1');
    expect(fetch).toHaveBeenCalled();
    expect(fakeEntry.content.body).toBe('new'); // nested content merged
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('registers only the entry-update task when there are no asset updates', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue({ content: {}, update });
    const stackSDKInstance = {
      contentType: vi.fn(() => ({ entry: vi.fn(() => ({ fetch })) })),
      asset: vi.fn(),
    };
    const config = { page: { 'cs-1': { content: { x: 1 } } } };

    await script({ migration, config, stackSDKInstance });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Update Entries');
  });
});
