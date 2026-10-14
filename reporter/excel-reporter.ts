/**
 * Playwright reporter that writes an Excel defect report after every run:
 *   reports/CRM_Defect_Report_<yyyy-mm-dd_HHmm>.xlsx
 *
 * Sheets
 *   Summary      – run details, pass/fail totals, defects by severity and module (live formulas)
 *   Defects      – one row per failed test case: steps, expected, actual, values, screenshot,
 *                  trace link, plus Status / Assigned To / Dev Comments for the dev team
 *   All Results  – every test case with its status and duration
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import ExcelJS from 'exceljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { caseInfo, priorityOf, Severity } from '../tests/test-catalog';

type Row = { test: TestCase; result: TestResult; id: string; title: string; status: string; attempts: number };

const FONT = 'Arial';
const HEADER_FILL = 'FF12465B';
const SEV_FILL: Record<Severity, string> = { Critical: 'FFC00000', High: 'FFF4B183', Medium: 'FFFFE699', Low: 'FFD9D9D9' };
const STATUS_FILL: Record<string, string> = { Passed: 'FFC6EFCE', Failed: 'FFFFC7CE', Flaky: 'FFFFEB9C', Skipped: 'FFEDEDED', 'Timed out': 'FFFFC7CE' };
const DEV_STATUSES = ['New', 'In Progress', 'Fixed', 'Ready for Retest', 'Closed', 'Not a Bug', 'Duplicate'];

const strip = (s = '') => s.replace(/\u001b\[[0-9;]*m/g, '');
const pad = (n: number) => String(n).padStart(2, '0');
/** Excel has no time zones: store the local clock time so the sheet shows the tester's time. */
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000);

/** Catalog info, with the expected result a test declares (annotation "expected") taking precedence. */
function infoOf(r: Row) {
  const info = caseInfo(r.id, r.title);
  const expected = r.test.annotations.find(a => a.type === 'expected')?.description;
  return expected ? { ...info, expected } : info;
}

function splitId(title: string) {
  const m = title.match(/^([A-Z]+(?:-[A-Z]+)*-\d+(?:\.\d+)?)\s+(.*)$/);
  return m ? { id: m[1], title: m[2] } : { id: title.slice(0, 20), title };
}

/** Turns Playwright assertion errors into "what was wrong" lines for the dev team. */
function actualResult(result: TestResult): { actual: string; details: string } {
  const lines: string[] = [];
  const details: string[] = [];
  for (const e of result.errors) {
    const msg = strip(e.message ?? e.value ?? '');
    details.push(msg.split('\n').slice(0, 12).join('\n'));
    const head = msg.split(/\n\s*(?:expect\(|Call log:)/)[0].replace(/^Error:\s*/, '').trim();
    const exp = msg.match(/^\s*Expected(?: pattern)?:\s*(.+)$/m)?.[1]?.trim();
    const rec = msg.match(/^\s*Received(?: string)?:\s*(.+)$/m)?.[1]?.trim();
    // toBeTruthy() checks carry the values in their message and have no "Expected:" line
    if (head.includes('\n') || !rec || !exp) lines.push(head || msg.split('\n')[0]);
    else lines.push(`${head}: expected ${exp}, actual ${rec}`);
  }
  return { actual: lines.join('\n'), details: details.join('\n\n') };
}

class ExcelReporter implements Reporter {
  private rows = new Map<string, Row>();
  private start = new Date();
  private config!: FullConfig;
  private outDir: string;

  constructor(opts: { outputDir?: string } = {}) {
    this.outDir = process.env.EXCEL_REPORT_DIR ?? opts.outputDir ?? 'reports';
  }

  onBegin(config: FullConfig, _suite: Suite) {
    this.config = config;
    this.start = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const { id, title } = splitId(test.title);
    const outcome = test.outcome();
    const status =
      outcome === 'skipped' ? 'Skipped'
      : outcome === 'flaky' ? 'Flaky'
      : outcome === 'expected' ? 'Passed'
      : result.status === 'timedOut' ? 'Timed out' : 'Failed';
    this.rows.set(test.id, { test, result, id, title, status, attempts: result.retry + 1 });
  }

  async onEnd(full: FullResult) {
    if (!this.rows.size) return; // nothing ran (e.g. --list): don't write an empty report
    const rows = [...this.rows.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    const failed = rows.filter(r => r.status === 'Failed' || r.status === 'Timed out');
    const root = this.config.rootDir ? path.dirname(this.config.configFile ?? this.config.rootDir) : process.cwd();
    const outDir = path.resolve(root, this.outDir);
    fs.mkdirSync(outDir, { recursive: true });
    const d = this.start;
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    const file = path.join(outDir, `CRM_Defect_Report_${stamp}.xlsx`);
    const rel = (p: string) => path.relative(outDir, p).split(path.sep).join('/');
    const baseURL = (this.config.projects[0]?.use as { baseURL?: string })?.baseURL ?? process.env.BASE_URL ?? '';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CRM report automation';
    wb.created = d;

    const sm = wb.addWorksheet('Summary'); // first tab, filled at the end

    // ── Defects ────────────────────────────────────────────────────────────
    const ws = wb.addWorksheet('Defects', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
    ws.columns = [
      { header: 'Defect ID', key: 'defect', width: 11 },
      { header: 'Test Case ID', key: 'id', width: 13 },
      { header: 'Test Case', key: 'title', width: 38 },
      { header: 'Module', key: 'module', width: 18 },
      { header: 'Page URL', key: 'page', width: 34 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Priority', key: 'priority', width: 9 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Steps to Reproduce', key: 'steps', width: 55 },
      { header: 'Expected Result', key: 'expected', width: 42 },
      { header: 'Actual Result', key: 'actual', width: 50 },
      { header: 'Observed Values', key: 'values', width: 45 },
      { header: 'Possible Cause / Hint', key: 'hint', width: 38 },
      { header: 'Screenshot', key: 'shot', width: 36 },
      { header: 'Evidence Links', key: 'links', width: 20 },
      { header: 'Error Details', key: 'details', width: 60 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Assigned To', key: 'owner', width: 16 },
      { header: 'Dev Comments', key: 'comments', width: 30 },
      { header: 'Detected On', key: 'date', width: 17 },
      { header: 'Browser', key: 'browser', width: 11 },
    ];

    failed.forEach((r, i) => {
      const info = infoOf(r);
      const { actual, details } = actualResult(r.result);
      const values = r.test.annotations
        .concat(r.result.annotations ?? [])
        .filter(a => a.description && a.type !== 'expected')
        .map(a => `${a.type}: ${a.description}`)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .join('\n');
      const shot = r.result.attachments.find(a => a.contentType === 'image/png' && a.path);
      const trace = r.result.attachments.find(a => a.name === 'trace' && a.path);
      const row = ws.addRow({
        defect: `DEF-${String(i + 1).padStart(3, '0')}`,
        id: r.id,
        title: r.title,
        module: info.module,
        page: { text: info.page, hyperlink: info.page },
        severity: info.severity,
        priority: priorityOf(info.severity),
        category: info.category,
        steps: info.steps.map((s, n) => `${n + 1}. ${s}`).join('\n'),
        expected: info.expected,
        actual,
        values,
        hint: info.hint ?? '',
        shot: shot ? '' : 'No screenshot',
        links: shot ? { text: 'Open screenshot', hyperlink: rel(shot.path!) } : '',
        details: details.slice(0, 4000),
        status: 'New',
        owner: '',
        comments: '',
        date: local(d),
        browser: r.test.parent.project()?.name || 'chromium',
      });
      row.getCell('date').numFmt = 'dd-mmm-yyyy hh:mm';
      row.getCell('severity').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEV_FILL[info.severity] } };
      if (info.severity === 'Critical') row.getCell('severity').font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      row.getCell('status').dataValidation = { type: 'list', allowBlank: false, formulae: [`"${DEV_STATUSES.join(',')}"`] };
      row.getCell('owner').fill = row.getCell('comments').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } };
      row.height = shot ? 125 : Math.min(180, 15 * Math.max(4, info.steps.length + 1, actual.split('\n').length + 1));
      if (shot && fs.existsSync(shot.path!)) {
        const img = wb.addImage({ filename: shot.path!, extension: 'png' });
        ws.addImage(img, { tl: { col: 13.05, row: row.number - 1 + 0.05 }, ext: { width: 240, height: 150 }, hyperlinks: { hyperlink: rel(shot.path!), tooltip: 'Open full screenshot' } } as never);
      }
      if (trace) {
        const c = row.getCell('links');
        if (!shot) c.value = { text: 'Open trace', hyperlink: rel(trace.path!) };
        c.note = `Replay the failure step by step:\nnpx playwright show-trace "${path.relative(root, trace.path!)}"`;
      }
    });
    if (!failed.length) ws.addRow({ defect: '—', title: 'No defects found in this run', status: '' });
    style(ws);
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
    ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } };

    // ── All Results ──────────────────────────────────────────────────────────
    const all = wb.addWorksheet('All Results', { views: [{ state: 'frozen', ySplit: 1 }] });
    all.columns = [
      { header: 'Test Case ID', key: 'id', width: 13 },
      { header: 'Test Case', key: 'title', width: 60 },
      { header: 'Module', key: 'module', width: 20 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Status', key: 'status', width: 11 },
      { header: 'Duration (s)', key: 'dur', width: 12 },
      { header: 'Attempts', key: 'att', width: 9 },
      { header: 'Failure Summary', key: 'fail', width: 70 },
      { header: 'Spec File', key: 'file', width: 34 },
    ];
    for (const r of rows) {
      const info = infoOf(r);
      const row = all.addRow({
        id: r.id, title: r.title, module: info.module, severity: info.severity, status: r.status,
        dur: Math.round(r.result.duration / 100) / 10, att: r.attempts,
        fail: r.status === 'Failed' || r.status === 'Timed out' ? actualResult(r.result).actual.replace(/\s*\n\s*/g, ' | ').replace(/:\s*\|/g, ':').slice(0, 300) : r.status === 'Skipped' ? (r.test.annotations.find(a => a.type === 'skip')?.description ?? 'Skipped') : '',
        file: `${path.relative(root, r.test.location.file).split(path.sep).join('/')}:${r.test.location.line}`,
      });
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[r.status] ?? 'FFFFFFFF' } };
      row.getCell('dur').numFmt = '0.0';
    }
    style(all);
    all.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
    all.autoFilter = { from: 'A1', to: { row: 1, column: all.columnCount } };

    // ── Summary (first tab) ───────────────────────────────────────────────────
    sm.columns = [{ width: 30 }, { width: 22 }, { width: 4 }, { width: 24 }, { width: 12 }];
    const n = rows.length + 1; // last data row in All Results
    const fd = Math.max(2, failed.length + 1); // last data row in Defects
    const count = (st: string) => rows.filter(r => r.status === st).length;
    const passed = count('Passed'), failCount = failed.length, skipped = count('Skipped'), flaky = count('Flaky');
    const executed = rows.length - skipped;

    sm.getCell('A1').value = 'CRM Reports & Analytics — Automated Test Report';
    sm.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: HEADER_FILL } };
    const info: [string, ExcelJS.CellValue, string?][] = [
      ['Run started', local(d), 'dd-mmm-yyyy hh:mm'],
      ['Duration (min)', Math.round((Date.now() - d.getTime()) / 6000) / 10, '0.0'],
      ['Environment', baseURL],
      ['Overall result', full.status === 'passed' ? 'PASSED' : 'FAILED'],
      ['Total test cases', { formula: `COUNTA('All Results'!A2:A${n})`, result: rows.length }],
      ['Passed', { formula: `COUNTIF('All Results'!E2:E${n},"Passed")`, result: passed }],
      ['Failed (defects)', { formula: `COUNTIF('All Results'!E2:E${n},"Failed")+COUNTIF('All Results'!E2:E${n},"Timed out")`, result: failCount }],
      ['Flaky (passed on retry)', { formula: `COUNTIF('All Results'!E2:E${n},"Flaky")`, result: flaky }],
      ['Skipped', { formula: `COUNTIF('All Results'!E2:E${n},"Skipped")`, result: skipped }],
      ['Pass rate (excl. skipped)', { formula: `IFERROR((B8+B10)/(B7-B11),0)`, result: executed ? (passed + flaky) / executed : 0 }, '0.0%'],
    ];
    info.forEach(([k, v, fmt], i) => {
      const r = 3 + i;
      sm.getCell(`A${r}`).value = k;
      sm.getCell(`A${r}`).font = { name: FONT, size: 10, bold: true };
      const c = sm.getCell(`B${r}`);
      c.value = v;
      c.font = { name: FONT, size: 10 };
      c.alignment = { horizontal: 'left' };
      if (fmt) c.numFmt = fmt;
    });
    const res = sm.getCell('B6');
    res.font = { name: FONT, size: 10, bold: true, color: { argb: full.status === 'passed' ? 'FF006100' : 'FF9C0006' } };

    const table = (startRow: number, title: string, items: string[], col: string) => {
      sm.getCell(`D${startRow}`).value = title;
      sm.getCell(`E${startRow}`).value = 'Defects';
      ['D', 'E'].forEach(c => {
        const cell = sm.getCell(`${c}${startRow}`);
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      });
      items.forEach((it, i) => {
        const r = startRow + 1 + i;
        sm.getCell(`D${r}`).value = it;
        sm.getCell(`D${r}`).font = { name: FONT, size: 10 };
        const result = failed.filter(f => (col === 'F' ? caseInfo(f.id, f.title).severity : caseInfo(f.id, f.title).module) === it).length;
        sm.getCell(`E${r}`).value = { formula: `COUNTIF(Defects!${col}2:${col}${fd},D${r})`, result };
        sm.getCell(`E${r}`).font = { name: FONT, size: 10 };
        if (col === 'F') sm.getCell(`D${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEV_FILL[it as Severity] } };
      });
      const tr = startRow + 1 + items.length;
      sm.getCell(`D${tr}`).value = 'Total';
      sm.getCell(`E${tr}`).value = { formula: `SUM(E${startRow + 1}:E${tr - 1})`, result: failed.length };
      sm.getCell(`D${tr}`).font = sm.getCell(`E${tr}`).font = { name: FONT, size: 10, bold: true };
      return tr + 2;
    };
    let next = table(3, 'Severity', ['Critical', 'High', 'Medium', 'Low'], 'F');
    const modules = [...new Set(failed.map(f => caseInfo(f.id, f.title).module))].sort();
    if (modules.length) table(next, 'Module', modules, 'D');

    const noteRow = 15;
    sm.getCell(`A${noteRow}`).value = 'How to use';
    sm.getCell(`A${noteRow}`).font = { name: FONT, size: 10, bold: true };
    [
      'Defects tab: one row per failed test case. Dev team updates Status, Assigned To and Dev Comments (yellow cells).',
      'Screenshot and Evidence Links open the files in the test-results folder next to this report.',
      'Trace: hover the Evidence Links cell for the command that replays the failed test step by step.',
      'All Results tab: every test case in this run, with status and duration.',
    ].forEach((t, i) => {
      const c = sm.getCell(`A${noteRow + 1 + i}`);
      c.value = `• ${t}`;
      c.font = { name: FONT, size: 9, color: { argb: 'FF595959' } };
    });

    try {
      await wb.xlsx.writeFile(file);
      console.log(`\n📊 Excel report: ${file}  (${failCount} defect${failCount === 1 ? '' : 's'}, ${passed} passed, ${skipped} skipped)\n`);
    } catch (e) {
      console.error(`\n✖ Could not write Excel report (is it open in Excel?): ${(e as Error).message}\n`);
    }
  }

  printsToStdio() {
    return false;
  }
}

function style(ws: ExcelJS.Worksheet) {
  ws.eachRow((row, i) => {
    row.eachCell({ includeEmpty: true }, cell => {
      const isHeader = i === 1;
      cell.font = { ...(cell.font ?? {}), name: FONT, size: isHeader ? 10 : 9, bold: isHeader || cell.font?.bold, ...(isHeader ? { color: { argb: 'FFFFFFFF' } } : {}) };
      if (cell.hyperlink && !isHeader) cell.font = { name: FONT, size: 9, color: { argb: 'FF0563C1' }, underline: true };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
      if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
    if (i === 1) row.height = 22;
  });
}

export default ExcelReporter;
