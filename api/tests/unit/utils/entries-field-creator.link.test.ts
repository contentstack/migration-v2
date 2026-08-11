import { describe, it, expect } from 'vitest';

// Sitecore's General Link stores an `id` (the target item) and often also a `url` holding the raw
// item path (`/WinnDixie/Home/pharmacy/express-refill`). That path matches no entry in the
// destination stack — entries get `/${key}` — so preferring the stored url produced links that
// addressed nothing. On the WinnDixie package 104 of 104 internal links carrying a stored url
// disagreed with their target's url. These tests pin the resolution order that fixes it.

import {
  entriesFieldCreator,
  sitecoreItemUrl,
} from '../../../src/utils/entries-field-creator.utils.js';

const idCorrector = ({ id }: any) => `${id ?? ''}`.replace(/[-{}]/g, '').toLowerCase();

const TARGET = '{B685D263-F44F-459A-8385-01C325815DE3}';
const TARGET_UID = idCorrector({ id: TARGET });

const entriesData = [
  {
    template: 'generic left navigation content page',
    locale: {
      en: {
        [TARGET_UID]: { meta: { name: 'express-refill', key: 'express-refill' }, fields: {} },
      },
    },
  },
];

const link = (attrs: string) =>
  entriesFieldCreator({
    field: { contentstackFieldType: 'link' },
    content: `<link ${attrs} />`,
    idCorrector,
    allAssetJSON: {},
    contentTypes: [],
    entriesData,
    locale: 'en',
  });

describe('sitecoreItemUrl', () => {
  it('is the single definition of an item url', () => {
    expect(sitecoreItemUrl('express-refill')).toBe('/express-refill');
    expect(sitecoreItemUrl('')).toBe('');
    expect(sitecoreItemUrl(undefined)).toBe('');
  });
});

describe("entriesFieldCreator link href", () => {
  it('addresses the target entry url, not the raw Sitecore path in url=""', async () => {
    const result: any = await link(
      `linktype="internal" id="${TARGET}" url="/WinnDixie/Home/pharmacy/express-refill" text="" title=""`
    );
    expect(result.href).toBe('/express-refill');
  });

  it('resolves an id-only internal link to the target entry url', async () => {
    const result: any = await link(`linktype="internal" id="${TARGET}" text="" title=""`);
    expect(result.href).toBe('/express-refill');
  });

  it('keeps the stored url when the target is not part of the migration', async () => {
    // 29 links in the package point at GUIDs absent from the export. Inventing a path for those
    // would be worse than preserving what Sitecore recorded.
    const result: any = await link(
      `linktype="internal" id="{00000000-0000-0000-0000-000000000000}" url="/WinnDixie/Home/about/help-center"`
    );
    expect(result.href).toBe('/WinnDixie/Home/about/help-center');
  });

  it('leaves an absolute external url untouched', async () => {
    const result: any = await link(
      `linktype="external" url="https://shop.winndixie.com" text="Shop online"`
    );
    expect(result.href).toBe('https://shop.winndixie.com');
    expect(result.title).toBe('Shop online');
  });

  it('leaves a javascript link untouched', async () => {
    const result: any = await link(`linktype="javascript" url="javascript:void(0);"`);
    expect(result.href).toBe('javascript:void(0);');
  });

  it('falls back to a slug of the title when there is no id and no url', async () => {
    const result: any = await link(`linktype="internal" text="Some Label"`);
    expect(result.href).toBe('/some-label');
  });

  it('prefers the authored label over the target name for the title', async () => {
    const result: any = await link(
      `linktype="internal" id="${TARGET}" text="Refill from prescription"`
    );
    expect(result.title).toBe('Refill from prescription');
    expect(result.href).toBe('/express-refill');
  });

  it('falls back to the target name when no label is authored', async () => {
    const result: any = await link(`linktype="internal" id="${TARGET}" text="" title=""`);
    expect(result.title).toBe('express-refill');
  });
});
