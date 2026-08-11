/**
 * Phase B of the navigation smoke test: the api stage, exercised through the real
 * `siteCoreService.createEntry` — not by calling the navigation builder directly.
 *
 * Consumes the content types produced by phase A (upload-api mapper) exactly as the api receives
 * them in the mapper payload, runs the real content-type creator and the real entry creator, and
 * produces a migration folder.
 *
 * Content types included: the denormalised navigation menu, plus the content types its
 * `content_item` blocks reference — so the menus and the entries they point at are consistent.
 *
 *   npx tsx nav-flow-smoke.ts [workDir] [stackId]
 */
import fs from 'fs';
import path from 'path';
import read from 'fs-readdir-recursive';
import { MIGRATION_DATA_CONFIG } from './src/constants/index.js';
import { contenTypeMaker } from './src/utils/content-type-creator.utils.js';
import { MAX_BLOCK_DEPTH } from './src/utils/navigation-menu.utils.js';

const WORK = process.argv[2] ?? '/private/tmp/claude-501/nav-flow-smoke';
const STACK_ID = process.argv[3] ?? 'nav_smoke';
const PROJECT_ID = 'nav-smoke-project';
const DEST_LOCALE = 'en-us';

const main = async () => {
  const t0 = process.hrtime.bigint();
  const navCtPath = path.join(WORK, 'navigation-content-type.json');
  if (!fs.existsSync(navCtPath)) {
    console.error(`Phase A output missing: ${navCtPath}\nRun upload-api/nav-mapper-smoke.js first.`);
    process.exit(1);
  }
  const navCt = JSON.parse(fs.readFileSync(navCtPath, 'utf8'));
  const mapperInfo = JSON.parse(fs.readFileSync(path.join(WORK, 'mapper-info.json'), 'utf8'));
  const packagePath = mapperInfo.extractPath;
  const mapperCtDir = path.join(WORK, MIGRATION_DATA_CONFIG.DATA, 'content_types');

  // The content types the content_item block references — pulled from the mapper output so they
  // carry their real fieldMapping rather than a stub.
  const refRow = navCt.fieldMapping.find(
    (f: any) => f.contentstackFieldUid === 'items.content_item.entry'
  );
  const referenced: any[] = (refRow?.refrenceTo ?? [])
    .map((uid: string) => path.join(mapperCtDir, `${uid}.json`))
    .filter((p: string) => fs.existsSync(p))
    .map((p: string) => JSON.parse(fs.readFileSync(p, 'utf8')));

  // In the real flow the mapper POSTs these content types to the api, and putTestData normalises
  // every fieldMapping row before anything reads it — stamping an id and `isDeleted: false`
  // (contentMapper.service.ts). buildFieldSchema includes a group's children only when
  // `isDeleted === false` strictly, so skipping that normalisation silently empties every group.
  // This harness talks to contenTypeMaker directly, so it has to apply the same normalisation.
  const normalise = (ct: any) => ({
    ...ct,
    fieldMapping: (ct.fieldMapping ?? []).map((f: any) => ({
      ...f,
      id: f.id ?? `${ct.contentstackUid}-${f.contentstackFieldUid}`,
      isDeleted: f.isDeleted ?? false,
    })),
  });

  const contentTypes = [navCt, ...referenced].map(normalise);

  // createEntry and contenTypeMaker both resolve output against cwd.
  process.chdir(WORK);
  const baseDir = path.join(WORK, MIGRATION_DATA_CONFIG.DATA, STACK_ID);
  fs.rmSync(baseDir, { recursive: true, force: true });

  // --- content types, through the real creator ---
  for (const contentType of contentTypes) {
    await contenTypeMaker({
      contentType,
      destinationStackId: STACK_ID,
      projectId: PROJECT_ID,
      newStack: true,
      keyMapper: {},
      region: 'NA',
      user_id: 'smoke',
      is_sso: false,
    });
  }

  // --- entries, through the real createEntry (this is the wiring under test) ---
  const { siteCoreService } = await import('./src/services/sitecore.service.js');
  await siteCoreService.createEntry({
    packagePath,
    contentTypes,
    master_locale: DEST_LOCALE,
    destinationStackId: STACK_ID,
    projectId: PROJECT_ID,
    keyMapper: {},
    project: { master_locale: DEST_LOCALE, locales: {} },
  });

  // --- verify what landed on disk ---
  const entriesRoot = path.join(baseDir, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME);
  // createEntry names the locale folder via mapLocales, which falls back to the lowercased source
  // locale when the project carries no locale map — so discover it rather than assume `en-us`.
  const navLocaleDir = path.join(entriesRoot, navCt.contentstackUid);
  const navLocale = fs.existsSync(navLocaleDir) ? fs.readdirSync(navLocaleDir)[0] : DEST_LOCALE;
  const navEntryFile = path.join(navLocaleDir, navLocale, `${navLocale}.json`);
  const ctFile = path.join(
    baseDir,
    MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME,
    `${navCt.contentstackUid}.json`
  );

  const entries = fs.existsSync(navEntryFile)
    ? JSON.parse(fs.readFileSync(navEntryFile, 'utf8'))
    : {};
  const ct = fs.existsSync(ctFile) ? JSON.parse(fs.readFileSync(ctFile, 'utf8')) : null;

  // Expected counts, derived from the package rather than hardcoded: every nav item reachable from a
  // `site navigation` container, with the same depth ceiling the schema is generated to.
  const NAV_TEMPLATES = new Set(['site navigation', 'navigation group', 'navigation element']);
  const flat = new Map<string, any>();
  const contentRoot = path.join(packagePath, 'items', 'master', 'sitecore', 'content');
  for (const rel of read(contentRoot)) {
    if (!rel.endsWith('data.json')) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(contentRoot, rel), 'utf8'))?.item?.$;
    if (!meta?.id || meta.language !== 'en') continue;
    const uid = `${meta.id}`.replace(/[-{}]/g, '').toLowerCase();
    const version = Number.parseInt(`${meta.version ?? 1}`, 10) || 1;
    if (flat.has(uid) && flat.get(uid).version > version) continue;
    flat.set(uid, {
      uid,
      version,
      template: `${meta.template ?? ''}`.toLowerCase(),
      parent: `${meta.parentid ?? ''}`.replace(/[-{}]/g, '').toLowerCase(),
    });
  }
  const childrenOf = new Map<string, any[]>();
  for (const i of flat.values()) {
    if (!i.parent) continue;
    const slot = childrenOf.get(i.parent);
    if (slot) slot.push(i);
    else childrenOf.set(i.parent, [i]);
  }
  const rootUids = [...flat.values()]
    .filter((i) => i.template === 'site navigation')
    .map((i) => i.uid);
  const expectedMenus = rootUids
    .flatMap((r) => childrenOf.get(r) ?? [])
    .filter((i) => NAV_TEMPLATES.has(i.template)).length;
  let expectedMenuBlocks = 0;
  let expectedContentBlocks = 0;
  let expectedTruncated = 0;
  const descend = (uid: string, depth: number) => {
    for (const child of childrenOf.get(uid) ?? []) {
      if (!NAV_TEMPLATES.has(child.template)) {
        expectedContentBlocks += 1;
        continue;
      }
      if (depth > MAX_BLOCK_DEPTH) {
        expectedTruncated += 1;
        continue;
      }
      expectedMenuBlocks += 1;
      descend(child.uid, depth + 1);
    }
  };
  for (const r of rootUids) {
    for (const m of childrenOf.get(r) ?? []) {
      if (NAV_TEMPLATES.has(m.template)) descend(m.uid, 1);
    }
  }

  const counted = { menu: 0, content: 0, maxDepth: 0 };
  const countBlocks = (blocks: any[], depth = 1) => {
    for (const b of blocks ?? []) {
      if (b.menu_item) {
        counted.menu += 1;
        counted.maxDepth = Math.max(counted.maxDepth, depth);
        countBlocks(b.menu_item.items, depth + 1);
      }
      if (b.content_item) counted.content += 1;
    }
  };
  Object.values(entries).forEach((e: any) => countBlocks(e.items));

  const schemaDepth = (nodes: any[], d = 0): number => {
    let max = d;
    for (const n of nodes ?? []) {
      if (n.data_type === 'blocks') {
        for (const b of n.blocks ?? []) max = Math.max(max, schemaDepth(b.schema, d + 1));
      } else if (n.schema) max = Math.max(max, schemaDepth(n.schema, d));
    }
    return max;
  };
  const itemsField = ct?.schema?.find((f: any) => f.uid === 'items');

  // Every content_item reference must point at an entry that actually shipped in this folder.
  const shipped = new Set<string>();
  for (const ctUid of fs.existsSync(entriesRoot) ? fs.readdirSync(entriesRoot) : []) {
    for (const loc of fs.readdirSync(path.join(entriesRoot, ctUid))) {
      const file = path.join(entriesRoot, ctUid, loc, `${loc}.json`);
      if (!fs.existsSync(file)) continue;
      Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).forEach((uid) =>
        shipped.add(`${ctUid}:${uid}`)
      );
    }
  }
  let danglingRefs = 0;
  const walkRefs = (blocks: any[]) => {
    for (const b of blocks ?? []) {
      if (b.content_item) {
        const r = b.content_item.entry?.[0];
        if (!shipped.has(`${r?._content_type_uid}:${r?.uid}`)) danglingRefs += 1;
      }
      if (b.menu_item?.items) walkRefs(b.menu_item.items);
    }
  };
  Object.values(entries).forEach((e: any) => walkRefs(e.items));

  const checks: [string, boolean, string][] = [
    ['mapper produced the nav content type', (navCt.fieldMapping?.length ?? 0) > 0, `${navCt.fieldMapping?.length} rows`],
    ['mapper produced 22 entryMapping rows', navCt.entryMapping?.length === 22, `${navCt.entryMapping?.length}`],
    ['every fieldMapping row has a stable id', navCt.fieldMapping.every((f: any) => typeof f.id === 'string' && f.id), ''],
    ['content type written', !!ct, ''],
    ['ct title is Navigation Menu', ct?.title === 'Navigation Menu', `${ct?.title}`],
    ['items is repeatable blocks', itemsField?.data_type === 'blocks' && itemsField?.multiple === true, ''],
    ['both block types present', (itemsField?.blocks ?? []).map((b: any) => b.uid).join(',') === 'menu_item,content_item', (itemsField?.blocks ?? []).map((b: any) => b.uid).join(',')],
    ['schema block depth == MAX_BLOCK_DEPTH', schemaDepth(ct?.schema) === MAX_BLOCK_DEPTH, `${schemaDepth(ct?.schema)} vs ${MAX_BLOCK_DEPTH}`],
    ['createEntry wrote the menu entries', fs.existsSync(navEntryFile), ''],
    ['22 menu entries', Object.keys(entries).length === 22, `${Object.keys(entries).length}`],
    ['entries match mapper entryMapping', Object.keys(entries).length === navCt.entryMapping?.length, ''],
    ['menu blocks reconcile', counted.menu === expectedMenuBlocks, `${counted.menu} vs ${expectedMenuBlocks}`],
    ['content blocks reconcile', counted.content === expectedContentBlocks, `${counted.content} vs ${expectedContentBlocks}`],
    ['entry depth <= MAX_BLOCK_DEPTH', counted.maxDepth <= MAX_BLOCK_DEPTH, `${counted.maxDepth}`],
    ['no dangling content_item references', danglingRefs === 0, `${danglingRefs}`],
    ['no flat nav entry folders', !['navigation_element', 'site_navigation'].some((u) => fs.existsSync(path.join(entriesRoot, u))), ''],
    ['every block records its sitecore uid', (() => {
      let ok = true;
      const walk = (bs: any[]) => bs?.forEach((b: any) => {
        const inner = b.menu_item ?? b.content_item;
        if (!inner?.sitecore_uid) ok = false;
        if (b.menu_item?.items) walk(b.menu_item.items);
      });
      Object.values(entries).forEach((e: any) => walk(e.items));
      return ok;
    })(), ''],
  ];

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log('\n=== NAVIGATION FLOW SMOKE TEST (phase B: api, via createEntry) ===');
  console.log('package         :', packagePath);
  console.log('migration folder:', baseDir);
  console.log('content types   :', contentTypes.map((c: any) => c.contentstackUid).join(', '));
  console.log('locale folder   :', navLocale);
  console.log('elapsed         :', `${(ms / 1000).toFixed(1)}s`);
  console.log('\nchecks:');
  let failed = 0;
  for (const [name, ok, detail] of checks) {
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed) process.exitCode = 1;
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
