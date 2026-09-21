import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const writeFileAsync = vi.fn();

vi.mock('../../../migration-wordpress/utils/parseUtil', () => ({
  setupWordPressBlocks: vi.fn(async () => []),
}));

vi.mock('../../../migration-wordpress/utils/helper', () => ({
  default: {
    writeFileAsync: (...args: any[]) => writeFileAsync(...args),
  },
}));

vi.mock('mkdirp', () => ({ default: vi.fn() }));

import fs from 'fs';
import os from 'os';
import path from 'path';

import extractItems from '../../../migration-wordpress/libs/extractItems';

/**
 * extractItems re-reads the source XML off disk to pull each item's body, so point it at a real
 * file. Only the body lookup uses it; the featured-image check reads the parsed item objects.
 */
const xmlFixture = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
<item>
<title>Joint Pain &amp; Mobility Support in Colder Weather</title>
<content:encoded><![CDATA[<p class="wp-block-paragraph">When temperatures start to fall.</p>]]></content:encoded>
<wp:post_id>18098</wp:post_id>
<wp:post_type><![CDATA[post]]></wp:post_type>
</item>
</channel>
</rss>`;

let localPath: string;

beforeAll(() => {
  localPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wp-featured-')), 'export.xml');
  fs.writeFileSync(localPath, xmlFixture, 'utf8');
});

const postMeta = (key: string, value: string) => ({
  'wp:meta_key': key,
  'wp:meta_value': value,
});

/** Mirrors the shape xml2js produces for a WXR item (explicitArray: false). */
const makeItem = (overrides: Record<string, any> = {}) => ({
  title: 'Joint Pain & Mobility Support in Colder Weather',
  'content:encoded': '<p class="wp-block-paragraph">When temperatures start to fall.</p>',
  'wp:post_id': '18098',
  'wp:post_type': 'post',
  ...overrides,
});

const writtenFieldMapping = () => {
  const payload = JSON.parse(writeFileAsync.mock.calls.at(-1)?.[1]);
  return payload.fieldMapping;
};

const run = (items: any[]) =>
  extractItems(items, { localPath } as any, 'post', '', [], []);

describe('extractItems — featured image', () => {
  beforeEach(() => {
    writeFileAsync.mockClear();
  });

  it('adds a featured_image file field when an item declares _thumbnail_id', async () => {
    await run([makeItem({ 'wp:postmeta': [postMeta('_thumbnail_id', '18113')] })]);

    const featured = writtenFieldMapping().find((f: any) => f.uid === 'featured_image');
    expect(featured).toBeDefined();
    expect(featured.contentstackFieldType).toBe('file');
    expect(featured.contentstackFieldUid).toBe('featured_image');
    expect(featured.contentstackField).toBe('Featured Image');
    expect(featured.otherCmsField).toBe('_thumbnail_id');
    expect(featured.advanced?.mandatory).toBe(false);
  });

  it('handles a single (non-array) postmeta, as xml2js emits for one entry', async () => {
    await run([makeItem({ 'wp:postmeta': postMeta('_thumbnail_id', '18113') })]);

    expect(writtenFieldMapping().some((f: any) => f.uid === 'featured_image')).toBe(true);
  });

  it('adds the field once when only some items have a featured image', async () => {
    await run([
      makeItem({ 'wp:post_id': '1', 'wp:postmeta': [postMeta('_yoast_wpseo_title', 'x')] }),
      makeItem({ 'wp:post_id': '2', 'wp:postmeta': [postMeta('_thumbnail_id', '18113')] }),
    ]);

    const featured = writtenFieldMapping().filter((f: any) => f.uid === 'featured_image');
    expect(featured).toHaveLength(1);
  });

  it('does not add the field when no item declares a featured image', async () => {
    await run([makeItem({ 'wp:postmeta': [postMeta('_yoast_wpseo_title', 'x')] })]);

    expect(writtenFieldMapping().some((f: any) => f.uid === 'featured_image')).toBe(false);
  });

  it('does not add the field when _thumbnail_id is present but empty', async () => {
    await run([makeItem({ 'wp:postmeta': [postMeta('_thumbnail_id', '')] })]);

    expect(writtenFieldMapping().some((f: any) => f.uid === 'featured_image')).toBe(false);
  });

  it('leaves items with no postmeta at all untouched', async () => {
    await run([makeItem()]);

    const mapping = writtenFieldMapping();
    expect(mapping.some((f: any) => f.uid === 'featured_image')).toBe(false);
    // the pre-existing fields are still emitted
    expect(mapping.some((f: any) => f.uid === 'title')).toBe(true);
    expect(mapping.some((f: any) => f.uid === 'modular_blocks')).toBe(true);
  });
});
