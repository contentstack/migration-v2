import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';

/**
 * Regression tests for reference-target INFERENCE: a reference field's real
 * destination type(s) are now derived from what its values actually point
 * at (which SAP type declares the referenced id), not only from the small
 * hardcoded REF_TARGETS table keyed by column name.
 *
 * Why this matters: REF_TARGETS only ever knew about 4 column names.
 * `masterTemplate`, `cmsComponents`, `item`, `pageTemplate`, and
 * `simpleCMSComponents` were NEVER in it, so those reference fields were
 * always left with no destination at all — Contentstack then had no target
 * to resolve them against, so every value silently failed to import. This
 * was found live: a real migration's ContentPage.masterTemplate field had a
 * genuine, correct value in the connector's own local staging data, but was
 * completely absent from the real, imported Contentstack entry.
 */
const FIXTURE_DIR = path.join(__dirname, '../../fixtures/sap-smartedit');
const REAL_FIXTURE = path.join(FIXTURE_DIR, 'real-spartacus-excerpt.impex');

let cts: any[] = [];

const fieldOf = (type: string, sourceField: string) =>
  cts.find((c) => c.otherCmsTitle === type)?.fieldMapping?.find((f: any) => f.otherCmsField === sourceField);

beforeAll(async () => {
  cts = (await extractContentTypes('cs', REAL_FIXTURE, {} as any)) as any[];
});

afterAll(() => {
  fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
});

describe('reference target inference — a field NEVER in REF_TARGETS', () => {
  it('infers masterTemplate\'s target from what its values actually resolve to (PageTemplate)', () => {
    // masterTemplate is not, and never was, a REF_TARGETS key — before this
    // fix, this field's refrenceTo was always undefined, guaranteeing
    // Contentstack could never accept a value for it.
    const field = fieldOf('ContentPage', 'masterTemplate');
    expect(field?.contentstackFieldType).toBe('reference');
    expect(field?.refrenceTo).toEqual(['cs_pagetemplate']);
  });
});

describe('reference target inference — a genuinely polymorphic column', () => {
  it('infers EVERY distinct type cmsComponents actually resolves to, not just one', () => {
    // The fixture's MixedTypeSlot references PageNotFoundParagraphComponent
    // (a CMSParagraphComponent) AND CartLink (a CMSLinkComponent) — a real
    // mixed-type slot, not a hypothetical.
    const field = fieldOf('ContentSlot', 'cmsComponents');
    expect(field?.contentstackFieldType).toBe('reference');
    expect(field?.refrenceTo?.sort()).toEqual(['cs_cmslinkcomponent', 'cs_cmsparagraphcomponent']);
  });
});

describe('reference target inference — falls back to REF_TARGETS when the data alone cannot answer', () => {
  it('still resolves "template" via REF_TARGETS when its destination type\'s rows live outside this export', () => {
    // ContentSlotName.template points at a PageTemplate that isn't declared
    // anywhere in this particular fixture — inference has nothing to go on,
    // so this only works AT ALL because of the REF_TARGETS fallback.
    const field = fieldOf('ContentSlotName', 'template');
    expect(field?.contentstackFieldType).toBe('reference');
    expect(field?.refrenceTo).toEqual(['cs_pagetemplate']);
  });
});

describe('reference target inference — genuinely unresolvable columns are not forced into references', () => {
  it('classifies a column with neither resolvable data nor a REF_TARGETS entry as text, preserving its value instead of an unresolvable reference', () => {
    // originalPage has no REF_TARGETS entry, and this fixture's Page rows
    // don't declare an id its values would resolve against — by design this
    // must fall through to plain text (keeping the real value) rather than
    // become a reference field with nothing to point at.
    const field = fieldOf('Page', 'originalPage');
    expect(field?.contentstackFieldType).not.toBe('reference');
    expect(field?.refrenceTo).toBeUndefined();
  });
});
