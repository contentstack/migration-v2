import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import {
  composeComponents,
  readBlockDescriptors,
} from '../../../src/utils/rendering-composer.utils.js';
import { buildSchemaTree } from '../../../src/utils/content-type-creator.utils.js';

const require = createRequire(import.meta.url);
// The mapper lives in the sibling service and is plain CommonJS.
const { buildRenderingBlockMapping } = require('../../../../upload-api/migration-sitecore/libs/observedRenderings.js');

const doubleEscape = (xml: string) =>
  xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;/g, '&amp;lt;')
    .replace(/&gt;/g, '&amp;gt;');

const layout = (inner: string) =>
  doubleEscape(`<r><d id="{DEV}">${inner}</d></r>`);

// A fieldMapping in the flat dotted shape the mapper emits, with one dedicated block
// plus the fallback.
const fieldMapping = [
  { contentstackFieldUid: 'title', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components', contentstackFieldType: 'rendering_blocks', multiple: true },
  { contentstackFieldUid: 'components.page_content', contentstackFieldType: 'modular_blocks_child' },
  {
    contentstackFieldUid: 'components.page_content.datasource',
    contentstackFieldType: 'reference',
    refrenceTo: ['page_content'],
  },
  { contentstackFieldUid: 'components.page_content.placeholder', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.page_content.rendering_id', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.page_content.rendering_name', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.page_content.parameters', contentstackFieldType: 'json' },
  { contentstackFieldUid: 'components.component', contentstackFieldType: 'modular_blocks_child' },
  { contentstackFieldUid: 'components.component.datasource_id', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.component.placeholder', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.component.rendering_id', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.component.rendering_name', contentstackFieldType: 'single_line_text' },
  { contentstackFieldUid: 'components.component.parameters', contentstackFieldType: 'json' },
];

const entriesData = [
  {
    template: 'page content',
    locale: { en: { dsuid1: { meta: {}, fields: {} } } },
  },
];

const idCorrector = ({ id }: any) => `${id}`.replace(/[-{}]/g, '').toLowerCase();
const uidCorrector = ({ uid }: any) => `${uid}`.replace(/[ -]/g, '_').toLowerCase();

const base = {
  fieldMapping,
  componentsUid: 'components',
  entriesData,
  locale: 'en',
  idCorrector: ({ id }: any) => (id === '{AAAAAAAA-1111-2222-3333-444444444444}' ? 'dsuid1' : idCorrector({ id })),
  uidCorrector,
};

describe('rendering-composer.utils', () => {
  // The mapper emits fieldMapping rows; the schema builder turns them into the content
  // type; the composer writes entry values into that shape. A mismatch between any two
  // is invisible in their own unit tests — this pins the contract across all three.
  //
  // Regression: the parent row once used a bespoke `rendering_blocks` type. The composer
  // matched it, so entries carried components, but buildSchemaTree/buildFieldSchema
  // matched only `modular_blocks`, so the content type emitted a plain TEXT field. The
  // entries were unimportable.
  describe('mapper -> schema -> entry contract', () => {
    const mapperRows = buildRenderingBlockMapping({
      selected: [{ blockUid: 'page_content', contentTypeUid: 'page_content' }],
    });

    it('emits a parent the schema builder nests as blocks, not text', () => {
      const tree = buildSchemaTree(mapperRows);
      const comp: any = tree.find(
        (f: any) => f.contentstackFieldUid === 'components'
      );
      expect(comp).toBeDefined();
      expect(comp.contentstackFieldType).toBe('modular_blocks');
      // Nested children are what make it a blocks field rather than a leaf.
      expect(comp.schema?.length).toBeGreaterThan(0);
      expect(comp.schema.map((b: any) => b.uid).sort()).toEqual([
        'component',
        'page_content',
      ]);
    });

    it('gives every block the leaves the composer writes', () => {
      const tree = buildSchemaTree(mapperRows);
      const comp: any = tree.find(
        (f: any) => f.contentstackFieldUid === 'components'
      );
      const block = comp.schema.find((b: any) => b.uid === 'page_content');
      const leaves = block.schema.map((l: any) => l.uid).sort();
      expect(leaves).toEqual([
        'datasource',
        'parameters',
        'placeholder',
        'rendering_id',
        'rendering_name',
      ]);
    });

    it('lets the composer resolve blocks straight from the mapper rows', () => {
      const out = composeComponents({
        layoutContent: layout(
          `<r uid="{U1}" s:id="{R1}" s:ds="{AAAAAAAA-1111-2222-3333-444444444444}" s:ph="Main" />`
        ),
        fieldMapping: mapperRows,
        componentsUid: 'components',
        entriesData: [
          { template: 'page content', locale: { en: { dsuid1: {} } } },
        ],
        locale: 'en',
        idCorrector: ({ id }: any) =>
          id === '{AAAAAAAA-1111-2222-3333-444444444444}'
            ? 'dsuid1'
            : idCorrector({ id }),
        uidCorrector,
      });
      expect(out).toHaveLength(1);
      expect(Object.keys(out[0])[0]).toBe('page_content');
    });
  });

  describe('readBlockDescriptors', () => {
    it('recovers blocks and their accepted content types from the flat mapping', () => {
      const blocks = readBlockDescriptors(fieldMapping, 'components');
      const dedicated = blocks.find((b) => b.blockUid === 'page_content');
      expect(dedicated?.contentTypeUids).toEqual(['page_content']);
      expect(dedicated?.isFallback).toBe(false);
      expect(blocks.find((b) => b.blockUid === 'component')?.isFallback).toBe(true);
    });

    it('ignores rows belonging to other fields', () => {
      const blocks = readBlockDescriptors(fieldMapping, 'components');
      expect(blocks.some((b) => b.blockUid === 'title')).toBe(false);
    });
  });

  describe('composeComponents', () => {
    it('returns [] when the page has no layout', () => {
      expect(composeComponents({ ...base, layoutContent: '' })).toEqual([]);
      expect(composeComponents({ ...base, layoutContent: undefined })).toEqual([]);
    });

    it('returns [] when the content type has no components field', () => {
      const out = composeComponents({
        ...base,
        fieldMapping: [{ contentstackFieldUid: 'title' }],
        layoutContent: layout(`<r uid="{U1}" s:id="{R1}" s:ds="{AAAAAAAA-1111-2222-3333-444444444444}" s:ph="Main" />`),
      });
      expect(out).toEqual([]);
    });

    it('writes a resolvable datasource into its dedicated block', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(
          `<r uid="{U1}" s:id="{R1}" s:ds="{AAAAAAAA-1111-2222-3333-444444444444}" s:ph="MainContent" s:par="CSSStyles" />`
        ),
      });
      expect(out).toHaveLength(1);
      expect(out[0].page_content).toMatchObject({
        datasource: [{ uid: 'dsuid1', _content_type_uid: 'page_content' }],
        placeholder: 'MainContent',
        rendering_id: '{R1}',
        parameters: { CSSStyles: '' },
      });
    });

    it('routes a placement with no datasource to the fallback block', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(`<r uid="{U1}" s:id="{R1}" s:ph="Main" />`),
      });
      expect(out).toHaveLength(1);
      expect(out[0].component).toMatchObject({
        datasource_id: '',
        rendering_id: '{R1}',
      });
    });

    // A datasource the package doesn't contain must never become a dangling reference.
    it('routes an unresolvable datasource to the fallback, keeping the Sitecore id', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(
          `<r uid="{U1}" s:id="{R1}" s:ds="{11111111-1111-1111-1111-111111111111}" s:ph="Main" />`
        ),
      });
      expect(out).toHaveLength(1);
      expect(out[0].component.datasource_id).toBe(
        '{11111111-1111-1111-1111-111111111111}'
      );
    });

    it('preserves p:after order rather than document order', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(
          `<r uid="{A}" s:id="{RA}" s:ph="Main" />` +
            `<r uid="{B}" s:id="{RB}" s:ph="Main" p:after="r[@uid='{C}']" />` +
            `<r uid="{C}" s:id="{RC}" s:ph="Main" p:after="r[@uid='{A}']" />`
        ),
      });
      expect(out.map((b: any) => b.component.rendering_id)).toEqual([
        '{RA}',
        '{RC}',
        '{RB}',
      ]);
    });

    it('skips personalization stubs that carry no s:id', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(
          `<r uid="{U0}"><p:d /></r><r uid="{U1}" s:id="{R1}" s:ph="Main" />`
        ),
      });
      expect(out).toHaveLength(1);
    });

    it('fills rendering_name when a name index is supplied', () => {
      const out = composeComponents({
        ...base,
        layoutContent: layout(`<r uid="{U1}" s:id="{R1}" s:ds="{AAAAAAAA-1111-2222-3333-444444444444}" s:ph="Main" />`),
        renderingNames: { '{R1}': 'HomeCarousel' },
      });
      expect(out[0].page_content.rendering_name).toBe('HomeCarousel');
    });

    // Folder datasources are the case that silently emptied whole pages: a Sitecore
    // folder IS an ordinary entry, so "did it resolve" is always yes and the children
    // are never reached unless the folder is detected by template name.
    describe('folder datasources', () => {
      const FOLDER = '{FFFFFFFF-0000-0000-0000-000000000000}';
      const folderEntries = [
        ...entriesData,
        {
          template: 'page content folder',
          locale: { en: { ffffffff000000000000000000000000: {} } },
        },
        {
          template: 'page content',
          locale: { en: { kid1: {}, kid2: {} } },
        },
      ];
      const childIndex = {
        [FOLDER]: [
          '{KID10000-0000-0000-0000-000000000000}',
          '{KID20000-0000-0000-0000-000000000000}',
        ],
      };
      const folderId = ({ id }: any) => {
        if (id === FOLDER) return 'ffffffff000000000000000000000000';
        if (`${id}`.startsWith('{KID1')) return 'kid1';
        if (`${id}`.startsWith('{KID2')) return 'kid2';
        return idCorrector({ id });
      };

      it('expands a folder to its children rather than referencing the folder', () => {
        const out = composeComponents({
          ...base,
          entriesData: folderEntries,
          idCorrector: folderId,
          childIndex,
          layoutContent: layout(
            `<r uid="{U1}" s:id="{R1}" s:ds="${FOLDER}" s:ph="Main" />`
          ),
        });
        expect(out).toHaveLength(1);
        expect(out[0].page_content.datasource).toEqual([
          { uid: 'kid1', _content_type_uid: 'page_content' },
          { uid: 'kid2', _content_type_uid: 'page_content' },
        ]);
      });

      // Emitting one block per child turned a 6-component page into 66.
      it('emits exactly one block per placement, not one per child', () => {
        const out = composeComponents({
          ...base,
          entriesData: folderEntries,
          idCorrector: folderId,
          childIndex,
          layoutContent: layout(
            `<r uid="{U1}" s:id="{R1}" s:ds="${FOLDER}" s:ph="Main" />` +
              `<r uid="{U2}" s:id="{R2}" s:ds="${FOLDER}" s:ph="Main" />`
          ),
        });
        expect(out).toHaveLength(2);
      });

      it('falls back to the folder entry when it has no usable children', () => {
        const out = composeComponents({
          ...base,
          entriesData: folderEntries,
          idCorrector: folderId,
          childIndex: {},
          layoutContent: layout(
            `<r uid="{U1}" s:id="{R1}" s:ds="${FOLDER}" s:ph="Main" />`
          ),
        });
        // No block accepts `page_content_folder`, so it lands in the fallback rather
        // than disappearing.
        expect(out).toHaveLength(1);
        expect(out[0].component).toBeDefined();
      });
    });

    it('drops placements entirely when there is no fallback block to catch them', () => {
      const noFallback = fieldMapping.filter(
        (r) => !r.contentstackFieldUid.startsWith('components.component')
      );
      const out = composeComponents({
        ...base,
        fieldMapping: noFallback,
        layoutContent: layout(`<r uid="{U1}" s:id="{R1}" s:ph="Main" />`),
      });
      expect(out).toEqual([]);
    });
  });
});
