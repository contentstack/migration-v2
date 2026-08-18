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

  beforeAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'en-us'), { recursive: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'de-de'), { recursive: true });
    fs.mkdirSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'fr-fr'), { recursive: true });
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'en-us', 'en-us.json'), '{"a":1}');
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'de-de', 'de-de.json'), '{"a":1}');
    fs.writeFileSync(path.join(SOURCE, 'entries', 'cs_contentpage', 'fr-fr', 'fr-fr.json'), '{"a":1}');

    // The CLI's own mapper only ever got as far as en-us and de-de — exactly the
    // real-world symptom (fr-fr silently never attempted).
    fs.mkdirSync(path.join(BACKUP, 'mapper', 'entries', 'cs_contentpage', 'en-us'), { recursive: true });
    fs.mkdirSync(path.join(BACKUP, 'mapper', 'entries', 'cs_contentpage', 'de-de'), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it('flags a locale the CLI never wrote a mapper folder for', () => {
    const missing = findIncompleteLocalePairs(SOURCE, BACKUP);
    expect(missing).toEqual([{ type: 'cs_contentpage', locale: 'fr-fr' }]);
  });

  it('reports nothing missing once the CLI catches up', () => {
    fs.mkdirSync(path.join(BACKUP, 'mapper', 'entries', 'cs_contentpage', 'fr-fr'), { recursive: true });
    expect(findIncompleteLocalePairs(SOURCE, BACKUP)).toEqual([]);
  });

  it('does not flag a locale folder that has no actual entries to import', () => {
    const dir = path.join(ROOT, 'source2');
    fs.mkdirSync(path.join(dir, 'entries', 'cs_media', 'es-es'), { recursive: true });
    // es-es folder exists but is empty — nothing was ever supposed to be imported here.
    const missing = findIncompleteLocalePairs(dir, BACKUP);
    expect(missing).toEqual([]);
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
