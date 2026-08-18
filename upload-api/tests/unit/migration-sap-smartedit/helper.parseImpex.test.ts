import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseImpex, parseMacros, parseImpexPath } from '../../../migration-sap-smartedit/utils/helper';
import fs from 'fs';

/**
 * Regression tests for the ImpEx parser, pinned against a fixture of GENUINE SAP
 * rows (SAP `spartacussampledata` 2105). Every case here is a construct that real
 * customer data contains and that the parser mishandled at some point.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/real-spartacus-excerpt.impex');

const parsed = () => parseImpex(FIXTURE);

describe('parseImpex — macros', () => {
  it('captures $macro definitions, including ones defined mid-file', () => {
    const { macros } = parsed();
    expect(macros.contentCatalog).toBe('electronics-spaContentCatalog');
    expect(macros.siteResource).toContain('jar:de.hybris.platform.spartacussampledata');
    // Defined after a type header rather than in the file preamble.
    expect(macros.emailResource).toBe('$config-emailResourceValue');
  });

  it('parseMacros works directly on raw text', () => {
    const raw = fs.readFileSync(FIXTURE, 'utf8');
    expect(parseMacros(raw).contentCatalog).toBe('electronics-spaContentCatalog');
  });
});

describe('parseImpex — type-level [modifiers] are stripped from the item type', () => {
  it('registers "GenericItem", not "GenericItem[processor=...]"', () => {
    const { blocks } = parsed();
    expect(blocks.has('GenericItem')).toBe(true);
    expect([...blocks.keys()].some((t) => t.includes('['))).toBe(false);
  });

  it('keeps a header-only block with zero data rows', () => {
    // The only line after this header is a macro definition, so the block is real
    // but empty. It must not swallow the macro line as a row.
    expect(parsed().blocks.get('GenericItem')?.rows).toEqual([]);
  });
});

describe('parseImpex — REMOVE blocks are deletion instructions, not content', () => {
  it('does not emit rows for a REMOVE block, even when the type has a real row elsewhere', () => {
    // ContentSlot has both a REMOVE block (RemovedSlotOne/Two) and one genuine
    // INSERT_UPDATE row (MixedTypeSlot) in this fixture — the REMOVE rows must not
    // leak into the type's real content.
    const rows = parsed().blocks.get('ContentSlot')?.rows ?? [];
    expect(rows.map((r) => r.uid)).toEqual(['MixedTypeSlot']);
  });

  it('does not register a type that appears only under REMOVE', () => {
    expect(parsed().blocks.has('JspIncludeComponent')).toBe(false);
  });

  it('does not leak REMOVE rows into the next INSERT_UPDATE block', () => {
    const pages = parsed().blocks.get('Page');
    expect(pages?.rows.map((r) => r.uid)).toEqual(['withNullRef', 'withRealRef']);
  });
});

describe('parseImpex — quoted ImpEx script directives', () => {
  it('ignores a multi-line "#% beforeEach: block and its body', () => {
    const customers = parsed().blocks.get('Customer');
    // Exactly one real data row; the 4 directive lines must not become rows.
    expect(customers?.rows).toHaveLength(1);
    expect(customers?.rows.every((r) => Object.keys(r).length > 0)).toBe(true);
  });

  it('parses the data row that follows the directive block', () => {
    const row = parsed().blocks.get('Customer')?.rows[0];
    expect(row?.uid).toBe('reviewer1@hybris.com');
    expect(row?.name).toBe('Kenneth Reviewer');
  });
});

describe('parseImpex — ImpEx quoting is removed from values', () => {
  it('strips the wrapping double quotes from HTML content', () => {
    const rows = parsed().blocks.get('CMSParagraphComponent')?.rows ?? [];
    const notFound = rows.find((r) => r.uid === 'PageNotFoundParagraphComponent');
    expect(notFound?.content).toBe(
      '<h2>Oops!</h2><h3>We couldn\'t find the page you are looking for.</h3>',
    );
  });

  it('strips quotes from a short plain value', () => {
    const rows = parsed().blocks.get('CMSParagraphComponent')?.rows ?? [];
    expect(rows.find((r) => r.uid === 'SaleParagraphComponent')?.content).toBe('Sale');
  });

  it('unescapes a doubled "" into a single literal quote', () => {
    const rows = parsed().blocks.get('CMSParagraphComponent')?.rows ?? [];
    expect(rows.find((r) => r.uid === 'QuotedInnerParagraph')?.content).toBe('He said "hello" loudly');
  });
});

describe('parseImpex — the literal "Null" reference', () => {
  it('treats a "Null" cell as empty, not as a reference target named Null', () => {
    const rows = parsed().blocks.get('Page')?.rows ?? [];
    expect(rows.find((r) => r.uid === 'withNullRef')).not.toHaveProperty('originalPage');
  });

  it('still keeps a genuine reference value', () => {
    const rows = parsed().blocks.get('Page')?.rows ?? [];
    expect(rows.find((r) => r.uid === 'withRealRef')?.originalPage).toBe('withNullRef');
  });
});

describe('parseImpex — system columns and positional alignment', () => {
  it('drops the $contentCV catalog-version column but keeps later cells aligned', () => {
    const cols = [...(parsed().blocks.get('CMSParagraphComponent')?.columns.keys() ?? [])];
    expect(cols).toEqual(['uid', 'name', 'content']);
  });

  it('drops &-prefixed document-id aliases', () => {
    const cols = [...(parsed().blocks.get('CMSLinkComponent')?.columns.keys() ?? [])];
    expect(cols).not.toContain('linkRef');
    expect(cols).not.toContain('componentRef');
    expect(cols).toEqual(['uid', 'name', 'url', 'target']);
  });

  it('drops the @-prefixed media translator column', () => {
    const media = parsed().blocks.get('Media');
    expect([...(media?.columns.keys() ?? [])]).toEqual(['code', 'mime', 'realfilename', 'folder']);
    // The jar: binary pointer is therefore not available as a downloadable URL.
    expect(media?.rows[0]).not.toHaveProperty('URL');
  });

  it('keeps cells aligned when a slot is emptied by a header [default=...]', () => {
    const row = parsed().blocks.get('ContentSlotForTemplate')?.rows[0];
    // pageTemplate's slot is empty in the row, so contentSlot must NOT shift into it.
    expect(row?.position).toBe('TopContent');
    expect(row?.contentSlot).toBe('ProductBackInStockNotificationEmailTopSlot');
    expect(row?.allowOverwrite).toBe('true');
  });
});

describe('parseImpex — header [default=...] fills an empty cell', () => {
  it('applies the default rather than leaving the value empty', () => {
    // SAP applies header defaults, so an empty cell is not an empty value. Ignoring
    // them dropped real reference values — a ContentSlotName whose template came from
    // the default appeared unlinked in Contentstack.
    const row = parsed().blocks.get('ContentSlotForTemplate')?.rows[0];
    expect(row?.pageTemplate).toBe('ProductBackInStockNotificationEmailTemplate');
  });

  it('records the default on the column definition', () => {
    const cols = parsed().blocks.get('CMSLinkComponent')?.columns;
    expect(cols?.get('target')?.defaultValue).toBe('sameWindow');
  });

  it('fills a blank cell from the default, and lets a real value win', () => {
    const rows = parsed().blocks.get('ContentSlotName')?.rows ?? [];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.template)).toEqual([
      'CpqConfigurationTemplate', // blank cell -> header default
      'ProductDetailsPageTemplate', // explicit value beats the default
      'ErrorPageTemplate',
    ]);
  });

  it('applies a default to a cell missing entirely from the end of a row', () => {
    // The CMSLinkComponent row stops before its `target` cell.
    expect(parsed().blocks.get('CMSLinkComponent')?.rows[0]?.target).toBe('sameWindow');
  });
});

describe('parseImpex — macros are expanded in values', () => {
  it('expands a macro used as a value', () => {
    const rows = parsed().blocks.get('ContentCatalog')?.rows ?? [];
    expect(rows.map((r) => r.id)).toEqual(['demoCatalogOne', 'demoCatalogTwo']);
  });

  it('resolves a macro whose definition contains another macro', () => {
    // $syncJob = "sync $contentCatalog:Staged->Online"
    const row = parsed().blocks.get('CatalogVersionSyncJob')?.rows[0];
    expect(row?.code).toBe('sync electronics-spaContentCatalog:Staged->Online');
    expect(row?.code).not.toContain('$');
  });
});

describe('parseImpex — unique-key columns are recorded', () => {
  it('marks the composite key of a type with no uid/code', () => {
    const cols = parsed().blocks.get('ContentSlotName')?.columns;
    expect(cols?.get('name')?.isUnique).toBe(true);
    expect(cols?.get('template')?.isUnique).toBe(true);
    expect(cols?.get('compTypeGroup')?.isUnique).toBe(false);
  });

  it('marks a lookup column as a reference and a media column as media', () => {
    const cols = parsed().blocks.get('ContentSlotForTemplate')?.columns;
    expect(cols?.get('contentSlot')?.isReference).toBe(true);
    expect(cols?.get('uid')?.isUnique).toBe(true);
    expect(parsed().blocks.get('Media')?.columns.get('code')?.isUnique).toBe(true);
  });
});

describe('parseImpexPath — folder mode', () => {
  it('parses a directory of .impex files and merges per type', () => {
    const dir = path.dirname(FIXTURE);
    const { blocks } = parseImpexPath(dir);
    expect(blocks.get('CMSParagraphComponent')?.rows).toHaveLength(3);
  });

  it('throws a clear error for a path that does not exist', () => {
    expect(() => parseImpexPath('/no/such/path.impex')).toThrow(/not found/i);
  });
});
