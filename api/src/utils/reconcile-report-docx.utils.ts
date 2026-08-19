import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx';
import { MIGRATION_DATA_CONFIG } from '../constants/index.js';
import type { ReconcileReport, Severity } from '../services/sap-smartedit-reconcile.service.js';

const { ASSETS_DIR_NAME } = MIGRATION_DATA_CONFIG;

const PAGE_WIDTH_DXA = 12240;
const MARGIN_DXA = 1080;
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - MARGIN_DXA * 2;

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'CRITICAL',
  error: 'ERROR',
  warning: 'WARNING',
  info: 'INFO',
};

const SEVERITY_FILL: Record<Severity, string> = {
  critical: 'F8D7DA',
  error: 'FCE8B2',
  warning: 'FFF3CD',
  info: 'E2E3E5',
};

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ heading: level, children: [new TextRun(text)], spacing: { before: 240, after: 120 } });
}

function cell(text: string, opts: { width: number; header?: boolean; fill?: string }): TableCell {
  return new TableCell({
    borders,
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: !!opts.header })],
      }),
    ],
  });
}

function table(columnWidths: number[], header: string[], rows: string[][]): Table {
  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) => cell(h, { width: columnWidths[i], header: true, fill: 'E8E8F0' })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) => cell(v, { width: columnWidths[i] })),
          }),
      ),
    ],
  });
}

/** Every declared/discovered asset, success and failure alike — read directly off disk. */
function buildAssetRows(migrationDir: string): string[][] {
  const index = readJson(path.join(migrationDir, ASSETS_DIR_NAME, 'index.json')) ?? {};
  const failed = readJson(path.join(migrationDir, ASSETS_DIR_NAME, 'logs', 'assets', 'cs_failed.json')) ?? {};

  const rows: string[][] = [];
  for (const [key, asset] of Object.entries<any>(index)) {
    rows.push([key, asset?.filename ?? '(unknown)', 'Pass', '']);
  }
  for (const [key, reason] of Object.entries<string>(failed)) {
    rows.push([key, '(unresolved)', 'Fail', String(reason)]);
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows;
}

/**
 * Every content type the source declared, one row each, no truncation — the
 * total number of content types is always small (tens, not thousands), so
 * this list is exhaustive by construction already.
 */
function buildContentTypeRows(report: ReconcileReport): string[][] {
  return report.perType.map((t) => {
    const mapped = t.contentTypeUid !== null;
    const complete = mapped && t.entries === t.sourceRows;
    const status = !mapped ? 'Unmapped' : complete ? 'Pass' : 'Incomplete';
    return [t.sourceType, String(t.sourceRows), String(t.entries), t.contentTypeUid ?? '(none)', status];
  });
}

function buildLocaleRows(report: ReconcileReport, master: string | null): string[][] {
  return report.summary.localesDeclared.map((code) => [code, code === master ? 'Master' : 'Secondary']);
}

/** Every finding, individually, grouped by severity — nothing summarized or truncated. */
function buildFindingSections(report: ReconcileReport): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const order: Severity[] = ['critical', 'error', 'warning', 'info'];
  for (const sev of order) {
    const group = report.findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    out.push(heading(`${SEVERITY_LABEL[sev]} (${group.length})`, HeadingLevel.HEADING_2));
    const rows = group.map((f) => [
      f.check,
      [f.sourceType, f.id, f.locale].filter(Boolean).join(' / ') || '(n/a)',
      f.detail,
    ]);
    out.push(
      table(
        [1800, 2000, CONTENT_WIDTH_DXA - 3800],
        ['Check', 'Where', 'Detail'],
        rows,
      ),
    );
  }
  if (!report.findings.length) {
    out.push(new Paragraph({ children: [new TextRun('No findings — every source row, value, translation and asset is accounted for.')] }));
  }
  return out;
}

export const RECONCILE_REPORT_FILE_NAME = 'reconciliation-report.docx';

/**
 * Builds and saves a full Word-format reconciliation report into the same
 * migration-data folder the connector wrote its output into — every content
 * type, every locale, every asset, and every finding gets its own line; only
 * the findings section is grouped by severity, nothing is summarized away.
 * Returns the absolute path written.
 */
export async function generateReconcileReportDocx(report: ReconcileReport): Promise<string> {
  const stackId = path.basename(report.migrationDir);
  const generatedAt = new Date().toISOString();
  // loadLocales() (in the reconcile service) always puts the master locale
  // first in this array — see its construction: `all = master ? [master] : []`
  // followed by the secondary locales.
  const masterCode = report.summary.localesDeclared[0] ?? null;

  const assetRows = buildAssetRows(report.migrationDir);
  const contentTypeRows = buildContentTypeRows(report);
  const localeRows = buildLocaleRows(report, masterCode);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_DXA, height: 15840 },
            margin: { top: MARGIN_DXA, right: MARGIN_DXA, bottom: MARGIN_DXA, left: MARGIN_DXA },
          },
        },
        children: [
          heading('SAP SmartEdit Migration — Reconciliation Report', HeadingLevel.HEADING_1),
          new Paragraph({ children: [new TextRun({ text: `Stack: ${stackId}`, bold: true })] }),
          new Paragraph({ children: [new TextRun(`Source: ${report.sourcePath}`)] }),
          new Paragraph({ children: [new TextRun(`Generated: ${generatedAt}`)] }),
          new Paragraph({
            children: [
              new TextRun(
                `Type mapping: ${report.typeMappingSource}${report.typeMappingSource === 'heuristic' ? ' (guessed — a type.unmapped finding here may be a renamed mapping, not real loss)' : ''}`,
              ),
            ],
          }),

          heading('Summary', HeadingLevel.HEADING_2),
          table(
            [CONTENT_WIDTH_DXA / 2, CONTENT_WIDTH_DXA / 2],
            ['Metric', 'Count'],
            [
              ['Source rows', String(report.summary.sourceRows)],
              ['Source types', String(report.summary.sourceTypes)],
              ['Content types', String(report.summary.contentTypes)],
              ['Entries written', String(report.summary.entriesWritten)],
              ['Assets declared', String(report.summary.assetsDeclared)],
              ['Assets written', String(report.summary.assetsWritten)],
              ['Locales declared', report.summary.localesDeclared.join(', ') || '(none)'],
              ['Critical findings', String(report.summary.critical)],
              ['Error findings', String(report.summary.error)],
              ['Warning findings', String(report.summary.warning)],
            ],
          ),

          heading('Content Types', HeadingLevel.HEADING_2),
          table(
            [2600, 1500, 1500, 2000, CONTENT_WIDTH_DXA - 7600],
            ['Source Type', 'Source Rows', 'Entries', 'Content Type UID', 'Status'],
            contentTypeRows,
          ),

          heading('Locales', HeadingLevel.HEADING_2),
          table([CONTENT_WIDTH_DXA / 2, CONTENT_WIDTH_DXA / 2], ['Locale', 'Role'], localeRows),

          heading(`Assets (${assetRows.length})`, HeadingLevel.HEADING_2),
          assetRows.length
            ? table(
                [2200, 2600, 1200, CONTENT_WIDTH_DXA - 6000],
                ['Asset Key', 'Filename', 'Status', 'Reason (if failed)'],
                assetRows,
              )
            : new Paragraph({ children: [new TextRun('No assets declared in this export.')] }),

          heading(`Findings (${report.findings.length})`, HeadingLevel.HEADING_2),
          ...buildFindingSections(report),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(report.migrationDir, RECONCILE_REPORT_FILE_NAME);
  await fs.promises.writeFile(outPath, buffer);
  return outPath;
}
