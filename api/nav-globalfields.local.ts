/**
 * Emit exactly the global fields the produced content types reference, via the real creator.
 * Derived from the content types rather than hardcoded, so a global field the mapper drops
 * (because it shipped no fields) is not chased.
 */
import fs from 'fs';
import path from 'path';
import { contenTypeMaker } from './src/utils/content-type-creator.utils.js';

const WORK = '/private/tmp/claude-501/nav-flow-smoke';
const STACK_ID = 'nav_smoke';

const main = async () => {
  const ctDir = path.join(WORK, 'cmsMigrationData', STACK_ID, 'content_types');
  const needed = new Set<string>();
  const walk = (s: any[]) => {
    for (const f of s ?? []) {
      if (f?.data_type === 'global_field' && f?.reference_to) needed.add(f.reference_to);
      walk(f?.schema);
      for (const b of f?.blocks ?? []) walk(b?.schema);
    }
  };
  for (const file of fs.readdirSync(ctDir)) {
    if (!file.endsWith('.json') || file === 'schema.json') continue;
    walk(JSON.parse(fs.readFileSync(path.join(ctDir, file), 'utf8'))?.schema);
  }
  console.log('global fields referenced by the content types:', [...needed]);
  if (!needed.size) return;

  const all = JSON.parse(
    fs.readFileSync(path.join(WORK, 'cmsMigrationData', 'global_fields', 'globalfields.json'), 'utf8')
  );
  process.chdir(WORK);
  for (const uid of needed) {
    const gf = all.find((g: any) => g?.contentstackUid === uid);
    if (!gf) { console.error('NOT in mapper output:', uid); process.exitCode = 1; continue; }
    await contenTypeMaker({
      contentType: {
        ...gf,
        type: 'global_field',
        // Same normalisation putTestData applies in the real flow; without isDeleted:false
        // buildFieldSchema drops every group child and the global field ships empty.
        fieldMapping: (gf.fieldMapping ?? []).map((f: any) => ({
          ...f,
          id: f.id ?? `${gf.contentstackUid}-${f.contentstackFieldUid}`,
          isDeleted: f.isDeleted ?? false,
        })),
      },
      destinationStackId: STACK_ID,
      projectId: 'nav-smoke-project',
      newStack: true,
      keyMapper: {},
      region: 'NA',
      user_id: 'smoke',
      is_sso: false,
    });
    console.log('emitted global field:', uid);
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
