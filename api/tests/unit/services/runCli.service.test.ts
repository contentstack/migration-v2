import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { writeFastImportConfig, findIncompleteLocalePairs } from '../../../src/services/runCli.service.js';

/**
 * Regression tests for a real production finding: `@contentstack/cli-cm-import`
 * exits with code 0 after ONE invocation regardless of whether every
 * (content type, locale) pair actually got imported. On a real 10k-row / 4-locale
 * run, the CLI's own mapper folder showed fr-fr/es-es were never even attempted
 * for every large content type, while our wrapper logged "Migration Process
 * Completed" anyway — a silent ~50% data loss with no error anywhere.
 * findIncompleteLocalePairs is the completeness check that must catch this
 * before the wrapper is allowed to call the import done.
 */
describe('findIncompleteLocalePairs', () => {
  const ROOT = path.join(process.cwd(), './cmsMigrationData-test-runcli');
  const SOURCE = path.join(ROOT, 'source');
  const BACKUP = path.join(ROOT, 'backup');

  // Two source entries per locale, matching real per-entry mapper key shape
  // (keyed by source uid). "a" and "b" so a PARTIAL mapper file (only "a")
  // can be distinguished from a genuinely complete one (both).
  const OUR_ENTRIES = '{"a":1,"b":2}';

  beforeAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'en-us'), { recursive: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'de-de'), { recursive: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'fr-fr'), { recursive: true });
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'en-us', 'en-us.json'), OUR_ENTRIES);
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'de-de', 'de-de.json'), OUR_ENTRIES);
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'fr-fr', 'fr-fr.json'), OUR_ENTRIES);

    // The CLI's own mapper only ever got as far as en-us and de-de — exactly the
    // real-world symptom (fr-fr silently never attempted) — and both of THOSE
    // genuinely finished (their mapper files cover every uid we wrote).
    for (const locale of ['en-us', 'de-de']) {
      const dir = path.join(BACKUP, 'mapper', 'entries', 'cs_contentpage', locale);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'batch1-entries.json'), '{"a":{},"b":{}}');
    }
  });

  afterAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it('flags a locale the CLI never wrote a mapper folder for', () => {
    const missing = findIncompleteLocalePairs(SOURCE, BACKUP);
    expect(missing).toEqual([{ type: 'cs_contentpage', locale: 'fr-fr' }]);
  });

  it('reports nothing missing once the CLI catches up on every entry', () => {
    const dir = path.join(BACKUP, 'mapper', 'entries', 'cs_contentpage', 'fr-fr');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'batch1-entries.json'), '{"a":{},"b":{}}');
    expect(findIncompleteLocalePairs(SOURCE, BACKUP)).toEqual([]);
  });

  it('does not flag a locale folder that has no actual entries to import', () => {
    const dir = path.join(ROOT, 'source2');
    fs.mkdirSync(path.join(dir, 'entries', 'cs_media', 'es-es'), { recursive: true });
    // es-es folder exists but is empty — nothing was ever supposed to be imported here.
    const missing = findIncompleteLocalePairs(dir, BACKUP);
    expect(missing).toEqual([]);
  });

  it('still flags a locale whose mapper folder EXISTS but is missing some entries — the real bug', () => {
    // Confirmed real: a mapper directory existing only proves the CLI STARTED
    // that locale, not that it finished. A crash partway (network blip, OOM)
    // leaves a non-empty but incomplete folder — the old "does the folder
    // exist" check wrongly read this as done.
    const dir = path.join(ROOT, 'source3');
    fs.mkdirSync(path.join(dir, 'entries', 'cs_contentpage', 'es-es'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'entries', 'cs_contentpage', 'es-es', 'es-es.json'), OUR_ENTRIES);

    const backup = path.join(ROOT, 'backup-partial');
    const mapperDir = path.join(backup, 'mapper', 'entries', 'cs_contentpage', 'es-es');
    fs.mkdirSync(mapperDir, { recursive: true });
    // The CLI mapped "a" but crashed before ever reaching "b".
    fs.writeFileSync(path.join(mapperDir, 'batch1-entries.json'), '{"a":{}}');

    const missing = findIncompleteLocalePairs(dir, backup);
    expect(missing).toEqual([{ type: 'cs_contentpage', locale: 'es-es' }]);
  });

  it('aggregates entries split across multiple batch mapper files instead of only reading one', () => {
    // Real runs commonly write 2+ "<batch-id>-entries.json" files per locale
    // folder — checking only one would undercount and falsely flag as missing.
    const dir = path.join(ROOT, 'source4');
    fs.mkdirSync(path.join(dir, 'entries', 'cs_contentpage', 'es-es'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'entries', 'cs_contentpage', 'es-es', 'es-es.json'), OUR_ENTRIES);

    const backup = path.join(ROOT, 'backup-split');
    const mapperDir = path.join(backup, 'mapper', 'entries', 'cs_contentpage', 'es-es');
    fs.mkdirSync(mapperDir, { recursive: true });
    fs.writeFileSync(path.join(mapperDir, 'batch1-entries.json'), '{"a":{}}');
    fs.writeFileSync(path.join(mapperDir, 'batch2-entries.json'), '{"b":{}}');

    expect(findIncompleteLocalePairs(dir, backup)).toEqual([]);
  });
});

describe('writeFastImportConfig', () => {
  const BACKUP = path.join(process.cwd(), './cmsMigrationData-test-runcli-config');

  afterAll(() => {
    fs.rmSync(BACKUP, { recursive: true, force: true });
  });

  it('raises concurrency well above the CLI\'s ultra-conservative default of 1', () => {
    const configPath = writeFastImportConfig(BACKUP);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.concurrency).toBeGreaterThan(1);
    expect(config.importConcurrency).toBeGreaterThan(1);
    expect(config.writeConcurrency).toBeGreaterThan(1);
  });
});
