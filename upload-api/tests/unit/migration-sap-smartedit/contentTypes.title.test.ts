import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';

/**
 * Regression: ensureMandatoryFields only moved a synthesized title field to the front of
 * fieldMapping — when an EXISTING source column (e.g. "name") was repurposed as title
 * instead, it stayed wherever it originally appeared in the header, and kept whatever
 * field type it had classified as (e.g. multi_line_text for a long value), instead of
 * being locked to single_line_text like QA requires.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/title-reposition.impex');

let cts: any[] = [];

beforeAll(async () => {
  cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
});

afterAll(() => {
  fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
});

describe('ensureMandatoryFields — a repurposed title field is repositioned and type-locked', () => {
  it('moves the repurposed title field to the front of fieldMapping', () => {
    const ct = cts.find((c) => c.otherCmsTitle === 'TitleRepositionTest');
    expect(ct?.fieldMapping?.[0]?.contentstackFieldUid).toBe('title');
  });

  it('repurposes the "name" column (not a synthesized field) as title', () => {
    const ct = cts.find((c) => c.otherCmsTitle === 'TitleRepositionTest');
    const titleField = ct?.fieldMapping?.find((f: any) => f.contentstackFieldUid === 'title');
    expect(titleField?.otherCmsField).toBe('name');
  });

  it('locks the repurposed title field to single_line_text, even though its long value would otherwise classify as multi_line_text', () => {
    const ct = cts.find((c) => c.otherCmsTitle === 'TitleRepositionTest');
    const titleField = ct?.fieldMapping?.find((f: any) => f.contentstackFieldUid === 'title');
    expect(titleField?.contentstackFieldType).toBe('single_line_text');
    expect(titleField?.backupFieldType).toBe('single_line_text');
  });

  it('still marks the title field mandatory', () => {
    const ct = cts.find((c) => c.otherCmsTitle === 'TitleRepositionTest');
    const titleField = ct?.fieldMapping?.find((f: any) => f.contentstackFieldUid === 'title');
    expect(titleField?.advanced?.mandatory).toBe(true);
  });
});
