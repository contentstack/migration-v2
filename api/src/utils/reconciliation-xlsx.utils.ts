import ExcelJS from 'exceljs';
import type { ReconcileReport } from '../services/sap-smartedit-reconcile.service.js';

/**
 * Builds the same customer-shareable, 3-sheet workbook (Summary / Per Content Type /
 * Findings) that a manually-run `/reconcile` has always produced — so the AUTOMATIC
 * post-migration check hands back something that can actually be handed to a customer
 * or a manager, not the raw JSON reconcile() itself returns.
 */
export async function writeReconciliationWorkbook(
  report: ReconcileReport,
  meta: { stackId: string; sourcePath: string },
  outPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 30 },
    { header: 'Value', key: 'value', width: 80 },
  ];
  summarySheet.addRows([
    { field: 'Stack ID', value: meta.stackId },
    { field: 'Source Path', value: meta.sourcePath },
    { field: 'Migration Dir', value: report.migrationDir },
    { field: 'Type Mapping Source', value: report.typeMappingSource },
    { field: 'Source Types', value: report.summary.sourceTypes },
    { field: 'Source Rows', value: report.summary.sourceRows },
    { field: 'Content Types (found live)', value: report.summary.contentTypes },
    { field: 'Entries Written', value: report.summary.entriesWritten },
    { field: 'Locales Declared', value: (report.summary.localesDeclared ?? []).join(', ') },
    { field: 'Assets Declared', value: report.summary.assetsDeclared },
    { field: 'Assets Written', value: report.summary.assetsWritten },
    { field: 'Critical Findings', value: report.summary.critical },
    { field: 'Error Findings', value: report.summary.error },
    { field: 'Warning Findings', value: report.summary.warning },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const perTypeSheet = workbook.addWorksheet('Per Content Type');
  perTypeSheet.columns = [
    { header: 'Source Type', key: 'sourceType', width: 30 },
    { header: 'Source Rows', key: 'sourceRows', width: 15 },
    { header: 'Entries Found Live', key: 'entries', width: 20 },
    { header: 'Content Type UID', key: 'contentTypeUid', width: 30 },
  ];
  for (const row of report.perType ?? []) {
    perTypeSheet.addRow({
      sourceType: row.sourceType,
      sourceRows: row.sourceRows,
      entries: row.entries,
      contentTypeUid: row.contentTypeUid ?? '',
    });
  }
  perTypeSheet.getRow(1).font = { bold: true };

  const findingsSheet = workbook.addWorksheet('Findings');
  findingsSheet.columns = [
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Check', key: 'check', width: 28 },
    { header: 'Source Type', key: 'sourceType', width: 24 },
    { header: 'ID', key: 'id', width: 24 },
    { header: 'Locale', key: 'locale', width: 10 },
    { header: 'Detail', key: 'detail', width: 100 },
  ];
  const severityFill: Record<string, string> = {
    critical: 'FFF8D7DA',
    error: 'FFFDEBD0',
    warning: 'FFFFF3CD',
  };
  for (const f of report.findings ?? []) {
    const row = findingsSheet.addRow({
      severity: f.severity,
      check: f.check,
      sourceType: f.sourceType ?? '',
      id: f.id ?? '',
      locale: f.locale ?? '',
      detail: f.detail,
    });
    const fill = severityFill[f.severity];
    if (fill) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
    }
  }
  findingsSheet.getRow(1).font = { bold: true };
  findingsSheet.autoFilter = { from: 'A1', to: 'F1' };

  await workbook.xlsx.writeFile(outPath);
}
