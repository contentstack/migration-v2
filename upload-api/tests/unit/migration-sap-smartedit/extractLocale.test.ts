import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import extractLocale from '../../../migration-sap-smartedit/libs/extractLocale';

/**
 * Real per-field multi-locale discovery, pinned against the shared SAP fixture.
 * The fixture declares no `$lang` macro, and its CMSNavigationNode block carries
 * `title[lang=en]` + `title[lang=de]` with genuinely different values.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/real-spartacus-excerpt.impex');

describe('extractLocale — real multi-locale discovery', () => {
  it('defaults the primary locale to en-us when no $lang macro is declared', async () => {
    const locales = await extractLocale(FIXTURE);
    expect(locales[0]).toBe('en-us');
  });

  it('discovers an additional locale from a genuinely localized column', async () => {
    // title[lang=de] appears nowhere near a $lang macro — it must still surface here,
    // or that content would silently import only into the master locale.
    const locales = await extractLocale(FIXTURE);
    expect(locales).toContain('de-de');
  });

  it('does not duplicate the primary locale in the "others" list', async () => {
    const locales = await extractLocale(FIXTURE);
    expect(locales.filter((l) => l === 'en-us')).toHaveLength(1);
  });

  it('maps an unrecognised SAP language code to a best-effort <code>-<code> guess', async () => {
    // Exercises the LOCALE_MAP fallback path directly, rather than depending on a
    // specific unmapped language happening to appear in the shared fixture.
    const tmp = path.join(os.tmpdir(), `extractLocale-fallback-${Date.now()}.impex`);
    fs.writeFileSync(
      tmp,
      "INSERT_UPDATE CMSNavigationNode;uid[unique=true];title[lang=xx]\n;n1;Some Value\n",
      'utf8',
    );
    try {
      const locales = await extractLocale(tmp);
      expect(locales).toContain('xx-xx');
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});
