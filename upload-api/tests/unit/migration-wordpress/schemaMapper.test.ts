import { describe, it, expect, vi } from 'vitest';
import { schemaMapper, getFieldName, getFieldUid, handleAttributesSchema } from '../../../migration-wordpress/libs/schemaMapper';
import { WordPressBlock } from '../../../migration-wordpress/interface/interface';

function makeBlock(overrides: Partial<WordPressBlock> & { name: string }): WordPressBlock {
  return {
    clientId: 'c1',
    attributes: {},
    innerBlocks: [],
    ...overrides,
  };
}

const affix = 'wp';

describe('getFieldName', () => {
  it('returns the part after "/" for slash-separated names', () => {
    expect(getFieldName('core/paragraph')).toBe('paragraph');
  });

  it('returns the original key when no "/" or "wp:" prefix', () => {
    expect(getFieldName('title')).toBe('title');
  });

  it('strips "wp:" prefix and joins remaining parts', () => {
    expect(getFieldName('wp:post_title')).toBe('title');
    expect(getFieldName('wp:post_author_name')).toBe('author name');
  });
});

describe('getFieldUid', () => {
  it('returns the part after "/" lowercased with hyphens replaced', () => {
    expect(getFieldUid('core/my-block', affix)).toBe('my_block');
  });

  it('returns the key as-is (lowercased) when no special prefix', () => {
    expect(getFieldUid('MyField', affix)).toBe('myfield');
  });

  it('strips "wp:" prefix', () => {
    expect(getFieldUid('wp:meta_value', affix)).toBe('meta_value');
  });

  it('returns falsy input unchanged', () => {
    expect(getFieldUid('', affix)).toBe('');
  });

  it('prefixes with affix when uid is a restricted keyword', () => {
    expect(getFieldUid('core/tags', affix)).toBe('wp_tags');
    expect(getFieldUid('core/locale', affix)).toBe('wp_locale');
  });
});

describe('handleAttributesSchema', () => {
  it('maps string properties to single_line_text', async () => {
    const schema = { title: { type: 'string' } };
    const result = await handleAttributesSchema(schema, null, 'root', affix);
    expect(result).toHaveLength(1);
    expect(result[0].contentstackFieldType).toBe('single_line_text');
    expect(result[0].otherCmsField).toBe('title');
  });

  it('maps boolean properties', async () => {
    const schema = { isActive: { type: 'boolean' } };
    const result = await handleAttributesSchema(schema, null, 'root', affix);
    expect(result[0].contentstackFieldType).toBe('boolean');
  });

  it('maps number properties', async () => {
    const schema = { count: { type: 'number' } };
    const result = await handleAttributesSchema(schema, null, 'root', affix);
    expect(result[0].contentstackFieldType).toBe('number');
  });

  it('excludes the "id" field', async () => {
    const schema = { id: { type: 'string' }, name: { type: 'string' } };
    const result = await handleAttributesSchema(schema, null, 'root', affix);
    expect(result).toHaveLength(1);
    expect(result[0].otherCmsField).toBe('name');
  });

  it('prefixes uid with parentUid when provided', async () => {
    const schema = { title: { type: 'string' } };
    const result = await handleAttributesSchema(schema, 'parent_group', 'root', affix);
    expect(result[0].contentstackFieldUid).toBe('parent_group.title');
    expect(result[0].contentstackField).toBe('root > title');
  });
});

describe('schemaMapper', () => {
  describe('core/paragraph and RTE blocks', () => {
    const rteBlockNames = ['core/paragraph', 'core/html', 'core/pullquote', 'core/table', 'core/columns', 'core/verse', 'core/code'];

    rteBlockNames.forEach((blockName) => {
      it(`maps ${blockName} to json type`, async () => {
        const block = makeBlock({ name: blockName });
        const result = await schemaMapper(block, null, null, affix);
        expect(result).toMatchObject({
          otherCmsField: getFieldName(blockName),
          contentstackFieldType: 'json',
          backupFieldType: 'json',
        });
      });
    });

    it('maps core/missing to json type with "body" fieldName', async () => {
      const block = makeBlock({ name: 'core/missing' });
      const result = await schemaMapper(block, null, null, affix);
      expect(result.contentstackFieldType).toBe('json');
      expect(result.contentstackField).toBe('body');
    });
  });

  describe('media blocks', () => {
    const mediaBlockNames = ['core/image', 'core/audio', 'core/video', 'core/file'];

    mediaBlockNames.forEach((blockName) => {
      it(`maps ${blockName} to file type`, async () => {
        const block = makeBlock({ name: blockName });
        const result = await schemaMapper(block, null, null, affix);
        expect(result).toMatchObject({
          otherCmsField: 'media',
          contentstackField: 'media',
          contentstackFieldType: 'file',
          backupFieldType: 'file',
        });
      });
    });
  });

  describe('text blocks (heading, list-item)', () => {
    const textBlockNames = ['core/heading', 'core/accordion-heading', 'core/list-item'];

    textBlockNames.forEach((blockName) => {
      it(`maps ${blockName} to single_line_text`, async () => {
        const block = makeBlock({ name: blockName });
        const result = await schemaMapper(block, null, null, affix);
        expect(result).toMatchObject({
          otherCmsField: getFieldName(blockName),
          contentstackFieldType: 'single_line_text',
          backupFieldType: 'single_line_text',
        });
      });
    });
  });

  describe('link blocks', () => {
    it('maps core/social-link to link type', async () => {
      const block = makeBlock({ name: 'core/social-link' });
      const result = await schemaMapper(block, null, null, affix);
      expect(result.contentstackFieldType).toBe('link');
    });

    it('maps core/navigation-link to link type', async () => {
      const block = makeBlock({ name: 'core/navigation-link' });
      const result = await schemaMapper(block, null, null, affix);
      expect(result.contentstackFieldType).toBe('link');
    });
  });

  describe('core/button', () => {
    it('returns a link field for a button block', async () => {
      const block = makeBlock({ name: 'core/button', clientId: 'btn1' });
      const result = await schemaMapper(block, null, null, affix);
      expect(result).toMatchObject({
        otherCmsField: 'button',
        contentstackFieldType: 'link',
        backupFieldType: 'link',
      });
    });

    it('uses metadata name when available', async () => {
      const block = makeBlock({
        name: 'core/button',
        clientId: 'btn1',
        attributes: { metadata: { name: 'cta_button' } },
      });
      const result = await schemaMapper(block, null, null, affix);
      expect(result.otherCmsType).toBe('cta_button');
      expect(result.contentstackField).toBe('cta_button');
    });

    it('nests uid under parentUid when provided', async () => {
      const block = makeBlock({ name: 'core/button', clientId: 'btn1' });
      const result = await schemaMapper(block, 'parent', 'Parent', affix);
      expect(result.uid).toContain('parent.');
      expect(result.contentstackField).toContain('Parent > ');
    });
  });

  describe('core/buttons', () => {
    it('returns [] when there are no inner blocks', async () => {
      const block = makeBlock({ name: 'core/buttons', clientId: 'btns1', innerBlocks: [] });
      const result = await schemaMapper(block, null, null, affix);
      expect(result).toEqual([]);
    });

    it('returns inner block fields directly (no group wrapper) for 1 inner block', async () => {
      const innerButton = makeBlock({ name: 'core/button', clientId: 'btn1' });
      const block = makeBlock({ name: 'core/buttons', clientId: 'btns1', innerBlocks: [innerButton] });
      const result = await schemaMapper(block, 'page', 'Page', affix);

      expect(Array.isArray(result)).toBe(true);
      const groupFields = result.filter((f: any) => f.contentstackFieldType === 'group');
      expect(groupFields).toHaveLength(0);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('overwrites uid/contentstackField/contentstackFieldUid/backupFieldUid for single inner block', async () => {
      const innerButton = makeBlock({ name: 'core/button', clientId: 'btn1' });
      const block = makeBlock({ name: 'core/buttons', clientId: 'btns1', innerBlocks: [innerButton] });
      const result = await schemaMapper(block, 'page', 'Page', affix);

      result.forEach((field: any) => {
        expect(field.contentstackFieldUid).toBe(`page.${getFieldUid('core/buttons_btns', affix)}`);
        expect(field.uid).toBe(`page.${getFieldUid('core/buttons_btns', affix)}`);
        expect(field.backupFieldUid).toBe(`page.${getFieldUid('core/buttons_btns', affix)}`);
        expect(field.contentstackField).toContain('Page > ');
      });
    });

    it('returns group wrapper + inner block fields for >1 inner blocks', async () => {
      const btn1 = makeBlock({
        name: 'core/button', clientId: 'btn1',
        attributes: { metadata: { name: 'primary_cta' } },
      });
      const btn2 = makeBlock({
        name: 'core/button', clientId: 'btn2',
        attributes: { metadata: { name: 'secondary_cta' } },
      });
      const block = makeBlock({ name: 'core/buttons', clientId: 'btns1', innerBlocks: [btn1, btn2] });
      const result = await schemaMapper(block, null, null, affix);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].contentstackFieldType).toBe('group');
      expect(result[0].otherCmsField).toBe('buttons');

      const nonGroupFields = result.filter((f: any) => f.contentstackFieldType !== 'group');
      expect(nonGroupFields.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('group blocks (core/group, core/list, etc.)', () => {
    it('unwraps single-child core/group (no wrapper row; parent uid only)', async () => {
      const innerParagraph = makeBlock({ name: 'core/paragraph', clientId: 'p1' });
      const block = makeBlock({ name: 'core/group', clientId: 'g1', innerBlocks: [innerParagraph] });
      const result = await schemaMapper(block, null, null, affix);

      expect(Array.isArray(result)).toBe(true);
      expect(result.every((f: any) => f.contentstackFieldType !== 'group')).toBe(true);
      expect(result[0].contentstackFieldType).toBe('json');
      expect(result[0].uid).not.toContain('group_');
    });

    it('single-child core/group inherits parentUid (no group segment in uid)', async () => {
      const innerParagraph = makeBlock({ name: 'core/paragraph', clientId: 'p1' });
      const block = makeBlock({ name: 'core/group', clientId: 'g1', innerBlocks: [innerParagraph] });
      const result = await schemaMapper(block, 'panel_uid', 'Panel', affix);

      expect(Array.isArray(result)).toBe(true);
      const p = result[0] as any;
      expect(p.uid).toMatch(/^panel_uid\.paragraph_/);
      expect(p.contentstackField).toBe('Panel > paragraph');
    });

    it('marks duplicate inner blocks as multiple', async () => {
      const p1 = makeBlock({ name: 'core/paragraph', clientId: 'p1' });
      const p2 = makeBlock({ name: 'core/paragraph', clientId: 'p2' });
      const block = makeBlock({ name: 'core/group', clientId: 'g1', innerBlocks: [p1, p2] });
      const result = await schemaMapper(block, null, null, affix);

      const innerFields = result.filter((f: any) => f.contentstackFieldType !== 'group');
      const multipleField = innerFields.find((f: any) => f.advanced?.multiple);
      expect(multipleField).toBeDefined();
    });
  });

  describe('parentUid propagation', () => {
    it('prefixes uid with parentUid for nested blocks', async () => {
      const block = makeBlock({ name: 'core/paragraph', clientId: 'p1' });
      const result = await schemaMapper(block, 'parent_group', null, affix);
      expect(result.uid).toMatch(/^parent_group\./);
      expect(result.contentstackFieldUid).toMatch(/^parent_group\./);
    });

    it('builds fieldName chain with parentFieldName', async () => {
      const block = makeBlock({ name: 'core/heading', clientId: 'h1' });
      const result = await schemaMapper(block, null, 'Section', affix);
      expect(result.contentstackField).toBe('Section > heading');
    });
  });

  describe('array input', () => {
    it('processes an array of blocks and returns flat schema', async () => {
      const blocks = [
        makeBlock({ name: 'core/paragraph', clientId: 'p1' }),
        makeBlock({ name: 'core/heading', clientId: 'h1' }),
      ];
      const result = await schemaMapper(blocks, null, null, affix);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].contentstackFieldType).toBe('json');
      expect(result[1].contentstackFieldType).toBe('single_line_text');
    });

    it('deduplicates matching blocks and marks as multiple', async () => {
      const blocks = [
        makeBlock({ name: 'core/paragraph', clientId: 'p1' }),
        makeBlock({ name: 'core/paragraph', clientId: 'p2' }),
      ];
      const result = await schemaMapper(blocks, 'root', null, affix);
      const paragraphs = result.filter((f: any) => f.otherCmsField === 'paragraph');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].advanced?.multiple).toBe(true);
    });
  });

  describe('unknown block types', () => {
    it('returns empty array for unrecognized block names', async () => {
      const block = makeBlock({ name: 'custom/unknown-block', clientId: 'u1' });
      const result = await schemaMapper(block, null, null, affix);
      expect(result).toEqual([]);
    });
  });

  describe('metadata name override', () => {
    it('uses attributes.metadata.name for otherCmsType when available', async () => {
      const block = makeBlock({
        name: 'core/paragraph',
        clientId: 'p1',
        attributes: { metadata: { name: 'intro_text' } },
      });
      const result = await schemaMapper(block, null, null, affix);
      expect(result.otherCmsType).toBe('intro_text');
      expect(result.contentstackField).toBe('intro_text');
    });
  });

  describe('jetpack/story (core/missing)', () => {
    it('maps to a repeatable group with title, alt, caption, and image', async () => {
      const block = makeBlock({
        name: 'core/missing',
        clientId: '63bf87d2-bc77-4517-a491-e30e3e39646d',
        attributes: {
          originalName: 'jetpack/story',
          mediaFiles: [
            {
              id: 31,
              title: 'image2',
              url: 'https://example.com/wp-content/uploads/2025/08/image2.jpeg',
              alt: '',
              caption: '',
            },
          ],
        },
      });
      const result = await schemaMapper(block, 'modular_blocks.mb_uid', 'Modular Blocks > story', affix);
      expect(Array.isArray(result)).toBe(true);
      const group = result.find((f: any) => f.contentstackFieldType === 'group');
      expect(group).toMatchObject({
        contentstackFieldType: 'group',
        advanced: { multiple: true },
        otherCmsField: 'story',
      });
      const textFields = result.filter((f: any) => f.contentstackFieldType === 'single_line_text');
      expect(textFields.map((f: any) => f.otherCmsField).sort()).toEqual(['alt', 'caption', 'title']);
      const imageField = result.find((f: any) => f.otherCmsField === 'image');
      expect(imageField?.contentstackFieldType).toBe('file');
    });
  });
});
