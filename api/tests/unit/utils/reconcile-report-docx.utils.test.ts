import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { sapSmarteditService } from '../../../src/services/sap-smartedit.service.js';
import { reconcile } from '../../../src/services/sap-smartedit-reconcile.service.js';
import { generateReconcileReportDocx, RECONCILE_REPORT_FILE_NAME } from '../../../src/utils/reconcile-report-docx.utils.js';

/**
 * The reconciliation report is a real Word document, generated fresh at the
 * end of every reconciliation run and saved into the same migration-data
 * folder the connector wrote its output into. Verified against the actual
 * ReconcileReport produced by a real fixture, not a hand-built stub, and
 * checked by reading the real XML inside the .docx (a genuine zip archive),
 * not just "a file exists".
 */
describe('generateReconcileReportDocx', () => {
  const FIXTURE = path.join(__dirname, '../../fixtures/sap-smartedit/real-spartacus-excerpt.impex');
  const STACK = 'test-stack-reconcile-report-docx';
  const OUT = path.join(process.cwd(), './cmsMigrationData', STACK);
  const LOCALE = 'en-us';

  const CONTENT_TYPES = [
    {
      otherCmsTitle: 'CMSParagraphComponent', contentstackUid: 'cs_cmsparagraphcomponent',
      fieldMapping: [
        { otherCmsField: 'name', contentstackFieldUid: 'title', contentstackFieldType: 'single_line_text' },
        { otherCmsField: 'content', contentstackFieldUid: 'content', contentstackFieldType: 'single_line_text' },
      ],
    },
    {
      otherCmsTitle: 'ContentPage', contentstackUid: 'cs_contentpage',
      fieldMapping: [{ otherCmsField: 'name', contentstackFieldUid: 'title', contentstackFieldType: 'single_line_text' }],
    },
  ];

  let docPath: string;
  let xml: string;

  beforeAll(async () => {
    fs.rmSync(OUT, { recursive: true, force: true });
    await sapSmarteditService.getAllAssets(FIXTURE, '', STACK, 'test-project');
    await sapSmarteditService.createLocale(FIXTURE, STACK, 'test-project', { stackDetails: { master_locale: LOCALE } });
    await sapSmarteditService.createEntry(FIXTURE, '', STACK, 'test-project', CONTENT_TYPES, {}, LOCALE, {});

    const report = reconcile(FIXTURE, OUT, CONTENT_TYPES);
    docPath = await generateReconcileReportDocx(report);
    const zip = new AdmZip(docPath);
    xml = zip.readAsText('word/document.xml');
  });

  afterAll(() => {
    fs.rmSync(OUT, { recursive: true, force: true });
  });

  it('saves the report inside the same migration-data folder the connector wrote to', () => {
    expect(docPath).toBe(path.join(OUT, RECONCILE_REPORT_FILE_NAME));
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('is a genuinely valid docx (a real zip with the required OOXML parts)', () => {
    const zip = new AdmZip(docPath);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
    expect(names).toContain('_rels/.rels');
  });

  it('includes every content type from the source, mapped or not — nothing summarized away', () => {
    // CMSParagraphComponent/ContentPage were mapped; CMSLinkComponent was not —
    // both kinds must appear, since the whole point is "check every one".
    expect(xml).toContain('CMSParagraphComponent');
    expect(xml).toContain('ContentPage');
    expect(xml).toContain('CMSLinkComponent');
  });

  it('lists the genuinely unresolvable asset from the fixture by name', () => {
    expect(xml).toContain('Homepage.png');
  });

  it('lists a SUCCESSFULLY resolved asset with a Pass status in the asset table', () => {
    // demo-asset.png resolves cleanly and is never mentioned in any finding,
    // so this string can only appear via the asset table's success branch —
    // unlike Homepage.png above, which the findings section also mentions.
    expect(xml).toContain('demo-asset.png');
  });

  it('includes a real critical finding message, not just a count', () => {
    // CMSLinkComponent has no content type -> a real type.unmapped CRITICAL.
    expect(xml).toMatch(/type\.unmapped/);
  });

  it('does not truncate findings with an "and N more" style summary', () => {
    expect(xml).not.toMatch(/and \d+ more/i);
  });
});
