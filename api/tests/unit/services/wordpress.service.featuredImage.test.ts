import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveFeaturedImageAsset,
  getAttachmentAltText
} from '../../../src/services/wordpress.service.js';

/**
 * Shapes below mirror the real WXR export from ticket 00062373 (PetHealthMD), as xml2js parses it
 * with `explicitArray: false`: post 18098 carries `_thumbnail_id` = 18113, and attachment 18113 is
 * the image. saveAsset registers that attachment as `assets_18113`.
 */
const postMeta = (key: string, value: string) => ({
  'wp:meta_key': key,
  'wp:meta_value': value
});

const post = (postmeta: any) => ({
  'wp:post_id': '18098',
  'wp:post_type': 'post',
  'wp:postmeta': postmeta
});

const downloadedAsset = {
  uid: 'assets_18113',
  filename: 'assets_18113.jpg',
  url: 'https://pethealthmd.com/wp-content/uploads/2025/11/retriever-and-snow-fall.jpg'
};

const assetData = { assets_18113: downloadedAsset };

describe('resolveFeaturedImageAsset', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('resolves _thumbnail_id to the downloaded asset', () => {
    const result = resolveFeaturedImageAsset(
      post([postMeta('_thumbnail_id', '18113')]),
      assetData
    );
    expect(result).toBe(downloadedAsset);
  });

  it('resolves when postmeta is a single object rather than an array', () => {
    const result = resolveFeaturedImageAsset(
      post(postMeta('_thumbnail_id', '18113')),
      assetData
    );
    expect(result).toBe(downloadedAsset);
  });

  it('picks _thumbnail_id out from among other postmeta keys', () => {
    const result = resolveFeaturedImageAsset(
      post([
        postMeta('_yoast_wpseo_title', 'Joint Pain & Mobility Support'),
        postMeta('_thumbnail_id', '18113'),
        postMeta('_yoast_wpseo_canonical', 'https://pethealthmd.com/cats/joint-pain/')
      ]),
      assetData
    );
    expect(result).toBe(downloadedAsset);
  });

  it('coerces a numeric _thumbnail_id to the asset key', () => {
    const result = resolveFeaturedImageAsset(
      post([{ 'wp:meta_key': '_thumbnail_id', 'wp:meta_value': 18113 }]),
      assetData
    );
    expect(result).toBe(downloadedAsset);
  });

  it('returns undefined when the post has no featured image', () => {
    expect(resolveFeaturedImageAsset(post([postMeta('_yoast_wpseo_title', 'x')]), assetData))
      .toBeUndefined();
  });

  it('returns undefined when the post has no postmeta at all', () => {
    expect(resolveFeaturedImageAsset({ 'wp:post_id': '18098' }, assetData)).toBeUndefined();
  });

  it('returns undefined when _thumbnail_id is empty', () => {
    expect(resolveFeaturedImageAsset(post([postMeta('_thumbnail_id', '')]), assetData))
      .toBeUndefined();
  });

  it('returns undefined and warns when the asset failed to download', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveFeaturedImageAsset(post([postMeta('_thumbnail_id', '99999')]), assetData))
      .toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('assets_99999'));
  });

  it('tolerates a missing assetData map', () => {
    expect(resolveFeaturedImageAsset(post([postMeta('_thumbnail_id', '18113')]), undefined))
      .toBeUndefined();
  });
});

describe('getAttachmentAltText', () => {
  it('reads _wp_attachment_image_alt off the attachment', () => {
    const alt = getAttachmentAltText({
      'wp:postmeta': [
        postMeta('_wp_attached_file', '2025/11/retriever-and-snow-fall.jpg'),
        postMeta('_wp_attachment_image_alt', 'A golden retriever in falling snow')
      ]
    });
    expect(alt).toBe('A golden retriever in falling snow');
  });

  it('returns an empty string when the alt meta is present but blank', () => {
    // This is the case in the ticket's own export — the alt value is an empty CDATA block.
    expect(getAttachmentAltText({
      'wp:postmeta': [postMeta('_wp_attachment_image_alt', '')]
    })).toBe('');
  });

  it('returns an empty string when there is no alt meta', () => {
    expect(getAttachmentAltText({
      'wp:postmeta': [postMeta('_wp_attached_file', 'x.jpg')]
    })).toBe('');
  });

  it('returns an empty string for an attachment with no postmeta', () => {
    expect(getAttachmentAltText({})).toBe('');
  });
});
