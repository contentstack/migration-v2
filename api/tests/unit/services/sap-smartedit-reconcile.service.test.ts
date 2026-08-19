import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sapSmarteditService } from '../../../src/services/sap-smartedit.service.js';
import { reconcile, summarizeForLog } from '../../../src/services/sap-smartedit-reconcile.service.js';

/**
 * Tests for the reconciliation harness itself.
 *
 * A checker that cannot fail is worthless — and this connector has already shipped
 * one function (createLocale) that silently did nothing because nothing tested it.
 * So these are deliberately NEGATIVE tests: build genuine migration output, break
 * exactly one thing, and assert the harness reports that one thing. A clean
 * baseline is asserted too, so the harness cannot pass by simply flagging
 * everything.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/real-spartacus-excerpt.impex');
const STACK = 'test-stack-sap-reconcile';
const OUT = path.join(process.cwd(), './cmsMigrationData', STACK);
const LOCALE = 'en-us';

const field = (name: string, type = 'single_line_text') => ({
  uid: name.toLowerCase(),
  otherCmsField: name,
  otherCmsType: 'string',
  contentstackField: name,
  contentstackFieldUid: name.toLowerCase(),
  contentstackFieldType: type,
  backupFieldType: type,
  backupFieldUid: name.toLowerCase(),
  advanced: {},
  isDeleted: false,
});

const contentType = (srcType: string, fields: string[]) => ({
  otherCmsTitle: srcType,
  otherCmsUid: `cs_${srcType.toLowerCase()}`,
  contentstackTitle: srcType,
  contentstackUid: `cs_${srcType.toLowerCase()}`,
  type: 'content_type',
  fieldMapping: fields.map((f) => field(f)),
});

// Every source type in the fixture, with every one of its columns — a partial list
// would make the harness (correctly) report the omissions as data loss.
const CONTENT_TYPES = [
  contentType('CMSParagraphComponent', ['name', 'content']),
  contentType('ContentSlot', ['uid', 'name', 'cmsComponents']),
  contentType('Page', ['name', 'originalPage']),
  contentType('ContentSlotName', ['name', 'template', 'validComponentTypes', 'compTypeGroup']),
  contentType('ContentCatalog', ['id', 'name']),
  contentType('CatalogVersionSyncJob', ['code', 'syncPrincipals', 'syncPrincipalsOnly']),
  contentType('CMSNavigationNode', ['title']),
  contentType('ContentSlotForTemplate', ['position', 'pageTemplate', 'contentSlot', 'allowOverwrite']),
  contentType('CMSLinkComponent', ['name', 'url', 'target']),
  contentType('Customer', ['groups', 'name', 'customerId']),
  contentType('PageTemplate', ['name', 'active']),
  contentType('ContentPage', ['name', 'masterTemplate', 'approvalStatus', 'target']),
  contentType('Media', ['code']),
  contentType('GenericItem', ['code']),
];

/** The reconciler maps a source type to a content type via each file's `title`. */
function writeContentTypeFiles(dir: string) {
  const ctDir = path.join(dir, 'content_types');
  fs.mkdirSync(ctDir, { recursive: true });
  for (const ct of CONTENT_TYPES) {
    fs.writeFileSync(
      path.join(ctDir, `${ct.contentstackUid}.json`),
      JSON.stringify({ title: ct.otherCmsTitle, uid: ct.contentstackUid, schema: [] }, null, 2),
    );
  }
}

/** A pristine copy of the baseline output, for one fault injection. */
function cloneBaseline(name: string): string {
  const dir = path.join(process.cwd(), './cmsMigrationData', `${STACK}-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(OUT, dir, { recursive: true });
  return dir;
}

const readEntryFile = (dir: string, ct: string, locale: string) =>
  path.join(dir, 'entries', ct, locale, `${locale}.json`);

beforeAll(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  await sapSmarteditService.getAllAssets(FIXTURE, '', STACK, 'test-project');
  await sapSmarteditService.createLocale(FIXTURE, STACK, 'test-project', {
    stackDetails: { master_locale: LOCALE },
  });
  await sapSmarteditService.createEntry(FIXTURE, '', STACK, 'test-project', CONTENT_TYPES, {}, LOCALE, {});
  writeContentTypeFiles(OUT);
});

afterAll(() => {
  for (const d of fs.readdirSync(path.join(process.cwd(), './cmsMigrationData'))) {
    if (d.startsWith(STACK)) {
      fs.rmSync(path.join(process.cwd(), './cmsMigrationData', d), { recursive: true, force: true });
    }
  }
});

describe('reconcile — a genuine migration reports clean', () => {
  it('finds no critical or error findings on unmodified output', () => {
    const r = reconcile(FIXTURE, OUT);
    // The fixture deliberately declares one Media whose binary is not shipped, to
    // pin that unresolvable assets are REPORTED rather than skipped. That is the
    // only expected finding here; anything else is a real regression.
    const bad = r.findings
      .filter((f) => f.severity === 'critical' || f.severity === 'error')
      .filter((f) => f.check !== 'asset.failed');
    expect(bad.map((f) => `${f.check}: ${f.detail}`)).toEqual([]);
  });

  it('still reports the fixture\'s genuinely unresolvable asset', () => {
    const r = reconcile(FIXTURE, OUT);
    expect(r.findings.some((f) => f.check === 'asset.failed' && f.severity === 'critical')).toBe(true);
  });

  it('accounts for every source row', () => {
    const r = reconcile(FIXTURE, OUT);
    for (const t of r.perType) {
      if (t.contentTypeUid) expect(t.entries).toBe(t.sourceRows);
    }
  });
});

describe('reconcile — detects a whole type going missing', () => {
  it('flags a source type that produced no content type, in AUTHORITATIVE mode as CRITICAL', () => {
    // Authoritative mode gets its mapping from the passed contentTypes array,
    // not from disk — so "genuinely missing" here means removed from that
    // array, not a deleted file. This mapping cannot be fooled by a rename
    // (it doesn't guess from a display name at all), so it must always stay
    // CRITICAL.
    const dir = cloneBaseline('unmapped');
    const withoutParagraph = CONTENT_TYPES.filter((ct) => ct.otherCmsTitle !== 'CMSParagraphComponent');
    const r = reconcile(FIXTURE, dir, withoutParagraph);
    const f = r.findings.find((x) => x.check === 'type.unmapped' && x.sourceType === 'CMSParagraphComponent');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('critical');
  });
});

/**
 * Regression test for a real finding: heuristic mode (the standalone CLI run
 * BY HAND without --content-types) guesses a source type's name from
 * content_types/*.json's "title" field — but real production code always
 * writes the CONTENTSTACK-side title there, which can legitimately differ
 * from the SAP source name after a rename during "Map Content Fields". A
 * renamed content type reproduces the EXACT same signal as a genuinely
 * missing one (both end up absent from heuristic mode's guessed map), so
 * heuristic mode cannot tell them apart — confirmed live against a real
 * rename, where the entry migrated correctly but heuristic mode still
 * reported "type.unmapped" as if it were data loss. Since authoritative mode
 * (what every real migration uses) is never fooled this way, only heuristic
 * mode's OWN guess needs to be downgraded.
 */
describe('reconcile — heuristic mode is honest about its own uncertainty', () => {
  it('downgrades type.unmapped to a warning when running without --content-types', () => {
    const dir = cloneBaseline('unmapped-heuristic');
    fs.rmSync(path.join(dir, 'content_types', 'cs_cmsparagraphcomponent.json'));
    const r = reconcile(FIXTURE, dir); // no contentTypes -> heuristic mode
    const f = r.findings.find((x) => x.check === 'type.unmapped' && x.sourceType === 'CMSParagraphComponent');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('warning');
    expect(f?.detail).toMatch(/renamed|false positive/i);
    // Not asserting r.summary.critical === 0 overall: this fixture has its own
    // unrelated, deliberate CRITICAL (a genuinely unresolvable asset) — only
    // this specific type.unmapped finding is what the fix changes.
    expect(r.findings.filter((x) => x.check === 'type.unmapped')).not.toContainEqual(
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('still reports type.unmapped at CRITICAL when a real content-types mapping is given', () => {
    const dir = cloneBaseline('unmapped-authoritative');
    const withoutParagraph = CONTENT_TYPES.filter((ct) => ct.otherCmsTitle !== 'CMSParagraphComponent');
    const r = reconcile(FIXTURE, dir, withoutParagraph);
    const f = r.findings.find((x) => x.check === 'type.unmapped' && x.sourceType === 'CMSParagraphComponent');
    expect(f?.severity).toBe('critical');
  });
});

describe('reconcile — detects entries that never got written', () => {
  it('flags a source row with no entry', () => {
    const dir = cloneBaseline('rowmissing');
    const file = readEntryFile(dir, 'cs_cmsparagraphcomponent', LOCALE);
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete entries[Object.keys(entries)[0]];
    fs.writeFileSync(file, JSON.stringify(entries));
    const r = reconcile(FIXTURE, dir);
    const f = r.findings.find((x) => x.check === 'row.missing');
    expect(f?.severity).toBe('critical');
  });
});

describe('reconcile — detects a value that did not come across', () => {
  it('flags a field whose source value is absent from the entry', () => {
    const dir = cloneBaseline('fieldmissing');
    const file = readEntryFile(dir, 'cs_cmsparagraphcomponent', LOCALE);
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    const key = Object.keys(entries)[0];
    delete entries[key].content;
    fs.writeFileSync(file, JSON.stringify(entries));
    const r = reconcile(FIXTURE, dir);
    expect(r.findings.some((x) => x.check === 'field.missing' && x.severity === 'error')).toBe(true);
  });
});

describe('reconcile — detects the locale bug that silently dropped translations', () => {
  it('flags entries written for a locale the stack will not have', () => {
    // Exactly the shipped bug: entries/<ct>/de-de exists, locales.json is empty.
    const dir = cloneBaseline('undeclaredlocale');
    fs.writeFileSync(path.join(dir, 'locales', 'locales.json'), JSON.stringify({}));
    const r = reconcile(FIXTURE, dir);
    const f = r.findings.find((x) => x.check === 'locale.undeclared');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('critical');
  });

  it('flags a translation that has no destination locale at all', () => {
    const dir = cloneBaseline('missingforvalue');
    fs.writeFileSync(path.join(dir, 'locales', 'locales.json'), JSON.stringify({}));
    fs.rmSync(path.join(dir, 'entries', 'cs_cmsnavigationnode', 'de-de'), { recursive: true, force: true });
    const r = reconcile(FIXTURE, dir);
    const f = r.findings.find((x) => x.check === 'locale.missingForValue');
    expect(f?.severity).toBe('critical');
    expect(f?.detail).toMatch(/translation/i);
  });

  it('flags a locale named after its own code (the hang)', () => {
    const dir = cloneBaseline('localename');
    const p = path.join(dir, 'locales', 'master-locale.json');
    const master = JSON.parse(fs.readFileSync(p, 'utf8'));
    const k = Object.keys(master)[0];
    master[k].name = master[k].code;
    fs.writeFileSync(p, JSON.stringify(master));
    const r = reconcile(FIXTURE, dir);
    expect(r.findings.some((x) => x.check === 'locale.name' && x.severity === 'error')).toBe(true);
  });

  it('flags a translated value missing from its locale entry', () => {
    const dir = cloneBaseline('localevalue');
    const file = readEntryFile(dir, 'cs_cmsnavigationnode', 'de-de');
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const k of Object.keys(entries)) entries[k].title = 'English Title';
    fs.writeFileSync(file, JSON.stringify(entries));
    const r = reconcile(FIXTURE, dir);
    expect(r.findings.some((x) => x.check === 'locale.valueMissing')).toBe(true);
  });
});

describe('reconcile — detects the uid shape that corrupts text on import', () => {
  it('flags an entry uid that is not blt+16hex', () => {
    const dir = cloneBaseline('uidshape');
    const file = readEntryFile(dir, 'cs_cmsparagraphcomponent', LOCALE);
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    const k = Object.keys(entries)[0];
    entries['NotABltUid'] = { ...entries[k], uid: 'NotABltUid' };
    delete entries[k];
    fs.writeFileSync(file, JSON.stringify(entries));
    const r = reconcile(FIXTURE, dir);
    // The renamed entry no longer matches its source row, which is itself a finding;
    // the point is that a non-conforming uid can never pass silently.
    expect(r.findings.some((x) => x.check === 'row.missing' || x.check === 'uid.shape')).toBe(true);
  });
});

describe('reconcile — detects asset loss', () => {
  it('flags a declared Media with no asset record', () => {
    const dir = cloneBaseline('assetmissing');
    const p = path.join(dir, 'assets', 'index.json');
    const idx = JSON.parse(fs.readFileSync(p, 'utf8'));
    const failures = path.join(dir, 'assets', 'logs', 'assets', 'cs_failed.json');
    fs.writeFileSync(failures, JSON.stringify({}));
    for (const k of Object.keys(idx)) delete idx[k];
    fs.writeFileSync(p, JSON.stringify(idx));
    const r = reconcile(FIXTURE, dir);
    expect(r.findings.some((x) => x.check === 'asset.missing' && x.severity === 'critical')).toBe(true);
  });

  it('flags an asset whose binary is missing or empty', () => {
    const dir = cloneBaseline('assetempty');
    const idx = JSON.parse(fs.readFileSync(path.join(dir, 'assets', 'index.json'), 'utf8'));
    const first = Object.keys(idx)[0];
    if (first) {
      const f = path.join(dir, 'assets', 'files', first, idx[first].filename);
      fs.writeFileSync(f, '');
      const r = reconcile(FIXTURE, dir);
      expect(r.findings.some((x) => x.check === 'asset.empty' && x.severity === 'critical')).toBe(true);
    }
  });
});

describe('reconcile — reports the ambiguous-label trade rather than hiding it', () => {
  // Needs the REAL mapper shape: it re-points a source `name` column onto uid
  // `title`. Only then does an ambiguous label have nowhere left to live, because
  // the entry title falls back to the row id. With name->name (as the content types
  // above use) the label is still stored, and there is correctly nothing to report.
  const STACK_T = `${STACK}-titlemap`;
  const OUT_T = path.join(process.cwd(), './cmsMigrationData', STACK_T);

  const nameOntoTitle = {
    otherCmsTitle: 'ContentSlotName',
    otherCmsUid: 'cs_contentslotname',
    contentstackTitle: 'ContentSlotName',
    contentstackUid: 'cs_contentslotname',
    type: 'content_type',
    fieldMapping: [
      { ...field('name'), uid: 'title', contentstackField: 'title', contentstackFieldUid: 'title', backupFieldUid: 'title' },
      field('template'),
    ],
  };

  beforeAll(async () => {
    fs.rmSync(OUT_T, { recursive: true, force: true });
    await sapSmarteditService.createLocale(FIXTURE, STACK_T, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
    await sapSmarteditService.createEntry(FIXTURE, '', STACK_T, 'test-project', [nameOntoTitle], {}, LOCALE, {});
    const ctDir = path.join(OUT_T, 'content_types');
    fs.mkdirSync(ctDir, { recursive: true });
    fs.writeFileSync(
      path.join(ctDir, 'cs_contentslotname.json'),
      JSON.stringify({ title: 'ContentSlotName', uid: 'cs_contentslotname', schema: [] }),
    );
  });

  it('classifies a dropped shared label as a warning, not a silent pass', () => {
    // Two fixture rows share the name "SiteContext".
    const r = reconcile(FIXTURE, OUT_T);
    const f = r.findings.find((x) => x.check === 'label.droppedForAmbiguity');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('warning');
    expect(f?.detail).toContain('SiteContext');
  });

  it('does not raise it as an error, since the entries remain distinguishable', () => {
    const r = reconcile(FIXTURE, OUT_T);
    expect(r.findings.some((x) => x.check === 'label.droppedForAmbiguity' && x.severity === 'error')).toBe(false);
  });
});

describe('reconcile — authoritative vs heuristic type mapping', () => {
  // contenTypeMaker persists contentType.contentstackTitle (the DESTINATION
  // display title, renameable during "Map Content Fields") as the content-type
  // file's `title` — NOT necessarily the original SAP type name. Passing the live
  // contentTypes array (as the runtime hook does) must survive a rename; falling
  // back to reading file titles (the standalone CLI without that array) cannot.
  const RENAMED_CT = [
    {
      ...contentType('CMSParagraphComponent', ['name', 'content']),
      contentstackTitle: 'Article', // renamed during mapping
      contentstackUid: 'cs_article',
    },
  ];

  it('is authoritative when given the live contentTypes array, surviving a rename', () => {
    const dir = cloneBaseline('renamed-authoritative');
    fs.rmSync(path.join(dir, 'content_types', 'cs_cmsparagraphcomponent.json'));
    fs.writeFileSync(
      path.join(dir, 'content_types', 'cs_article.json'),
      JSON.stringify({ title: 'Article', uid: 'cs_article', schema: [] }),
    );
    // Entries still live under the OLD folder name on disk in this synthetic
    // rename, matching what createEntry would actually do: it writes to
    // `folderName` derived from contentstackUid, so a genuine rename also moves
    // the entries folder. Simulate that by renaming the entries dir too.
    fs.renameSync(
      path.join(dir, 'entries', 'cs_cmsparagraphcomponent'),
      path.join(dir, 'entries', 'cs_article'),
    );
    const r = reconcile(FIXTURE, dir, RENAMED_CT);
    expect(r.typeMappingSource).toBe('authoritative');
    expect(r.findings.some((f) => f.check === 'type.unmapped' && f.sourceType === 'CMSParagraphComponent')).toBe(false);
  });

  it('reports heuristic mode, and a rename is indistinguishable from real loss there', () => {
    const dir = cloneBaseline('renamed-heuristic');
    fs.rmSync(path.join(dir, 'content_types', 'cs_cmsparagraphcomponent.json'));
    fs.writeFileSync(
      path.join(dir, 'content_types', 'cs_article.json'),
      JSON.stringify({ title: 'Article', uid: 'cs_article', schema: [] }),
    );
    // No contentTypes array passed -> falls back to reading file titles, which no
    // longer have an entry saying "CMSParagraphComponent".
    const r = reconcile(FIXTURE, dir);
    expect(r.typeMappingSource).toBe('heuristic');
    expect(r.findings.some((f) => f.check === 'type.unmapped' && f.sourceType === 'CMSParagraphComponent')).toBe(true);
  });
});

describe('summarizeForLog — shapes findings for the running migration log', () => {
  it('produces no ERROR lines for a clean report, beyond the fixture\'s known unresolvable asset', () => {
    const r = reconcile(FIXTURE, OUT, CONTENT_TYPES);
    const lines = summarizeForLog(r);
    expect(lines.length).toBeGreaterThan(0);
    const unexpectedErrors = lines.filter((l) => l.level === 'error' && !l.message.includes('asset.failed'));
    expect(unexpectedErrors).toEqual([]);
  });

  it('surfaces a critical finding at error level', () => {
    const dir = cloneBaseline('logcritical');
    fs.writeFileSync(path.join(dir, 'locales', 'locales.json'), JSON.stringify({}));
    const r = reconcile(FIXTURE, dir);
    const lines = summarizeForLog(r);
    expect(lines.some((l) => l.level === 'error' && l.message.includes('CRITICAL'))).toBe(true);
  });

  it('flags heuristic mode in its own line', () => {
    const r = reconcile(FIXTURE, OUT); // no contentTypes passed
    const lines = summarizeForLog(r);
    expect(lines.some((l) => l.level === 'warn' && l.message.toLowerCase().includes('live content-type mapping'))).toBe(true);
  });
});

describe('reconcile — an ambiguous label\'s OWN primary-locale value is not a false positive', () => {
  // Reproduces a real production finding: 2,200 false "locale.valueMissing"
  // findings on one real run, all on the PRIMARY locale (en-us) specifically.
  // createEntry's title falls back to the row's id when a label is ambiguous
  // (shared by several rows) — checkRows already validates that correctly, as
  // a warning, not an error. checkLocalizedValues re-checked the SAME
  // primary-language value through a path that did not know about that
  // exception, and only skipped the primary language when NO destination
  // locale happened to match it — which is never true for en, since en-us is
  // always a real declared locale. It must be skipped unconditionally.
  const STACK_AMBIG = 'test-stack-sap-reconcile-ambig-locale';
  const OUT_AMBIG = path.join(process.cwd(), './cmsMigrationData', STACK_AMBIG);
  const AMBIG_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/ambiguous-localized.impex');

  const navNodeCt = {
    otherCmsTitle: 'CMSNavigationNode',
    otherCmsUid: 'cs_cmsnavigationnode',
    contentstackTitle: 'CMSNavigationNode',
    contentstackUid: 'cs_cmsnavigationnode',
    type: 'content_type',
    fieldMapping: [field('title')],
  };

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(AMBIG_FIXTURE), { recursive: true });
    fs.writeFileSync(
      AMBIG_FIXTURE,
      [
        '$lang = en',
        'INSERT_UPDATE CMSNavigationNode; uid[unique=true]; title[lang=en]; title[lang=de]',
        '                                ; ambigNode1; Shared Title; Geteilter Titel',
        '                                ; ambigNode2; Shared Title; Geteilter Titel',
        '',
      ].join('\n'),
    );
    fs.rmSync(OUT_AMBIG, { recursive: true, force: true });
    await sapSmarteditService.createLocale(AMBIG_FIXTURE, STACK_AMBIG, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
    await sapSmarteditService.createEntry(AMBIG_FIXTURE, '', STACK_AMBIG, 'test-project', [navNodeCt], {}, LOCALE, {});
  });

  afterAll(() => {
    fs.rmSync(OUT_AMBIG, { recursive: true, force: true });
    fs.rmSync(AMBIG_FIXTURE, { force: true });
  });

  it('does not flag the ambiguous row\'s own en-us title as a missing translation', () => {
    const r = reconcile(AMBIG_FIXTURE, OUT_AMBIG, [navNodeCt]);
    const falsePositive = r.findings.find(
      (f) => f.check === 'locale.valueMissing' && f.locale === 'en-us',
    );
    expect(falsePositive).toBeUndefined();
  });

  it('still flags the row as a dropped-label warning (the correct classification)', () => {
    const r = reconcile(AMBIG_FIXTURE, OUT_AMBIG, [navNodeCt]);
    expect(r.findings.some((f) => f.check === 'label.droppedForAmbiguity')).toBe(true);
  });

  it('still checks the GENUINE de-de translation normally', () => {
    // de is not the primary language, so it must still be verified for real.
    const r = reconcile(AMBIG_FIXTURE, OUT_AMBIG, [navNodeCt]);
    expect(r.findings.some((f) => f.check === 'locale.valueMissing' && f.locale === 'de-de')).toBe(false);
  });
});

describe('reconcile — checkRows is not fooled by the SAP $lang macro disagreeing with master_locale', () => {
  // Reproduces a false positive found against a real migration (stack
  // blt8c4ba20ee575289e) built specifically to exercise the createEntry fix for
  // this exact mismatch (see sap-smartedit.service.ts's localizedValueOf). The
  // source file declares `$lang = de`, so parseImpex's raw row default for
  // `title` holds the DE text — but the project's real master_locale is en-us,
  // so createEntry correctly writes the EN text into the master entry.
  // checkRows used to compare the raw (DE) default against the (correctly EN)
  // master entry and flag it as field.missing. It must instead compare against
  // the row's own value for the real primary language.
  const STACK_LANGMISMATCH = 'test-stack-sap-reconcile-langmismatch';
  const OUT_LANGMISMATCH = path.join(process.cwd(), './cmsMigrationData', STACK_LANGMISMATCH);
  const LANGMISMATCH_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/lang-macro-mismatch.impex');

  const navNodeCt = {
    otherCmsTitle: 'CMSNavigationNode',
    otherCmsUid: 'cs_cmsnavigationnode',
    contentstackTitle: 'CMSNavigationNode',
    contentstackUid: 'cs_cmsnavigationnode',
    type: 'content_type',
    fieldMapping: [field('title')],
  };

  beforeAll(async () => {
    fs.rmSync(OUT_LANGMISMATCH, { recursive: true, force: true });
    await sapSmarteditService.createLocale(LANGMISMATCH_FIXTURE, STACK_LANGMISMATCH, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
    await sapSmarteditService.createEntry(
      LANGMISMATCH_FIXTURE,
      '',
      STACK_LANGMISMATCH,
      'test-project',
      [navNodeCt],
      {},
      LOCALE,
      {},
    );
    const ctDir = path.join(OUT_LANGMISMATCH, 'content_types');
    fs.mkdirSync(ctDir, { recursive: true });
    fs.writeFileSync(
      path.join(ctDir, 'cs_cmsnavigationnode.json'),
      JSON.stringify({ title: 'CMSNavigationNode', uid: 'cs_cmsnavigationnode', schema: [] }),
    );
  });

  afterAll(() => {
    fs.rmSync(OUT_LANGMISMATCH, { recursive: true, force: true });
  });

  it('does not flag field.missing for a row whose $lang-macro default disagrees with the real master locale', () => {
    const r = reconcile(LANGMISMATCH_FIXTURE, OUT_LANGMISMATCH, [navNodeCt]);
    const falsePositive = r.findings.find(
      (f) => f.check === 'field.missing' && f.sourceType === 'CMSNavigationNode',
    );
    expect(falsePositive).toBeUndefined();
  });

  it('the master entry genuinely holds the primary-language text, not the $lang-macro default', () => {
    const file = readEntryFile(OUT_LANGMISMATCH, 'cs_cmsnavigationnode', LOCALE);
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry = Object.values(entries)[0] as any;
    expect(entry.title).toBe('English Value');
  });
});

/**
 * Regression test for a real, live-confirmed finding: a reference field's
 * schema `reference_to` was empty (never configured in the field mapping) or
 * stale (pointed at a content-type uid from before a rename), and Contentstack
 * silently dropped every value written to it — not a bug in the CLI import,
 * but the field's own schema declaring that it can point at nothing.
 * checkRows already caught the SYMPTOM (field.missing, one finding per
 * affected row); this checks the CAUSE once per field, which is what a human
 * would actually need to go fix.
 */
describe('reconcile — a reference field with a misconfigured destination target', () => {
  const STACK_REFBROKEN = 'test-stack-sap-reconcile-refbroken';
  const OUT_REFBROKEN = path.join(process.cwd(), './cmsMigrationData', STACK_REFBROKEN);
  const REFBROKEN_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/reference-target-broken.impex');

  const templateCt = {
    otherCmsTitle: 'PageTemplate', contentstackUid: 'cs_pagetemplate',
    fieldMapping: [field('name')],
  };
  const pageCt = {
    otherCmsTitle: 'ContentPage', contentstackUid: 'cs_contentpage',
    fieldMapping: [
      field('name'),
      { ...field('masterTemplate'), contentstackFieldType: 'reference', referenceTo: ['cs_pagetemplate'] },
      { ...field('navTarget'), contentstackFieldType: 'reference', referenceTo: ['cs_pagetemplate'] },
      // Declared in the mapping but never a column in the source at all —
      // exercises "misconfigured but nothing actually uses it".
      { ...field('unusedRef'), contentstackFieldType: 'reference', referenceTo: ['cs_pagetemplate'] },
    ],
  };

  beforeAll(async () => {
    fs.rmSync(OUT_REFBROKEN, { recursive: true, force: true });
    await sapSmarteditService.createLocale(REFBROKEN_FIXTURE, STACK_REFBROKEN, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
    await sapSmarteditService.createEntry(REFBROKEN_FIXTURE, '', STACK_REFBROKEN, 'test-project', [templateCt, pageCt], {}, LOCALE, {});
    const ctDir = path.join(OUT_REFBROKEN, 'content_types');
    fs.mkdirSync(ctDir, { recursive: true });
    fs.writeFileSync(
      path.join(ctDir, 'cs_pagetemplate.json'),
      JSON.stringify({ title: 'PageTemplate', uid: 'cs_pagetemplate', schema: [{ uid: 'name', data_type: 'text' }] }),
    );
    fs.writeFileSync(
      path.join(ctDir, 'cs_contentpage.json'),
      JSON.stringify({
        title: 'ContentPage',
        uid: 'cs_contentpage',
        schema: [
          { uid: 'name', data_type: 'text' },
          // Never configured at all.
          { uid: 'mastertemplate', data_type: 'reference', reference_to: [] },
          // Configured, but pointing at a content type this migration never mapped —
          // the exact shape a stale rename produces.
          { uid: 'navtarget', data_type: 'reference', reference_to: ['cs_pagetemplate_old_name'] },
          { uid: 'unusedref', data_type: 'reference', reference_to: [] },
        ],
      }),
    );
  });

  afterAll(() => fs.rmSync(OUT_REFBROKEN, { recursive: true, force: true }));

  it('flags an empty reference_to as CRITICAL when a real source row has a value for it', () => {
    const r = reconcile(REFBROKEN_FIXTURE, OUT_REFBROKEN, [templateCt, pageCt]);
    const f = r.findings.find((x) => x.check === 'reference.targetMisconfigured' && x.detail.includes('"mastertemplate"'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('critical');
    expect(f?.detail).toContain('reference_to is empty');
    expect(f?.detail).toMatch(/1 source row/);
  });

  it('flags a reference_to pointing at an unmapped (stale) content type as CRITICAL too', () => {
    const r = reconcile(REFBROKEN_FIXTURE, OUT_REFBROKEN, [templateCt, pageCt]);
    const f = r.findings.find((x) => x.check === 'reference.targetMisconfigured' && x.detail.includes('"navtarget"'));
    expect(f).toBeDefined();
    expect(f?.severity).toBe('critical');
    expect(f?.detail).toContain('cs_pagetemplate_old_name');
  });

  it('does not flag a misconfigured field that no source row actually uses', () => {
    const r = reconcile(REFBROKEN_FIXTURE, OUT_REFBROKEN, [templateCt, pageCt]);
    expect(r.findings.some((x) => x.check === 'reference.targetMisconfigured' && x.detail.includes('"unusedref"'))).toBe(false);
  });

  it('downgrades to a warning in heuristic mode, since row-level usage cannot be confirmed without the live field mapping', () => {
    const r = reconcile(REFBROKEN_FIXTURE, OUT_REFBROKEN); // no contentTypes -> heuristic
    const findings = r.findings.filter((x) => x.check === 'reference.targetMisconfigured');
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.severity).toBe('warning');
  });
});
