import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { writeReconciliationWorkbook } from '../../../src/utils/reconciliation-xlsx.utils.js';
import type { ReconcileReport } from '../../../src/services/sap-smartedit-reconcile.service.js';

/**
 * The automatic post-migration reconciliation trigger used to hand back a raw JSON
 * file — not something a customer or manager could actually be given. This writes
 * the SAME 3-sheet workbook a manually-run /reconcile has always produced. Runs
 * against a real temp file with the real `fs`/exceljs (not the mocked `fs` other
 * runCli.service tests use, which silently swallows exceljs's own file-writing and
 * would let a genuinely broken workbook generator look fine via the JSON fallback).
 */
const OUT_DIR = path.join(process.cwd(), '.tmp-reconciliation-xlsx-test');

const sampleReport: ReconcileReport = {
  sourcePath: '/src/catalog.impex',
  migrationDir: '/tmp/migration-dir',
  typeMappingSource: 'authoritative',
  summary: {
    sourceTypes: 2,
    sourceRows: 15,
    contentTypes: 2,
    entriesWritten: 15,
    localesDeclared: ['en-us', 'de-de'],
    assetsDeclared: 3,
    assetsWritten: 3,
    critical: 1,
    error: 1,
    warning: 2,
  },
  perType: [
    { sourceType: 'ContentPage', sourceRows: 10, entries: 10, contentTypeUid: 'cs_contentpage' },
    { sourceType: 'ContentSlot', sourceRows: 5, entries: 5, contentTypeUid: 'cs_contentslot' },
  ],
  findings: [
    { severity: 'critical', check: 'row.missing', sourceType: 'ContentPage', id: 'page1', detail: 'Source row "page1" has no entry in the destination.' },
    { severity: 'error', check: 'field.missing', sourceType: 'ContentSlot', id: 'slot1', locale: 'de-de', detail: 'Source value for "cmsComponents" is not present.' },
    { severity: 'warning', check: 'label.droppedForAmbiguity', sourceType: 'ContentPage', id: 'page2', detail: 'Label shared by several rows.' },
    { severity: 'warning', check: 'row.extra', sourceType: 'ContentSlot', detail: 'Entry exists in destination but matches no source row.' },
  ],
};

afterEach(() => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
});

describe('writeReconciliationWorkbook', () => {
  it('writes a real, readable .xlsx file with Summary, Per Content Type, and Findings sheets', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'report.xlsx');

    await writeReconciliationWorkbook(sampleReport, { stackId: 'stack123', sourcePath: '/src/catalog.impex' }, outPath);

    expect(fs.existsSync(outPath)).toBe(true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outPath);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Summary', 'Per Content Type', 'Findings']);
  });

  it('Summary sheet reports the correct finding counts and stack id', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'report.xlsx');
    await writeReconciliationWorkbook(sampleReport, { stackId: 'stack123', sourcePath: '/src/catalog.impex' }, outPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outPath);
    const summary = workbook.getWorksheet('Summary')!;
    const rows: Record<string, any> = {};
    summary.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows[String(row.getCell(1).value)] = row.getCell(2).value;
    });

    expect(rows['Stack ID']).toBe('stack123');
    expect(rows['Critical Findings']).toBe(1);
    expect(rows['Error Findings']).toBe(1);
    expect(rows['Warning Findings']).toBe(2);
  });

  it('Findings sheet contains one row per finding with severity and detail', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'report.xlsx');
    await writeReconciliationWorkbook(sampleReport, { stackId: 'stack123', sourcePath: '/src/catalog.impex' }, outPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outPath);
    const findings = workbook.getWorksheet('Findings')!;
    // header row + 4 findings
    expect(findings.rowCount).toBe(5);
    expect(findings.getRow(2).getCell(1).value).toBe('critical');
    expect(findings.getRow(2).getCell(6).value).toContain('no entry in the destination');
  });

  it('Per Content Type sheet has one row per source type', async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'report.xlsx');
    await writeReconciliationWorkbook(sampleReport, { stackId: 'stack123', sourcePath: '/src/catalog.impex' }, outPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outPath);
    const perType = workbook.getWorksheet('Per Content Type')!;
    expect(perType.rowCount).toBe(3); // header + 2 types
    expect(perType.getRow(2).getCell(1).value).toBe('ContentPage');
    expect(perType.getRow(2).getCell(4).value).toBe('cs_contentpage');
  });
});
