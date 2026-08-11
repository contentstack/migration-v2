/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Phase A of the navigation smoke test: the upload-api mapper stage, run exactly as
 * createSitecoreMapper runs it, minus the authenticated HTTP posts.
 *
 *   ExtractFiles -> ExtractContentTypes -> extractEntries -> ExtractRef
 *
 * Writes the mapper output into a work directory and dumps the navigation content type so phase B
 * (api) can pick it up. Nothing touches the original package: items/ is copied first, because
 * ExtractFiles writes a data.json beside every xml.
 *
 *   node nav-mapper-smoke.js [pathToPackage] [workDir]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PKG = process.argv[2] || '/Users/umesh.more/Desktop/package 3';
const WORK = process.argv[3] || '/private/tmp/claude-501/nav-flow-smoke';
const AFFIX = 'wd';

// migration-sitecore resolves some output paths at MODULE LOAD time (reference.js does
// `path.resolve(DATA, CONTENT_TYPES_DIR_NAME)` at import), so the working directory has to be set
// before the require — otherwise ExtractRef reads a different content_types folder than
// ExtractContentTypes writes to. Production never chdirs, so this only matters for a harness.
const REUSE = fs.existsSync(path.join(WORK, 'package', 'items', 'master'));
if (!REUSE) {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(path.join(WORK, 'package'), { recursive: true });
  console.log('copying items/ (the mapper mutates it by writing data.json)...');
  execFileSync('cp', ['-R', path.join(PKG, 'items'), path.join(WORK, 'package')]);
} else {
  console.log('reusing already-extracted package in', WORK);
  fs.rmSync(path.join(WORK, 'cmsMigrationData'), { recursive: true, force: true });
}
process.chdir(WORK);

const {
  contentTypes,
  ExtractConfiguration,
  reference,
  ExtractFiles,
  extractEntries
} = require('migration-sitecore');

const t = (label, started) =>
  console.log(`  ${label}: ${((Number(process.hrtime.bigint() - started) / 1e9)).toFixed(1)}s`);

const main = async () => {
  const workPkg = path.join(WORK, 'package');
  const items = path.join(workPkg, 'items');

  let started = process.hrtime.bigint();
  if (REUSE) {
    console.log('ExtractFiles: skipped (data.json already present)');
  } else {
    console.log('ExtractFiles (xml -> data.json)...');
    await ExtractFiles(items);
    t('ExtractFiles', started);
  }
  console.log(
    '  data.json present:',
    execFileSync('bash', ['-c', `find "${items}" -name data.json | wc -l`]).toString().trim()
  );

  started = process.hrtime.bigint();
  console.log('ExtractConfiguration...');
  await ExtractConfiguration(items);
  t('ExtractConfiguration', started);

  started = process.hrtime.bigint();
  console.log('ExtractContentTypes...');
  await contentTypes(items, AFFIX, {
    plan: { dropdown: { optionLimit: 100 } }
  });
  t('ExtractContentTypes', started);

  started = process.hrtime.bigint();
  console.log('extractEntries...');
  await extractEntries(items);
  t('extractEntries', started);

  started = process.hrtime.bigint();
  console.log('ExtractRef...');
  const infoMap = await reference(items);
  t('ExtractRef', started);

  const ctDir = path.join(infoMap.path, 'content_types');
  const ctFiles = fs.readdirSync(ctDir).filter((f) => f.endsWith('.json'));
  const navPath = path.join(ctDir, 'navigation_group.json');

  console.log('\n=== MAPPER OUTPUT ===');
  console.log('work dir      :', WORK);
  console.log('content types :', ctFiles.length);
  console.log('global fields :', infoMap.globalFieldUids?.length ?? 0);

  const suppressed = ['navigation_element.json', 'site_navigation.json'].filter((f) =>
    ctFiles.includes(f)
  );
  console.log('suppressed nav CTs still present (should be none):', suppressed);

  if (!fs.existsSync(navPath)) {
    console.error('FAIL: navigation_group.json was not produced');
    process.exit(1);
  }
  const nav = JSON.parse(fs.readFileSync(navPath, 'utf8'));
  console.log('\nnavigation content type');
  console.log('  uid            :', nav.contentstackUid);
  console.log('  title          :', nav.contentstackTitle);
  console.log('  fieldMapping   :', nav.fieldMapping?.length, 'rows');
  console.log('  entryMapping   :', nav.entryMapping?.length, 'menus');
  const blockRows = nav.fieldMapping.filter((f) =>
    ['modular_blocks', 'modular_blocks_child'].includes(f.contentstackFieldType)
  );
  console.log('  block rows     :', blockRows.length);
  const refRow = nav.fieldMapping.find((f) => f.contentstackFieldUid === 'items.content_item.entry');
  console.log('  content_item ->:', refRow?.refrenceTo);
  console.log('  every row has stable id:', nav.fieldMapping.every((f) => typeof f.id === 'string'));

  const navLog = (infoMap.referenceLog ?? []).filter((l) => l.startsWith('Navigation:'));
  console.log('\nnavigation log lines:');
  navLog.forEach((l) => console.log('  -', l));

  // Hand phase B the exact content type the api would receive in the mapper payload.
  fs.writeFileSync(
    path.join(WORK, 'navigation-content-type.json'),
    JSON.stringify({ ...nav, type: 'content_type' }, null, 2)
  );
  fs.writeFileSync(path.join(WORK, 'mapper-info.json'), JSON.stringify({
    extractPath: workPkg,
    contentTypeCount: ctFiles.length,
    navLog
  }, null, 2));
  console.log('\nphase B inputs written to', path.join(WORK, 'navigation-content-type.json'));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
