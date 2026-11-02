import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';

/**
 * The api titles an entry by its source id when the label is blank or shared, which
 * overwrote the only copy of the SAP label (two nav nodes titled "Accessories" lost
 * it). Types where that fallback can happen keep the label in its own field.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit-source-label/nav-node-label.impex');

let cts: any[] = [];
const fields = (type: string) => cts.find((c) => c.otherCmsTitle === type)?.fieldMapping ?? [];

beforeAll(async () => {
  cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
});

afterAll(() => {
  fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
});

describe('keepSourceLabel — the label survives a title that falls back to the id', () => {
  it('adds source_title, read from the title column, when labels are shared or blank', () => {
    const f = fields('CMSNavigationNode').find((x: any) => x.contentstackFieldUid === 'source_title');
    expect(f?.otherCmsField).toBe('title');
    expect(f?.contentstackFieldType).toBe('single_line_text');
  });

  it('keeps title itself mapped to the same column', () => {
    expect(fields('CMSNavigationNode').find((x: any) => x.contentstackFieldUid === 'title')?.otherCmsField).toBe('title');
  });

  it('adds nothing when the type has no label column (title is synthesized)', () => {
    expect(fields('CMSNavigationEntry').some((x: any) => x.contentstackFieldUid.startsWith('source_'))).toBe(false);
  });

  it('adds nothing when every label is present and unique', () => {
    expect(fields('CMSParagraphComponent').some((x: any) => x.contentstackFieldUid.startsWith('source_'))).toBe(false);
  });
});
