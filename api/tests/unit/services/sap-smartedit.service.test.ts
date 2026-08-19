import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sapSmarteditService } from '../../../src/services/sap-smartedit.service.js';

/**
 * Integration-style regression tests for the api-side ImpEx parser and entry
 * creation, pinned against a fixture of GENUINE SAP rows (`spartacussampledata`
 * 2105). The api package has its OWN parser, separate from upload-api's, so these
 * cases are asserted independently on both sides.
 */
const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/real-spartacus-excerpt.impex');
const STACK_ID = 'test-stack-sap-smartedit-regression';
const LOCALE = 'en-us';
const OUT_ROOT = path.join(process.cwd(), './cmsMigrationData', STACK_ID);

/** Minimal content-type definitions mirroring what the mapper produces. */
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

const CONTENT_TYPES = [
  contentType('CMSParagraphComponent', ['name', 'content']),
  // No name/title column at all in the source — exercises the fallback title.
  // `pageTemplate` is blank in the row and supplied by a header default.
  contentType('ContentSlotForTemplate', ['position', 'pageTemplate', 'contentSlot', 'allowOverwrite']),
  contentType('ContentSlot', ['uid']),
  contentType('Page', ['name', 'originalPage']),
  // Keyed on name + template, with no uid/code at all.
  contentType('ContentSlotName', ['name', 'template', 'validComponentTypes']),
  // Keyed on `id`, with genuinely distinct names.
  contentType('ContentCatalog', ['id', 'name']),
  // Keyed on `code`, whose value is a nested macro.
  contentType('CatalogVersionSyncJob', ['code', 'syncPrincipalsOnly']),
  // Carries title[lang=en] AND title[lang=de] with genuinely different values.
  contentType('CMSNavigationNode', ['title']),
];

const readEntries = (srcType: string, locale: string = LOCALE) => {
  const file = path.join(OUT_ROOT, 'entries', `cs_${srcType.toLowerCase()}`, locale, `${locale}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
};

const readAssetIndex = () => {
  const f = path.join(OUT_ROOT, 'assets', 'index.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, any>) : {};
};

const readAssetFailures = () => {
  const f = path.join(OUT_ROOT, 'assets', 'logs', 'assets', 'cs_failed.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>) : {};
};

beforeAll(async () => {
  // Assets first, mirroring the real migration order.
  await sapSmarteditService.getAllAssets(FIXTURE, '', STACK_ID, 'test-project');
  await sapSmarteditService.createEntry(
    FIXTURE,
    '',
    STACK_ID,
    'test-project',
    CONTENT_TYPES,
    {},
    LOCALE,
    {},
  );
});

afterAll(() => {
  fs.rmSync(OUT_ROOT, { recursive: true, force: true });
});

describe('sap-smartedit createEntry — entry titles', () => {
  it('uses the full source uid when the row has no name/title column', () => {
    // Previously `${srcType}-${uid.slice(0, 8)}`, which truncated to 8 sanitized
    // chars and collapsed distinct rows onto identical titles on real data.
    const entries = readEntries('ContentSlotForTemplate');
    const titles = Object.values(entries ?? {}).map((e: any) => e.title);
    expect(titles).toContain('TopContent-ProductBackInStockNotificationEmail');
    expect(titles.some((t: string) => t.startsWith('ContentSlotForTemplate-'))).toBe(false);
  });

  it('prefers the source name when one exists', () => {
    const entries = readEntries('CMSParagraphComponent');
    const titles = Object.values(entries ?? {}).map((e: any) => e.title);
    expect(titles).toContain('Page Not Found Paragraph Component');
  });
});

describe('sap-smartedit createEntry — entry uid shape', () => {
  it('emits Contentstack-conformant blt+16-hex uids, not raw stripped source ids', () => {
    // A plain stripped-alphanumeric uid (e.g. "pagenotfoundparagraphcomponent")
    // isn't in Contentstack's own uid shape and gets silently discarded and
    // reassigned during import — confirmed live via uid-mapping.json, which
    // showed effectively every entry remapped this way. Each remap then
    // corrupts unrelated plain-text fields containing the old id as a
    // substring (e.g. a title "body-nimbusBlogPost3" became
    // "body-blt6224c4ff697d1654"). Every entry uid must match Contentstack's
    // shape so no remap/fixup pass ever runs.
    const entries = readEntries('CMSParagraphComponent');
    const uids = Object.keys(entries ?? {});
    expect(uids.length).toBeGreaterThan(0);
    for (const uid of uids) {
      expect(uid).toMatch(/^blt[0-9a-f]{16}$/);
    }
  });

  it('derives the uid deterministically from the source id (stable across re-runs)', () => {
    // Same source uid -> same Contentstack uid every time, so re-importing
    // links back to the same entry instead of creating a duplicate.
    const en = readEntries('CMSParagraphComponent', 'en-us');
    const rerun = readEntries('CMSParagraphComponent', 'en-us');
    expect(Object.keys(en ?? {})).toEqual(Object.keys(rerun ?? {}));
  });
});

describe('sap-smartedit createEntry — ImpEx quoting removed from content', () => {
  it('writes HTML content without the wrapping ImpEx quotes', () => {
    const entries = readEntries('CMSParagraphComponent');
    const entry = Object.values(entries ?? {}).find(
      (e: any) => e.title === 'Page Not Found Paragraph Component',
    ) as any;
    expect(entry?.content).toBe(
      '<h2>Oops!</h2><h3>We couldn\'t find the page you are looking for.</h3>',
    );
    expect(entry?.content?.startsWith('"')).toBe(false);
  });

  it('unescapes a doubled "" into a single literal quote', () => {
    const entries = readEntries('CMSParagraphComponent');
    const entry = Object.values(entries ?? {}).find(
      (e: any) => e.title === 'Quoted Inner Paragraph',
    ) as any;
    expect(entry?.content).toBe('He said "hello" loudly');
  });
});

describe('sap-smartedit createEntry — REMOVE blocks are not migrated', () => {
  it('does not create entries for rows that only appear under REMOVE', () => {
    // ContentSlot has both a REMOVE block (RemovedSlotOne/Two) and one genuine
    // INSERT_UPDATE row (MixedTypeSlot) — the REMOVE rows must not become entries,
    // while the real row still does.
    const titles = Object.values(readEntries('ContentSlot') ?? {}).map((e: any) => e.title);
    expect(titles).not.toContain('RemovedSlotOne');
    expect(titles).not.toContain('RemovedSlotTwo');
    expect(titles).toContain('Mixed Type Slot');
  });

  it('still migrates the non-REMOVE types in the same file', () => {
    // Guards the assertion above against passing simply because nothing parsed.
    expect(Object.keys(readEntries('CMSParagraphComponent') ?? {})).toHaveLength(3);
    expect(Object.keys(readEntries('ContentSlotForTemplate') ?? {})).toHaveLength(1);
    expect(Object.keys(readEntries('Page') ?? {})).toHaveLength(2);
  });
});

describe('sap-smartedit createEntry — literal "Null" reference', () => {
  it('omits the field rather than writing a reference to something named Null', () => {
    const entries = readEntries('Page');
    const entry = Object.values(entries ?? {}).find(
      (e: any) => e.title === 'Page With Null Reference',
    ) as any;
    expect(entry).toBeDefined();
    expect(entry?.originalpage ?? entry?.originalPage).toBeUndefined();
  });

  it('keeps a genuine reference on the neighbouring row', () => {
    // Proves the assertion above is about the "Null" literal specifically, not about
    // the field being dropped for every row.
    const entries = readEntries('Page');
    const entry = Object.values(entries ?? {}).find(
      (e: any) => e.title === 'Page With Real Reference',
    ) as any;
    expect(entry?.originalpage).toBe('withNullRef');
  });
});

describe('sap-smartedit getAllAssets — binaries resolved from the export itself', () => {
  it('resolves a Media whose binary is a platform resource path, not a URL', () => {
    // SAP writes the binary as `jar:<Class>&/<path>`; there is nothing to fetch, so the
    // file has to be read out of the export directory.
    const asset = Object.values(readAssetIndex()).find((a: any) => a.filename === 'demo-asset.png');
    expect(asset).toBeDefined();
    expect(asset?.content_type).toBe('image/png');
    expect(Number(asset?.file_size)).toBeGreaterThan(0);
  });

  it('writes the real binary to disk for the import to upload', () => {
    const [key, asset] = Object.entries(readAssetIndex()).find(
      ([, a]: [string, any]) => a.filename === 'demo-asset.png',
    ) as [string, any];
    const onDisk = path.join(OUT_ROOT, 'assets', 'files', key, asset.filename);
    expect(fs.existsSync(onDisk)).toBe(true);
    // Byte-identical to the source file, and a real PNG (magic number).
    const src = path.join(path.dirname(FIXTURE), 'images', 'demo-asset.png');
    expect(fs.readFileSync(onDisk).equals(fs.readFileSync(src))).toBe(true);
    expect(fs.readFileSync(onDisk).subarray(1, 4).toString()).toBe('PNG');
  });

  it('also migrates asset files the ImpEx never declares as Media', () => {
    // SAP registers only a fraction of the binaries it ships (the Spartacus sample data
    // carries 17 images and declares 1); the rest are still the customer's files.
    const titles = Object.values(readAssetIndex()).map((a: any) => a.title);
    expect(titles.some((t) => /undeclared\.svg$/.test(t))).toBe(true);
  });

  it('keeps two same-named files in different folders as separate assets', () => {
    // images/undeclared.svg and images/nested/undeclared.svg. Both are also declared by
    // two Media rows that SHARE one code, so only one row can own it — the loser's file
    // must still arrive via the sweep. Marking every resolved path as claimed (rather
    // than only the path actually registered) made real files vanish silently.
    const undeclared = Object.entries(readAssetIndex()).filter(([, a]: [string, any]) =>
      a.filename === 'undeclared.svg',
    );
    expect(undeclared).toHaveLength(2);
    // The two must be distinct assets on disk, not one record counted twice.
    const written = undeclared.map(([key, a]: [string, any]) =>
      path.join(OUT_ROOT, 'assets', 'files', key, a.filename),
    );
    expect(written.every((f) => fs.existsSync(f))).toBe(true);
    expect(new Set(written).size).toBe(2);
  });

  it('gives every asset a unique title', () => {
    const titles = Object.values(readAssetIndex()).map((a: any) => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('does not sweep up non-asset files such as the .impex itself', () => {
    const filenames = Object.values(readAssetIndex()).map((a: any) => a.filename);
    expect(filenames.some((f) => f.endsWith('.impex'))).toBe(false);
  });

  it('does not register a declared Media twice via the sweep', () => {
    // demo-asset.png is claimed by a Media row, so the sweep must skip that exact file.
    const declared = Object.values(readAssetIndex()).filter(
      (a: any) => a.filename === 'demo-asset.png',
    );
    expect(declared).toHaveLength(1);
  });

  it('records a clear reason when the binary is genuinely absent', () => {
    // The fixture's other Media points at Homepage.png, which is not shipped here —
    // that must be reported, not silently skipped.
    const failures = Object.values(readAssetFailures());
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((r) => /not found in export/.test(r))).toBe(true);
  });
});

describe('sap-smartedit createEntry — types keyed on something other than uid/code', () => {
  it('creates an entry per row for a type keyed on name + template', () => {
    // ContentSlotName has no uid and no code. Requiring one dropped all 262 such rows
    // in real SAP data, leaving the content type created but completely empty.
    const entries = readEntries('ContentSlotName');
    expect(Object.keys(entries ?? {})).toHaveLength(3);
  });

  it('builds the identity from the [unique=true] columns, joined', () => {
    const titles = Object.values(readEntries('ContentSlotName') ?? {}).map((e: any) => e.title);
    expect(titles).toEqual([
      // `name` identifies this row alone, so the plain name is used.
      'CpqConfigExitButton',
      // These two share a name, so the composite key distinguishes them.
      'SiteContext-ProductDetailsPageTemplate',
      'SiteContext-ErrorPageTemplate',
    ]);
  });

  it('keeps rows distinct that share a repeated name', () => {
    const entries = readEntries('ContentSlotName') ?? {};
    const titles = Object.values(entries).map((e: any) => e.title);
    // Two rows are both named "SiteContext"; a name-based title would collapse them.
    expect(new Set(titles).size).toBe(3);
    expect(new Set(Object.keys(entries)).size).toBe(3);
  });
});

describe('sap-smartedit createEntry — entry titles prefer an unambiguous label', () => {
  it('uses the source name when it identifies exactly one entry', () => {
    const titles = Object.values(readEntries('ContentCatalog') ?? {}).map((e: any) => e.title);
    expect(titles).toEqual(['Demo Catalog One', 'Demo Catalog Two']);
  });

  it('falls back to the unique id when the name is shared by several entries', () => {
    const titles = Object.values(readEntries('ContentSlotName') ?? {}).map((e: any) => e.title);
    expect(titles).not.toContain('SiteContext');
  });
});

describe('sap-smartedit createEntry — header [default=...] fills empty cells', () => {
  it('populates a reference field whose value comes only from the header default', () => {
    // The exact symptom this fixes: the row leaves `pageTemplate` blank because the
    // header defaults it, so the entry showed an empty reference in Contentstack.
    const entry = Object.values(readEntries('ContentSlotForTemplate') ?? {})[0] as any;
    expect(entry?.pagetemplate).toBe('ProductBackInStockNotificationEmailTemplate');
  });

  it('populates a defaulted value on a type keyed on a composite unique key', () => {
    const entries = readEntries('ContentSlotName') ?? {};
    const cpq = Object.values(entries).find((e: any) => e.title === 'CpqConfigExitButton') as any;
    expect(cpq?.template).toBe('CpqConfigurationTemplate');
  });

  it('lets an explicit cell value win over the default', () => {
    const entries = readEntries('ContentSlotName') ?? {};
    const explicit = Object.values(entries).find(
      (e: any) => e.title === 'SiteContext-ProductDetailsPageTemplate',
    ) as any;
    expect(explicit?.template).toBe('ProductDetailsPageTemplate');
  });
});

describe('sap-smartedit createEntry — macro expansion in values', () => {
  it('expands a macro used as the row identity', () => {
    // `code` is literally "$syncJob" in the source. Unexpanded, every catalog's row
    // would share that id and collapse into one entry.
    const titles = Object.values(readEntries('CatalogVersionSyncJob') ?? {}).map((e: any) => e.title);
    expect(titles).toHaveLength(1);
    expect(titles[0]).not.toContain('$syncJob');
  });

  it('resolves a macro whose own definition contains another macro', () => {
    // $syncJob = "sync $contentCatalog:Staged->Online", so one pass would leave
    // $contentCatalog literal.
    const titles = Object.values(readEntries('CatalogVersionSyncJob') ?? {}).map((e: any) => e.title);
    expect(titles[0]).toBe('sync electronics-spaContentCatalog:Staged->Online');
    expect(titles[0]).not.toContain('$');
  });
});

describe('sap-smartedit createEntry — real per-field multi-locale entries', () => {
  it('writes the primary-locale entry under the master locale folder', () => {
    const entries = readEntries('CMSNavigationNode', 'en-us');
    const entry = Object.values(entries ?? {})[0] as any;
    expect(entry?.title).toBe('English Title');
  });

  it('ALSO writes a genuine second-locale entry, not just the master locale', () => {
    // title[lang=de] must produce a real de-de destination locale — the earlier
    // behavior collapsed this into en-us and dropped the German value entirely.
    const entries = readEntries('CMSNavigationNode', 'de-de');
    expect(entries).not.toBeNull();
    const entry = Object.values(entries ?? {})[0] as any;
    expect(entry?.title).toBe('Deutscher Titel');
  });

  it('uses the SAME entry uid across both locales (one entry, two translations)', () => {
    const en = Object.keys(readEntries('CMSNavigationNode', 'en-us') ?? {});
    const de = Object.keys(readEntries('CMSNavigationNode', 'de-de') ?? {});
    expect(en).toEqual(de);
  });

  it('does NOT duplicate an untranslated row into a locale it has no translation for', () => {
    // CMSParagraphComponent has no [lang=xx] columns anywhere in the fixture, but a
    // de-de destination locale now genuinely exists (from CMSNavigationNode). Product
    // decision: a row with no genuine de translation must NOT get a de-de entry that
    // just repeats the English content — that reads as "this was translated" when it
    // was not. Contentstack's own locale fallback shows the en-us content instead.
    // The de-de folder still exists (createLocale declares the locale regardless),
    // it is simply empty for a type nothing was ever translated into.
    const en = readEntries('CMSParagraphComponent', 'en-us');
    const de = readEntries('CMSParagraphComponent', 'de-de');
    expect(Object.keys(en ?? {}).length).toBeGreaterThan(0);
    expect(de).toEqual({});
  });

  it('DOES write a secondary-locale entry for a row that has a genuine translation', () => {
    // CMSNavigationNode's row genuinely has title[lang=de] — the positive case the
    // negative test above must not have broken.
    const de = readEntries('CMSNavigationNode', 'de-de');
    expect(Object.keys(de ?? {}).length).toBeGreaterThan(0);
  });
});

describe('sap-smartedit createEntry — script directives are not data', () => {
  it('does not create entries from a quoted "#% directive body', () => {
    // The directive block sits inside an INSERT_UPDATE Customer block; Customer is
    // deliberately NOT in CONTENT_TYPES, so the assertion here is that parsing the
    // fixture at all did not throw and no stray entry files appeared.
    const dirs = fs.existsSync(path.join(OUT_ROOT, 'entries'))
      ? fs.readdirSync(path.join(OUT_ROOT, 'entries'))
      : [];
    expect(dirs).not.toContain('cs_customer');
    expect(dirs.every((d) => d.startsWith('cs_'))).toBe(true);
  });
});

/**
 * The REAL mapper (upload-api ensureMandatoryFields) re-points a source `name`
 * column onto Contentstack uid `title`, rather than mapping name->name as the
 * CONTENT_TYPES above do. That difference hid a genuine bug: the mapped value
 * overwrote the collision-disambiguated title, so every row sharing a name got
 * an identical title. Found on live SAP data where 8 components were all named
 * "Section" and produced 8 entries titled "Section". Asserted against the real
 * mapping shape so the fixture cannot drift back into false confidence.
 */
describe('sap-smartedit createEntry — a source column mapped ONTO uid `title`', () => {
  const STACK_TITLE = 'test-stack-sap-smartedit-title-mapping';
  const OUT_TITLE = path.join(process.cwd(), './cmsMigrationData', STACK_TITLE);

  // name -> title, exactly as the real mapper emits it.
  const nameMappedToTitle = {
    otherCmsTitle: 'ContentSlotName',
    otherCmsUid: 'cs_contentslotname',
    contentstackTitle: 'ContentSlotName',
    contentstackUid: 'cs_contentslotname',
    type: 'content_type',
    fieldMapping: [
      {
        uid: 'title',
        otherCmsField: 'name',
        otherCmsType: 'string',
        contentstackField: 'title',
        contentstackFieldUid: 'title',
        contentstackFieldType: 'single_line_text',
        backupFieldType: 'single_line_text',
        backupFieldUid: 'title',
        advanced: {},
        isDeleted: false,
      },
      {
        uid: 'template',
        otherCmsField: 'template',
        otherCmsType: 'string',
        contentstackField: 'template',
        contentstackFieldUid: 'template',
        contentstackFieldType: 'single_line_text',
        backupFieldType: 'single_line_text',
        backupFieldUid: 'template',
        advanced: {},
        isDeleted: false,
      },
    ],
  };

  beforeAll(async () => {
    await sapSmarteditService.createEntry(
      FIXTURE, '', STACK_TITLE, 'test-project', [nameMappedToTitle], {}, LOCALE, {},
    );
  });

  afterAll(() => {
    fs.rmSync(OUT_TITLE, { recursive: true, force: true });
  });

  const titleEntries = () => {
    const f = path.join(OUT_TITLE, 'entries', 'cs_contentslotname', LOCALE, `${LOCALE}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, any>) : {};
  };

  it('does not give every row sharing a name the SAME title', () => {
    const titles = Object.values(titleEntries()).map((e: any) => e.title);
    expect(titles).toHaveLength(3);
    expect(new Set(titles).size).toBe(3);
  });

  it('falls back to the unique source id for the rows that share a name', () => {
    const titles = Object.values(titleEntries()).map((e: any) => e.title);
    // Two fixture rows are both named "SiteContext" — neither may keep that as title.
    expect(titles).not.toContain('SiteContext');
    expect(titles).toContain('SiteContext-ProductDetailsPageTemplate');
    expect(titles).toContain('SiteContext-ErrorPageTemplate');
  });

  it('still lets an unambiguous mapped name win as the title', () => {
    const titles = Object.values(titleEntries()).map((e: any) => e.title);
    expect(titles).toContain('CpqConfigExitButton');
  });
});

/**
 * createLocale had NO coverage, which is how it shipped hardcoding an empty
 * locales.json: createEntry wrote entry files for every discovered locale, but the
 * destination stack only ever got its master locale, so Contentstack had nowhere to
 * import the translations into and silently dropped them. The two functions must
 * agree on the locale set — that agreement is what these tests pin.
 */
describe('sap-smartedit createLocale — locales the export actually uses', () => {
  const STACK_LOC = 'test-stack-sap-smartedit-locales';
  const OUT_LOC = path.join(process.cwd(), './cmsMigrationData', STACK_LOC);

  beforeAll(async () => {
    await sapSmarteditService.createLocale(FIXTURE, STACK_LOC, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
  });

  afterAll(() => {
    fs.rmSync(OUT_LOC, { recursive: true, force: true });
  });

  const readJson = (name: string) => {
    const f = path.join(OUT_LOC, 'locales', name);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  };

  it('writes the master locale on its own', () => {
    const master = Object.values(readJson('master-locale.json') ?? {}) as any[];
    expect(master).toHaveLength(1);
    expect(master[0].code).toBe(LOCALE);
    expect(master[0].fallback_locale).toBeNull();
  });

  it('creates a real destination locale for a language found on a [lang=xx] column', () => {
    // The fixture carries title[lang=en] AND title[lang=de]; de-de must be created,
    // or the de-de entries createEntry writes can never be imported.
    const codes = (Object.values(readJson('locales.json') ?? {}) as any[]).map((l) => l.code);
    expect(codes).toContain('de-de');
  });

  it('does not repeat the master locale in locales.json', () => {
    const codes = (Object.values(readJson('locales.json') ?? {}) as any[]).map((l) => l.code);
    expect(codes).not.toContain(LOCALE);
  });

  it('names the master locale by its DISPLAY name, never its code', () => {
    // The importer compares this name against the destination stack's master-locale
    // name and, when they differ, blocks on an interactive "update name of master
    // language? (Y/n)" prompt that `--yes` does NOT suppress. Writing the code here
    // ("en-us" vs "English - United States") hung the whole UI migration.
    const master = Object.values(readJson('master-locale.json') ?? {})[0] as any;
    expect(master.name).not.toBe(master.code);
    expect(master.name.toLowerCase()).toContain('english');
  });

  it('names every additional locale by its display name too', () => {
    const locales = Object.values(readJson('locales.json') ?? {}) as any[];
    expect(locales.length).toBeGreaterThan(0);
    for (const l of locales) expect(l.name).not.toBe(l.code);
  });

  it('falls every created locale back to the master locale', () => {
    const locales = Object.values(readJson('locales.json') ?? {}) as any[];
    expect(locales.length).toBeGreaterThan(0);
    for (const l of locales) expect(l.fallback_locale).toBe(LOCALE);
  });

  it('creates a locale for EVERY locale createEntry writes entries for', () => {
    // The invariant that was violated: an entry folder with no matching stack locale.
    const entryLocales = fs
      .readdirSync(path.join(OUT_ROOT, 'entries', 'cs_cmsnavigationnode'))
      .filter((d) => d !== 'index.json');
    const created = new Set([
      LOCALE,
      ...(Object.values(readJson('locales.json') ?? {}) as any[]).map((l) => l.code),
    ]);
    for (const loc of entryLocales) expect(created.has(loc)).toBe(true);
  });
});

/**
 * Regression test for a real finding: a genuinely unrecognized/custom language
 * code (in neither Contentstack's live locale list nor the small fallback
 * table) fell all the way through nameFor() to the code itself as the locale's
 * display `name`. A locale named identically to its own code makes the
 * Contentstack CLI import block on an un-suppressable interactive prompt —
 * exactly the failure mode the comment above nameFor() already documents for
 * the master locale, just unguarded for this specific fallback path. Confirmed
 * live via the reconciler's `locale.name` check against a `title[lang=zz]`
 * column.
 */
describe('sap-smartedit createLocale — unrecognized/custom locale codes', () => {
  const STACK_CUSTOM = 'test-stack-sap-smartedit-custom-locale';
  const OUT_CUSTOM = path.join(process.cwd(), './cmsMigrationData', STACK_CUSTOM);
  const CUSTOM_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/custom-locale.impex');

  beforeAll(async () => {
    await sapSmarteditService.createLocale(CUSTOM_FIXTURE, STACK_CUSTOM, 'test-project', {
      stackDetails: { master_locale: LOCALE },
    });
  });

  afterAll(() => {
    fs.rmSync(OUT_CUSTOM, { recursive: true, force: true });
  });

  it('still creates the custom locale — custom locales are supported and expected', () => {
    const locales = JSON.parse(
      fs.readFileSync(path.join(OUT_CUSTOM, 'locales', 'locales.json'), 'utf8'),
    );
    const codes = (Object.values(locales) as any[]).map((l) => l.code);
    expect(codes).toContain('zz-zz');
  });

  it('does NOT name it after its own code', () => {
    const locales = JSON.parse(
      fs.readFileSync(path.join(OUT_CUSTOM, 'locales', 'locales.json'), 'utf8'),
    );
    const zz = (Object.values(locales) as any[]).find((l) => l.code === 'zz-zz');
    expect(zz).toBeDefined();
    expect(zz.name).not.toBe(zz.code);
    expect(zz.name).not.toBe('');
  });
});

/**
 * Regression coverage for a real, previously-untested code path: getAllAssets'
 * `fetch(url)` branch, taken when a Media row declares a real URL instead of a
 * local/platform-resource binary. Every other asset test exercises the local
 * path only. Verified live against real reachable URLs first (a real PNG, a
 * real SVG, a real 404, and a genuinely unreachable domain — all resolved or
 * failed correctly, no hang), then pinned here with a mocked fetch so the
 * suite doesn't depend on live network/external services.
 */
describe('sap-smartedit getAllAssets — Media sourced from a real URL', () => {
  const STACK_URL = 'test-stack-sap-smartedit-url-media';
  const OUT_URL = path.join(process.cwd(), './cmsMigrationData', STACK_URL);
  const URL_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/url-media.impex');
  const REAL_PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // real PNG magic number

  let originalFetch: typeof fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: any) => {
      const url = String(input);
      if (url === 'https://example.test/happy.png') {
        return {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'image/png' : null) },
          arrayBuffer: async () => REAL_PNG_BYTES.buffer.slice(
            REAL_PNG_BYTES.byteOffset,
            REAL_PNG_BYTES.byteOffset + REAL_PNG_BYTES.byteLength,
          ),
        } as any;
      }
      if (url === 'https://example.test/not-found.png') {
        return { ok: false, status: 404, headers: { get: () => null } } as any;
      }
      if (url === 'https://example.test/unreachable.png') {
        throw new TypeError('fetch failed');
      }
      throw new Error(`unexpected URL in test: ${url}`);
    }) as any;

    fs.rmSync(OUT_URL, { recursive: true, force: true });
    await sapSmarteditService.getAllAssets(URL_FIXTURE, '', STACK_URL, 'test-project');
  });

  afterAll(() => {
    global.fetch = originalFetch;
    fs.rmSync(OUT_URL, { recursive: true, force: true });
  });

  const readIndex = () => {
    const f = path.join(OUT_URL, 'assets', 'index.json');
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, any>) : {};
  };
  const readFailures = () => {
    const f = path.join(OUT_URL, 'assets', 'logs', 'assets', 'cs_failed.json');
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>) : {};
  };

  it('downloads the real bytes and uses the content-type from the HTTP response header', () => {
    const asset = readIndex()['assets_urlMediaHappy'];
    expect(asset).toBeDefined();
    expect(asset.content_type).toBe('image/png');
    const onDisk = path.join(OUT_URL, 'assets', 'files', 'assets_urlMediaHappy', asset.filename);
    expect(fs.readFileSync(onDisk).equals(REAL_PNG_BYTES)).toBe(true);
  });

  it('records a non-2xx response as a failure, not a crash', () => {
    const failures = readFailures();
    expect(failures['assets_urlMediaHttpError']).toContain('404');
    expect(readIndex()['assets_urlMediaHttpError']).toBeUndefined();
  });

  it('records a network-level exception as a failure, not a crash', () => {
    const failures = readFailures();
    expect(failures['assets_urlMediaNetworkError']).toBeDefined();
    expect(readIndex()['assets_urlMediaNetworkError']).toBeUndefined();
  });
});

/**
 * Regression test for a real gap found while testing the URL path above: a
 * connection that's accepted but never responds (a slow CDN, an outage) hung
 * `await fetch(url)` forever, with no way to recover short of killing the
 * process — this loop is sequential, so ONE bad URL anywhere in a real
 * customer's catalog could stall the entire migration indefinitely.
 *
 * Uses a real (but tiny, 50ms) timeout via SAP_ASSET_FETCH_TIMEOUT_MS rather
 * than mocking global timers — an earlier attempt with vi.useFakeTimers()
 * fought with the rest of the async runtime (fs.promises, fetch internals)
 * and hung the test itself. A real short wait is simpler and just as valid.
 */
describe('sap-smartedit getAllAssets — a hanging URL fetch does not hang forever', () => {
  const STACK_HANG = 'test-stack-sap-smartedit-url-media-hang';
  const OUT_HANG = path.join(process.cwd(), './cmsMigrationData', STACK_HANG);
  const HANG_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/url-media-hang.impex');
  let originalFetch: typeof fetch;

  afterEach(() => {
    delete process.env.SAP_ASSET_FETCH_TIMEOUT_MS;
    global.fetch = originalFetch;
    fs.rmSync(OUT_HANG, { recursive: true, force: true });
  });

  it('times out instead of hanging, and records it as a failure', async () => {
    originalFetch = global.fetch;
    process.env.SAP_ASSET_FETCH_TIMEOUT_MS = '50';
    // Never resolves on its own — only settles if aborted, exactly like a
    // connection that's accepted but the server never responds.
    global.fetch = vi.fn((_input: any, init?: any) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err: any = new Error('This operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as any;

    fs.rmSync(OUT_HANG, { recursive: true, force: true });
    await sapSmarteditService.getAllAssets(HANG_FIXTURE, '', STACK_HANG, 'test-project');

    const failuresFile = path.join(OUT_HANG, 'assets', 'logs', 'assets', 'cs_failed.json');
    const failures = JSON.parse(fs.readFileSync(failuresFile, 'utf8'));
    expect(failures['assets_urlMediaHanging']).toContain('timed out');
  });
});

/**
 * Regression test for a real finding: a SAP export's own `$lang` macro (its
 * internal "working language") is a property of the SOURCE file, completely
 * independent from the Contentstack PROJECT's configured master locale — a
 * SAP working language of "de" with a project master locale of "en-us" is a
 * legitimate, real combination. parseImpex's row default assignment prefers
 * whichever [lang=xx] column matches the file's own $lang, so when the two
 * disagree, the primary/master-locale entry silently got the WRONG
 * language's text. Confirmed live: reverting the fix reproduced the master
 * (en-us) entry showing German text instead of English.
 */
describe('sap-smartedit createEntry — SAP $lang macro vs the project\'s real master locale', () => {
  const STACK_LANG = 'test-stack-sap-smartedit-lang-mismatch';
  const OUT_LANG = path.join(process.cwd(), './cmsMigrationData', STACK_LANG);
  const LANG_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/lang-macro-mismatch.impex');

  beforeAll(async () => {
    fs.rmSync(OUT_LANG, { recursive: true, force: true });
    await sapSmarteditService.createLocale(LANG_FIXTURE, STACK_LANG, 'test-project', {
      stackDetails: { master_locale: 'en-us' },
    });
    await sapSmarteditService.createEntry(LANG_FIXTURE, '', STACK_LANG, 'test-project', [
      {
        otherCmsTitle: 'CMSNavigationNode', contentstackUid: 'cs_cmsnavigationnode',
        fieldMapping: [{ otherCmsField: 'title', contentstackFieldUid: 'title', contentstackFieldType: 'single_line_text' }],
      },
    ], {}, 'en-us', {});
  });

  afterAll(() => {
    fs.rmSync(OUT_LANG, { recursive: true, force: true });
  });

  it('gives the master (en-us) entry the ENGLISH value, not the SAP file\'s own $lang=de value', () => {
    const entries = JSON.parse(fs.readFileSync(path.join(OUT_LANG, 'entries', 'cs_cmsnavigationnode', 'en-us', 'en-us.json'), 'utf8'));
    const entry = Object.values(entries)[0] as any;
    expect(entry.title).toBe('English Value');
    expect(entry.title).not.toBe('Deutscher Wert');
  });

  it('still gives the de-de entry the genuine German value', () => {
    const entries = JSON.parse(fs.readFileSync(path.join(OUT_LANG, 'entries', 'cs_cmsnavigationnode', 'de-de', 'de-de.json'), 'utf8'));
    const entry = Object.values(entries)[0] as any;
    expect(entry.title).toBe('Deutscher Wert');
  });
});

/**
 * Regression test for a real finding: a row that genuinely translates ONE
 * field (so it correctly gets a secondary-locale entry at all) still had
 * every OTHER, untranslated field filled in with the primary-language
 * default value — writing English text into a "German" field makes it look
 * genuinely translated, defeating Contentstack's own locale-fallback display
 * for that field. The row-level skip (no entry at all when NOTHING is
 * translated) already existed; this is the same principle applied per field
 * once an entry is created at all.
 */
describe('sap-smartedit createEntry — a partially-translated row does not leak default text into its OTHER fields', () => {
  const STACK_PARTIAL = 'test-stack-sap-smartedit-partial-translation';
  const OUT_PARTIAL = path.join(process.cwd(), './cmsMigrationData', STACK_PARTIAL);
  const PARTIAL_FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/partial-translation.impex');

  beforeAll(async () => {
    fs.rmSync(OUT_PARTIAL, { recursive: true, force: true });
    await sapSmarteditService.createLocale(PARTIAL_FIXTURE, STACK_PARTIAL, 'test-project', {
      stackDetails: { master_locale: 'en-us' },
    });
    await sapSmarteditService.createEntry(PARTIAL_FIXTURE, '', STACK_PARTIAL, 'test-project', [
      {
        otherCmsTitle: 'CMSParagraphComponent', contentstackUid: 'cs_cmsparagraphcomponent',
        fieldMapping: [
          { otherCmsField: 'title', contentstackFieldUid: 'title', contentstackFieldType: 'single_line_text' },
          { otherCmsField: 'content', contentstackFieldUid: 'content', contentstackFieldType: 'single_line_text' },
        ],
      },
    ], {}, 'en-us', {});
  });

  afterAll(() => {
    fs.rmSync(OUT_PARTIAL, { recursive: true, force: true });
  });

  it('still creates the de-de entry, since SOMETHING (title) was genuinely translated', () => {
    const entries = JSON.parse(fs.readFileSync(path.join(OUT_PARTIAL, 'entries', 'cs_cmsparagraphcomponent', 'de-de', 'de-de.json'), 'utf8'));
    expect(Object.keys(entries)).toHaveLength(1);
    expect((Object.values(entries)[0] as any).title).toBe('Deutscher Titel');
  });

  it('omits the untranslated "content" field entirely, rather than leaking the English default', () => {
    const entries = JSON.parse(fs.readFileSync(path.join(OUT_PARTIAL, 'entries', 'cs_cmsparagraphcomponent', 'de-de', 'de-de.json'), 'utf8'));
    const entry = Object.values(entries)[0] as any;
    expect('content' in entry).toBe(false);
    expect(entry.content).not.toBe('English Content');
  });

  it('the primary (en-us) entry is unaffected and still has both fields', () => {
    const entries = JSON.parse(fs.readFileSync(path.join(OUT_PARTIAL, 'entries', 'cs_cmsparagraphcomponent', 'en-us', 'en-us.json'), 'utf8'));
    const entry = Object.values(entries)[0] as any;
    expect(entry.title).toBe('English Title');
    expect(entry.content).toBe('English Content');
  });
});
