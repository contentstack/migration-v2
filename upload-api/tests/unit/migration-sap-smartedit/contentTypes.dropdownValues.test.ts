import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractContentTypes } from '../../../migration-sap-smartedit/index';

/**
 * A field only ever becomes a Dropdown if the user manually converts it later, in the
 * Map Content Fields UI — this connector never auto-classifies one. Its real distinct
 * source values have to be captured here at extraction time though, since this is the
 * only place every row is already being scanned; recomputing it later would mean
 * re-parsing the whole export from the UI. Capped so a genuinely free-text column
 * doesn't bloat the persisted record; the true count is kept uncapped for the >100
 * dropdown-limit check.
 */
describe('extractContentTypes — captures real distinct source values for text-like columns', () => {
  const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/dropdown-source-values.impex');
  let cts: any[] = [];

  beforeAll(async () => {
    cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
  });

  afterAll(() => {
    fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
  });

  const field = (name: string) => {
    const ct = cts.find((c) => c.otherCmsTitle === 'DropdownValuesTest');
    return ct?.fieldMapping?.find((f: any) => f.otherCmsField === name);
  };

  it('captures the distinct non-empty values for a low-cardinality column', () => {
    expect(field('status')?.advanced?.sourceDistinctValues?.sort()).toEqual(['Active', 'Inactive']);
  });

  it('excludes blank cells from the distinct set', () => {
    expect(field('status')?.advanced?.sourceDistinctValues).not.toContain('');
  });

  it('records the true distinct count separately', () => {
    expect(field('status')?.advanced?.sourceDistinctValueCount).toBe(2);
  });

  it('captures a different column\'s values independently', () => {
    expect(field('notes')?.advanced?.sourceDistinctValueCount).toBe(4);
  });

  it('does not capture distinct values for a non-text column (boolean here)', () => {
    expect(field('featured')?.contentstackFieldType).toBe('boolean');
    expect(field('featured')?.advanced?.sourceDistinctValues).toBeUndefined();
  });
});

describe('extractContentTypes — caps stored distinct values without capping the true count', () => {
  const STACK_CAP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-smartedit-dropdown-cap-'));
  const FIXTURE = path.join(STACK_CAP_DIR, 'large-cardinality.impex');
  let cts: any[] = [];

  beforeAll(async () => {
    const rows = Array.from({ length: 600 }, (_, i) => `                                 ; item${i}; Value${i}`).join('\n');
    fs.writeFileSync(
      FIXTURE,
      `$lang = en\nINSERT_UPDATE LargeCardinalityTest; uid[unique=true]; label\n${rows}\n`,
    );
    cts = (await extractContentTypes('cs', FIXTURE, {} as any)) as any[];
  });

  afterAll(() => {
    fs.rmSync(path.join(process.cwd(), 'cmsMigrationData'), { recursive: true, force: true });
    fs.rmSync(STACK_CAP_DIR, { recursive: true, force: true });
  });

  const labelField = () => {
    const ct = cts.find((c) => c.otherCmsTitle === 'LargeCardinalityTest');
    return ct?.fieldMapping?.find((f: any) => f.otherCmsField === 'label');
  };

  it('caps the stored values list at 500', () => {
    expect(labelField()?.advanced?.sourceDistinctValues?.length).toBe(500);
  });

  it('still records the true, uncapped distinct count (600)', () => {
    expect(labelField()?.advanced?.sourceDistinctValueCount).toBe(600);
  });
});
