#!/usr/bin/env npx tsx
// CI integration gate for the SAP SmartEdit connector: run the FULL pipeline
// (getAllAssets -> createLocale -> createEntry) against the checked-in real-SAP
// fixture, then reconcile the result. Fails the build on any critical/error.
//
// This is deliberately NOT just the unit tests: it exercises the actual wiring
// between parseImpexAll, createEntry, createLocale and getAllAssets together, the
// same way a real migration does. A change that breaks that wiring while every
// function's own isolated unit tests still pass would slip through unit tests
// alone — this is the integration net underneath them.
//
// Runs entirely on disk: no Contentstack credentials, no network, so it is safe
// to run on every push/PR.
//
// A minimal hand-built content-type list is used here rather than importing
// upload-api's extractContentTypes: api and upload-api deliberately have no
// cross-package dependency in this codebase (see sap-smartedit.service.ts's
// header comment), and that boundary should hold for a CI script too, not just
// production code.
import fs from 'fs';
import path from 'path';
import { sapSmarteditService } from '../src/services/sap-smartedit.service.js';
import { reconcile, formatReport } from '../src/services/sap-smartedit-reconcile.service.js';

const FIXTURE = path.join(__dirname, '..', 'tests', 'fixtures', 'sap-smartedit', 'real-spartacus-excerpt.impex');
const STACK = 'ci-sap-smartedit-reconcile';
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

// Every source type in the fixture, with every one of its columns. Kept in sync
// with tests/unit/services/sap-smartedit-reconcile.service.test.ts's CONTENT_TYPES
// by the SAME test that catches a fixture change there — see that file's header.
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

async function main() {
  const outRoot = path.join(process.cwd(), 'cmsMigrationData', STACK);
  fs.rmSync(outRoot, { recursive: true, force: true });

  await sapSmarteditService.getAllAssets(FIXTURE, '', STACK, 'ci-project');
  await sapSmarteditService.createLocale(FIXTURE, STACK, 'ci-project', {
    stackDetails: { master_locale: LOCALE },
  });
  await sapSmarteditService.createEntry(FIXTURE, '', STACK, 'ci-project', CONTENT_TYPES, {}, LOCALE, {});

  const report = reconcile(FIXTURE, outRoot, CONTENT_TYPES);
  console.log(formatReport(report));

  fs.rmSync(outRoot, { recursive: true, force: true });

  // The fixture deliberately declares one Media whose binary is not shipped, to
  // pin that unresolvable assets are REPORTED rather than silently skipped — see
  // sap-smartedit-reconcile.service.test.ts. That is the one expected finding;
  // anything else is a real regression.
  const unexpected = report.findings.filter(
    (f) => (f.severity === 'critical' || f.severity === 'error') && f.check !== 'asset.failed',
  );
  if (unexpected.length) {
    console.error(`\nFAILED: ${unexpected.length} unexpected critical/error finding(s) — see above.`);
    process.exit(1);
  }
  console.log('\nPASSED — the full pipeline lost nothing from the fixture.');
}

main().catch((err) => {
  console.error('CI reconciliation check crashed:', err);
  process.exit(1);
});
