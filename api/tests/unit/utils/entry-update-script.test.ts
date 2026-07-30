import { createRequire } from 'node:module';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The delta entry-update migration script (run by `cm:stacks:migration`). It is
// plain CommonJS executed by the CLI, so we load it with the real `require`
// rather than the vitest module system. The pure helpers are attached to the
// default function export for testing.
const require = createRequire(import.meta.url);
const script = require('../../../src/utils/entry-update-script.cjs');
const {
  isAssetField,
  resolveAssetField,
  mergeFlatPayloadIntoEntry,
  isReferenceValue,
  isReferenceArray,
  resolveReferenceUid,
  resolveReferenceField,
} = script;

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

describe('entry-update-script — isReferenceValue / isReferenceArray', () => {
  it('recognizes the { uid, _content_type_uid } shape produced by processField', () => {
    expect(isReferenceValue({ uid: 'src-1', _content_type_uid: 'author' })).toBe(true);
  });

  it('is false for asset shapes, primitives, and arrays', () => {
    expect(isReferenceValue({ urlPath: '/x', filename: 'f.jpg' })).toBe(false);
    expect(isReferenceValue(null)).toBeFalsy();
    expect(isReferenceValue('str')).toBeFalsy();
    expect(isReferenceValue([{ uid: 'a', _content_type_uid: 'b' }])).toBe(false);
    expect(isReferenceValue({ uid: 'src-1' })).toBe(false); // missing _content_type_uid
  });

  it('recognizes a non-empty array of reference values (multi-reference field)', () => {
    expect(isReferenceArray([{ uid: 'a', _content_type_uid: 'article' }, { uid: 'b', _content_type_uid: 'article' }])).toBe(true);
  });

  it('is false for an empty array or a mixed array', () => {
    expect(isReferenceArray([])).toBe(false);
    expect(isReferenceArray([{ uid: 'a', _content_type_uid: 'article' }, 'not-a-ref'])).toBe(false);
  });
});

describe('entry-update-script — resolveReferenceUid', () => {
  const locale = 'en-in';
  const entryMapping = {
    old: { flat: { 'src-1': 'cs-old-flat' }, byLocale: { 'en-in': { 'src-2': 'cs-old-locale' } } },
    new: { flat: { 'src-3': 'cs-new-flat' }, byLocale: { 'en-in': { 'src-1': 'cs-new-locale' } } },
  };

  it('prefers the new per-locale mapping over everything else', () => {
    expect(resolveReferenceUid('src-1', locale, entryMapping)).toBe('cs-new-locale');
  });

  it('falls back to the old per-locale mapping when no new per-locale entry exists', () => {
    expect(resolveReferenceUid('src-2', locale, entryMapping)).toBe('cs-old-locale');
  });

  it('falls back to the flat new mapping when no per-locale entry exists at all', () => {
    expect(resolveReferenceUid('src-3', locale, entryMapping)).toBe('cs-new-flat');
  });

  it('falls back to the flat old mapping as a last resort', () => {
    const mapping = { old: { flat: { 'src-4': 'cs-old-flat-only' }, byLocale: {} }, new: { flat: {}, byLocale: {} } };
    expect(resolveReferenceUid('src-4', locale, mapping)).toBe('cs-old-flat-only');
  });

  it('falls back to identity (source uid unchanged) when no mapping exists at all', () => {
    expect(resolveReferenceUid('unmapped-src', locale, { old: { flat: {}, byLocale: {} }, new: { flat: {}, byLocale: {} } })).toBe('unmapped-src');
  });

  it('handles a missing/undefined entryMapping gracefully', () => {
    expect(resolveReferenceUid('src-1', locale, undefined)).toBe('src-1');
  });
});

describe('entry-update-script — resolveReferenceField', () => {
  const locale = 'en-gb';
  const entryMapping = { old: { flat: {}, byLocale: {} }, new: { flat: {}, byLocale: { 'en-gb': { 'author-src': 'author-cs' } } } };

  it('remaps a single reference value uid', () => {
    const out = resolveReferenceField('author', 'e1', { uid: 'author-src', _content_type_uid: 'author' }, locale, entryMapping);
    expect(out).toEqual({ uid: 'author-cs', _content_type_uid: 'author' });
  });

  it('remaps every uid in a multi-reference array', () => {
    const mapping = { old: { flat: {}, byLocale: {} }, new: { flat: {}, byLocale: { 'en-gb': { a1: 'a1-cs', a2: 'a2-cs' } } } };
    const out = resolveReferenceField(
      'relatedArticles',
      'e1',
      [{ uid: 'a1', _content_type_uid: 'article' }, { uid: 'a2', _content_type_uid: 'article' }],
      locale,
      mapping
    );
    expect(out).toEqual([
      { uid: 'a1-cs', _content_type_uid: 'article' },
      { uid: 'a2-cs', _content_type_uid: 'article' },
    ]);
  });

  it('passes non-reference values through unchanged', () => {
    expect(resolveReferenceField('title', 'e1', 'plain string', locale, entryMapping)).toBe('plain string');
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

  it('resolves a reference field uid using entryMapping when localizing an existing entry (CMG delta bug)', async () => {
    // Reproduces the bug: an export's reference field carries the SOURCE cms
    // entry id (e.g. Contentful's id), which only equals the Contentstack uid
    // by coincidence. Without entryMapping this used to be written verbatim,
    // silently pointing at a non-existent uid on any locale added via restart.
    const update = vi.fn().mockResolvedValue(undefined);
    const entry: any = { title: 'old', content: {}, update };

    const updateData = {
      uid: 'should-be-skipped',
      title: 'Article 1',
      author: { uid: 'contentful-author-src-id', _content_type_uid: 'author' },
    };

    const entryMapping = {
      old: { flat: {}, byLocale: {} },
      new: { flat: {}, byLocale: { 'en-in': { 'contentful-author-src-id': 'real-cs-author-uid' } } },
    };

    await mergeFlatPayloadIntoEntry(entry, 'e1', updateData, {}, {}, undefined, 'en-in', entryMapping);

    expect(entry.content.author).toEqual({ uid: 'real-cs-author-uid', _content_type_uid: 'author' });
  });

  it('falls back to the source uid unchanged when no entryMapping is supplied (back-compat)', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const entry: any = { title: 'old', content: {}, update };
    const updateData = { author: { uid: 'src-id', _content_type_uid: 'author' } };

    await mergeFlatPayloadIntoEntry(entry, 'e1', updateData, {}, {}, undefined, 'en-in', undefined);

    expect(entry.content.author).toEqual({ uid: 'src-id', _content_type_uid: 'author' });
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
