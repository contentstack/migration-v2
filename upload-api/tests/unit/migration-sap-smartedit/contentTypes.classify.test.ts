import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';
import { parseImpex } from '../../../migration-sap-smartedit/utils/helper';

/**
 * Field-classification regressions, pinned against a fixture of genuine SAP ImpEx.
 *
 * The case that matters most here: an ImpEx `(lookup)` qualifier names the ATTRIBUTE to
 * match on, not the KIND of thing matched. `approvalStatus(code)` is indistinguishable
 * in the header from `masterTemplate(uid,$contentCV)`, but only the latter points at
 * another item. Typing enums as references produced empty reference fields in
 * Contentstack — real values like `approved` and `sameWindow` disappeared.
 */
const FIXTURE_DIR = path.join(__dirname, '../../fixtures/sap-smartedit');
const FIXTURE = path.join(FIXTURE_DIR, 'real-spartacus-excerpt.impex');

let cts: any[] = [];

const fieldOf = (type: string, sourceField: string) =>
  cts
    .find((c) => c.otherCmsTitle === type)
    ?.fieldMapping?.find((f: any) => f.otherCmsField === sourceField);

beforeAll(async () => {
  cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
});

afterAll(() => {
  // extractContentTypes writes schema files next to the cwd.
  fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
});

describe('classifyColumn — enum lookups are not item references', () => {
  it('does not type an enum lookup as a reference', () => {
    // No entry is named "approved" or "sameWindow", so these must carry their value.
    expect(fieldOf('ContentPage', 'approvalStatus')?.contentstackFieldType).not.toBe('reference');
    expect(fieldOf('ContentPage', 'target')?.contentstackFieldType).not.toBe('reference');
  });

  it('keeps the enum value in a text field so it is not lost', () => {
    expect(fieldOf('ContentPage', 'approvalStatus')?.contentstackFieldType).toBe('single_line_text');
  });

  it('does not type a type-code lookup as a reference', () => {
    // validComponentTypes lists TYPE names (CMSSiteContextComponent), not entry ids.
    expect(fieldOf('ContentSlotName', 'validComponentTypes')?.contentstackFieldType).not.toBe(
      'reference',
    );
  });

  it('still types a genuine item reference as a reference', () => {
    // LandingPage2Template is declared as a PageTemplate in the fixture.
    expect(fieldOf('ContentPage', 'masterTemplate')?.contentstackFieldType).toBe('reference');
  });

  it('keeps a reference whose target type is known by column name', () => {
    // `template`/`contentSlot` are in REF_TARGETS, so they stay references even when the
    // target happens to live outside the export.
    expect(fieldOf('ContentSlotName', 'template')?.contentstackFieldType).toBe('reference');
    expect(fieldOf('ContentSlotForTemplate', 'contentSlot')?.contentstackFieldType).toBe('reference');
  });
});

describe('classifyColumn — a slot referencing MIXED component types', () => {
  // ImpEx has no equivalent to Contentstack's modular_blocks — a ContentSlot's
  // cmsComponents list can reference several different component types
  // (CMSParagraphComponent, CMSLinkComponent, ...) in one ordered list, and this is
  // deliberately kept as a plain multi-value reference, per schemaMapper.ts's header
  // comment ("ImpEx is flat ... we do not expand groups/modular-blocks here").
  // Proven against a real slot (MixedTypeSlot) referencing one of each, rather than
  // left as an untested assumption.
  it('types cmsComponents as a multi-value reference, not modular_blocks', () => {
    const field = fieldOf('ContentSlot', 'cmsComponents');
    expect(field?.contentstackFieldType).toBe('reference');
    expect(field?.advanced?.multiple).toBe(true);
  });

  it('resolves both referenced entries regardless of which component type they are', () => {
    const rows = parseImpex(FIXTURE).blocks.get('ContentSlot')?.rows ?? [];
    const mixed = rows.find((r) => r.uid === 'MixedTypeSlot');
    expect(mixed?.cmsComponents?.split(',')).toEqual(['PageNotFoundParagraphComponent', 'CartLink']);
  });
});

describe('parseImpex — real multi-locale values, not a data-dropping clash', () => {
  it('records the FIRST [lang=xx] modifier on the column (for old single-locale consumers)', () => {
    const cols = parseImpex(FIXTURE).blocks.get('CMSNavigationNode')?.columns;
    expect(cols?.get('title')?.lang).toBe('en');
  });

  it('records every distinct language seen for the attribute across the block', () => {
    // Both title[lang=en] and title[lang=de] resolve to one field/schema entry, but both
    // languages must be discoverable — extractLocale relies on this to create BOTH
    // destination locales rather than just the catalog's declared primary one.
    const cols = parseImpex(FIXTURE).blocks.get('CMSNavigationNode')?.columns;
    expect(cols?.get('title')?.locales.sort()).toEqual(['de', 'en']);
  });

  it('keeps the primary language as the row default, for locale-unaware consumers', () => {
    const rows = parseImpex(FIXTURE).blocks.get('CMSNavigationNode')?.rows ?? [];
    expect(rows[0]?.title).toBe('English Title');
  });

  it('captures BOTH languages values per row — nothing is dropped', () => {
    const { blocks } = parseImpex(FIXTURE);
    const block = blocks.get('CMSNavigationNode')!;
    const row = block.rows[0];
    const localized = block.localizedValues.get(row);
    expect(localized?.title).toEqual({ en: 'English Title', de: 'Deutscher Titel' });
  });
});
