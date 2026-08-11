import { describe, it, expect } from 'vitest';

// migration-sitecore is CommonJS and consumed via require() everywhere else in the
// pipeline; the tests load it the same way so they exercise the real module shape.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  parseLayoutXml,
  parseRenderingParams,
  resolveDatasourceTemplates,
  selectBlocks,
  buildRenderingBlockMapping,
  describeRenderingResolution,
} = require('../../../migration-sitecore/libs/observedRenderings.js');

// The layout field is escaped twice on disk: once as XML inside XML, once by the
// exporter. Build that shape so the tests read the real bytes.
const doubleEscape = (xml: string) =>
  xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;/g, '&amp;lt;')
    .replace(/&gt;/g, '&amp;gt;');

const layout = (inner: string) =>
  doubleEscape(`<r><d id="{DEV}">${inner}</d></r>`);

describe('observedRenderings', () => {
  describe('parseLayoutXml', () => {
    it('parses placements out of doubly-escaped layout XML', () => {
      const out = parseLayoutXml(
        layout(
          `<r uid="{U1}" s:id="{R1}" s:ds="{DS1}" s:ph="MainContent" s:par="CSSStyles" />`
        )
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        uid: '{U1}',
        renderingId: '{R1}',
        datasource: '{DS1}',
        placeholder: 'MainContent',
        params: { CSSStyles: '' },
      });
    });

    // The real package holds 8,388 of these. Admitting them would emit that many junk
    // blocks, so this is the single most important guard in the module.
    it('skips <r> nodes with no s:id (personalization / override stubs)', () => {
      const out = parseLayoutXml(
        layout(`<r uid="{U0}"><p:d /></r><r uid="{U1}" s:id="{R1}" s:ph="Main" />`)
      );
      expect(out).toHaveLength(1);
      expect(out[0].renderingId).toBe('{R1}');
    });

    it('returns [] for empty, nullish or non-layout content', () => {
      expect(parseLayoutXml('')).toEqual([]);
      expect(parseLayoutXml(undefined)).toEqual([]);
      expect(parseLayoutXml('plain text')).toEqual([]);
    });

    it('uses only the first device when more than one is present', () => {
      const out = parseLayoutXml(
        doubleEscape(
          `<r><d id="{D1}"><r uid="{U1}" s:id="{R1}" /></d>` +
            `<d id="{D2}"><r uid="{U2}" s:id="{R2}" /></d></r>`
        )
      );
      expect(out).toHaveLength(1);
      expect(out[0].renderingId).toBe('{R1}');
    });
  });

  describe('parseRenderingParams', () => {
    it('keeps bare keys with an empty value', () => {
      expect(parseRenderingParams('DietartyNeed&Region')).toEqual({
        DietartyNeed: '',
        Region: '',
      });
    });

    it('decodes encoded GUIDs, plus-spaces and commas', () => {
      expect(
        parseRenderingParams(
          'DishType=%7B87CFEAFD-AF5E-407B-8A4B-3EB7D9DF4018%7D&b=Clear+on+publish&c=1%2C2'
        )
      ).toEqual({
        DishType: '{87CFEAFD-AF5E-407B-8A4B-3EB7D9DF4018}',
        b: 'Clear on publish',
        c: '1,2',
      });
    });

    it('keeps malformed percent-encoding rather than throwing', () => {
      expect(parseRenderingParams('bad=100%')).toEqual({ bad: '100%' });
    });
  });

  describe('resolveDatasourceTemplates', () => {
    const itemIndex = {
      '{PLAIN}': { template: 'page content', templateId: 'T-PAGE', isMedia: false },
      '{FOLDER}': { template: 'page content folder', templateId: 'T-FOLDER', isMedia: false },
      '{KID1}': { template: 'page title and text', templateId: 'T-PTT', isMedia: false },
      '{KID2}': { template: 'navigation element', templateId: 'T-NAV', isMedia: false },
      '{MEDIA}': { template: 'image', templateId: 'T-IMG', isMedia: true },
      '{EMPTYFOLDER}': { template: 'page content folder', templateId: 'T-FOLDER', isMedia: false },
    };
    const childIndex = { '{FOLDER}': ['{KID1}', '{KID2}'] };

    it('resolves a plain content item to its own template', () => {
      expect(
        resolveDatasourceTemplates({ guid: '{PLAIN}', itemIndex, childIndex })
      ).toEqual({ templateIds: ['T-PAGE'], viaFolder: false, unresolved: false });
    });

    // The giftcards case: 5 of 6 renderings point at one folder whose children hold the
    // real content. Without this the whole page migrates empty.
    it('dereferences a folder to its children templates', () => {
      const out = resolveDatasourceTemplates({
        guid: '{FOLDER}',
        itemIndex,
        childIndex,
      });
      expect(out.viaFolder).toBe(true);
      expect(out.unresolved).toBe(false);
      expect(out.templateIds.sort()).toEqual(['T-NAV', 'T-PTT']);
    });

    it('reports a folder with no usable children as unresolved', () => {
      const out = resolveDatasourceTemplates({
        guid: '{EMPTYFOLDER}',
        itemIndex,
        childIndex,
      });
      expect(out.unresolved).toBe(true);
      expect(out.templateIds).toEqual([]);
    });

    it('treats a media item as unresolved — an asset is not a reference target', () => {
      expect(
        resolveDatasourceTemplates({ guid: '{MEDIA}', itemIndex, childIndex })
          .unresolved
      ).toBe(true);
    });

    it('treats a GUID missing from the package as unresolved', () => {
      expect(
        resolveDatasourceTemplates({ guid: '{NOPE}', itemIndex, childIndex })
          .unresolved
      ).toBe(true);
    });
  });

  describe('selectBlocks', () => {
    // The regression test for the central design decision: many renderings must not
    // become many blocks.
    const bigObservation = () => {
      const byTemplate: any = {};
      for (let i = 0; i < 60; i += 1) {
        byTemplate[`T${i}`] = {
          // Descending counts so the head clears the threshold and the tail doesn't.
          count: 1000 - i * 15,
          pages: new Set([`p${i}a`, `p${i}b`]),
          viaFolder: false,
        };
      }
      return { template: 'generic content page', pages: 3582, placements: 30000, byTemplate };
    };
    const keysFor = (obs: any) =>
      Object.fromEntries(Object.keys(obs.byTemplate).map((t) => [t, t.toLowerCase()]));

    it('caps the block count at MAX_BLOCKS_PER_TEMPLATE and demotes the rest', () => {
      const obs = bigObservation();
      const out = selectBlocks({ observation: obs, contentTypeKeys: keysFor(obs) });
      expect(out.selected.length).toBeLessThanOrEqual(25);
      expect(out.selected.length + out.demoted.length).toBeGreaterThan(
        out.selected.length
      );
    });

    it('drops templates below the coverage threshold', () => {
      const obs = {
        template: 'p',
        pages: 10,
        placements: 1000,
        byTemplate: {
          BIG: { count: 900, pages: new Set(['a', 'b']), viaFolder: false },
          TINY: { count: 2, pages: new Set(['a', 'b']), viaFolder: false },
        },
      };
      const out = selectBlocks({
        observation: obs,
        contentTypeKeys: { BIG: 'big', TINY: 'tiny' },
      });
      expect(out.selected.map((b: any) => b.contentTypeUid)).toEqual(['big']);
    });

    it('drops a template that appears on too few pages', () => {
      const obs = {
        template: 'p',
        pages: 10,
        placements: 100,
        byTemplate: {
          ONEPAGE: { count: 90, pages: new Set(['only']), viaFolder: false },
        },
      };
      const out = selectBlocks({
        observation: obs,
        contentTypeKeys: { ONEPAGE: 'onepage' },
      });
      expect(out.selected).toEqual([]);
    });

    it('skips templates with no migrated content type', () => {
      const obs = {
        template: 'p',
        pages: 10,
        placements: 100,
        byTemplate: {
          KNOWN: { count: 50, pages: new Set(['a', 'b']), viaFolder: false },
          UNKNOWN: { count: 50, pages: new Set(['a', 'b']), viaFolder: false },
        },
      };
      const out = selectBlocks({
        observation: obs,
        contentTypeKeys: { KNOWN: 'known' },
      });
      expect(out.selected.map((b: any) => b.contentTypeUid)).toEqual(['known']);
    });

    it('gives colliding block uids a numeric suffix', () => {
      const obs = {
        template: 'p',
        pages: 10,
        placements: 100,
        byTemplate: {
          A: { count: 50, pages: new Set(['a', 'b']), viaFolder: false },
          B: { count: 40, pages: new Set(['a', 'b']), viaFolder: false },
        },
      };
      const out = selectBlocks({
        observation: obs,
        contentTypeKeys: { A: 'same', B: 'same' },
      });
      expect(out.selected.map((b: any) => b.blockUid)).toEqual(['same', 'same_2']);
    });
  });

  describe('buildRenderingBlockMapping', () => {
    const selected = [
      { blockUid: 'page_content', contentTypeUid: 'page_content' },
      { blockUid: 'brand_promotion', contentTypeUid: 'brand_promotion' },
    ];

    // The parent MUST be `modular_blocks`: buildSchemaTree/buildFieldSchema match that
    // exact string. A bespoke type falls through to their default branch and the field
    // is emitted as plain text, which entry values cannot be written into.
    it('emits a modular_blocks parent so the schema builder recognises it', () => {
      const rows = buildRenderingBlockMapping({ selected });
      const parent = rows[0];
      expect(parent.contentstackFieldType).toBe('modular_blocks');
      expect(parent.backupFieldType).toBe('modular_blocks');
      expect(parent.contentstackFieldUid).toBe('components');
      // Order is the composition, so this must repeat — unlike the union block case.
      expect(parent.multiple).toBe(true);
    });

    it('marks the parent as rendering blocks so the entry side can find it', () => {
      const rows = buildRenderingBlockMapping({ selected });
      expect(rows[0].isRenderingBlocks).toBe(true);
    });

    it('emits dotted uids in the shape buildSchemaTree consumes', () => {
      const rows = buildRenderingBlockMapping({ selected });
      const child = rows.find(
        (r: any) => r.contentstackFieldUid === 'components.page_content'
      );
      expect(child.contentstackFieldType).toBe('modular_blocks_child');
      const leaf = rows.find(
        (r: any) => r.contentstackFieldUid === 'components.page_content.datasource'
      );
      expect(leaf.contentstackFieldType).toBe('reference');
      expect(leaf.refrenceTo).toEqual(['page_content']);
    });

    it('gives every block the placeholder / rendering / parameters leaves', () => {
      const rows = buildRenderingBlockMapping({ selected });
      for (const uid of ['placeholder', 'rendering_id', 'rendering_name', 'parameters']) {
        expect(
          rows.some(
            (r: any) => r.contentstackFieldUid === `components.page_content.${uid}`
          )
        ).toBe(true);
      }
    });

    it('always emits the fallback block, with no reference field', () => {
      const rows = buildRenderingBlockMapping({ selected: [] });
      expect(
        rows.some((r: any) => r.contentstackFieldUid === 'components.component')
      ).toBe(true);
      expect(
        rows.some(
          (r: any) => r.contentstackFieldUid === 'components.component.datasource_id'
        )
      ).toBe(true);
      // Nothing to point at, so no reference — the Sitecore id is kept as text instead.
      expect(
        rows.some(
          (r: any) => r.contentstackFieldUid === 'components.component.datasource'
        )
      ).toBe(false);
    });
  });

  describe('describeRenderingResolution', () => {
    it('names the template, the counts and where the tail went', () => {
      const observation = {
        template: 'generic content page',
        pages: 3582,
        placements: 10017,
        renderings: { A: { count: 1 }, B: { count: 2 } },
        byTemplate: {},
        noDatasource: 3085,
        unresolved: 496,
      };
      const line = describeRenderingResolution(observation, {
        selected: [{ blockUid: 'x' }],
        demoted: [],
      });
      expect(line).toContain('generic content page');
      expect(line).toContain('10017 placement(s)');
      expect(line).toContain('1 component block(s)');
      expect(line).toContain('3085 placement(s) have no datasource');
    });
  });
});
