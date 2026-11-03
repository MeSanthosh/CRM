/**
 * Playwright reporter that writes an Excel defect report after every run, named after the page tested:
 *   reports/<Page>_Test_Report_<yyyy-mm-dd_HHmm>.xlsx   e.g. Leads_Page_Test_Report_2026-10-20_1015.xlsx
 *   reports/CRM_Defect_Report_<yyyy-mm-dd_HHmm>.xlsx    when the run covers several pages
 *   (REPORT_NAME=<name> overrides the first part)
 *
 * Sheets
 *   Summary      – run details, pass/fail totals, defects by severity and module (live formulas)
 *   Defects      – one row per failed test case: steps, expected, actual, values, screenshot,
 *                  trace link, plus Status / Assigned To / Dev Comments for the dev team
 *   All Results  – every test case with its status, duration, steps, expected and actual result
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import ExcelJS from 'exceljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { caseInfo, priorityOf, reportPageOf, Severity } from '../tests/test-catalog';

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

/** What happened, for the All Results sheet: the failure, the skip reason, or the values the test recorded. */
function actualText(r: Row): string {
  if (r.status === 'Skipped') return r.test.annotations.find(a => a.type === 'skip')?.description ?? 'Skipped';
  const seen = r.test.annotations.concat(r.result.annotations ?? []).filter(a => a.description && a.type !== 'expected' && a.type !== 'skip')
    .map(a => `${a.type}: ${a.description}`).filter((v, i, arr) => arr.indexOf(v) === i);
  const head = r.status === 'Failed' || r.status === 'Timed out' ? actualResult(r.result).actual : 'As expected';
  return [head, ...seen].join('\n').slice(0, 3000);
}

function splitId(title: string) {
  const m = title.match(/^([A-Z]+(?:-[A-Z]+)*-\d+(?:\.\d+)?)\s+(.*)$/);
  return m ? { id: m[1], title: m[2] } : { id: title.slice(0, 20), title };
}

const cut = (s = '', n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);
const plain = (v?: string) => (v ?? '').replace(/^"(.*)"$/s, '$1').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * One Playwright error as a sentence a manual tester can read:
 * "<what was checked> — Expected: <value>. Actual: <value>."
 */
export function humanize(raw: string): string {
  const m = strip(raw);
  const what = m.split(/\n\s*(?:expect\(|Call log:)/)[0].replace(/^Error:\s*/, '').split('\n')[0].trim() || 'Check';
  const val = (re: RegExp) => plain(m.match(re)?.[1]);
  const exp = val(/^\s*Expected(?: substring| pattern| value| string)?:\s*(.+)$/m);
  const rec = val(/^\s*Received(?: string| value)?:\s*(.+)$/m);
  const matcher = m.match(/expect\((?:received|locator)\)\.(not\.)?(\w+)/);
  if (!matcher) {
    const t = m.match(/Test timeout of (\d+)ms exceeded/);
    if (t) return `The test did not finish within ${Math.round(Number(t[1]) / 60_000)} minutes: the page stopped responding at the step shown in the screenshot.`;
    const net = m.match(/net::ERR_[A-Z_]+/);
    if (net) return `The site could not be reached (${net[0]}). Not an application defect if the network was down.`;
    if (/Timeout \d+ms exceeded/.test(m)) {
      const w = val(/waiting for (.+)$/m);
      return `${what.replace(/:\s*Timeout.*$/, '')}: the page did not show the expected element in time${w ? ` (waited for ${cut(w, 120)})` : ''}.`;
    }
    return cut(what, 400);
  }
  const not = !!matcher[1];
  const added = m.split('\n').filter(l => /^\+\s/.test(l) && !/^\+ Received/.test(l)).map(l => l.slice(1).trim()).join(' ');
  const actual = cut(rec || plain(added) || 'something else');
  switch (matcher[2]) {
    case 'toBeTruthy': return `${what} — Expected: yes. Actual: ${not ? 'yes' : 'no'}.`;
    case 'toBeFalsy': return `${what} — Expected: no. Actual: ${not ? 'no' : 'yes'}.`;
    case 'toContain': return `${what} — Expected to ${not ? 'not ' : ''}contain: "${cut(exp, 150)}". Actual: "${actual}".`;
    case 'toMatch': return `${what} — Expected to ${not ? 'not ' : ''}match ${cut(exp, 150)}. Actual: "${actual}".`;
    case 'toBeGreaterThan': return `${what} — Expected: more than ${exp.replace(/^>\s*/, '')}. Actual: ${actual}.`;
    case 'toBeGreaterThanOrEqual': return `${what} — Expected: at least ${exp.replace(/^>=\s*/, '')}. Actual: ${actual}.`;
    case 'toBeLessThan': return `${what} — Expected: less than ${exp.replace(/^<\s*/, '')}. Actual: ${actual}.`;
    case 'toBeLessThanOrEqual': return `${what} — Expected: at most ${exp.replace(/^<=\s*/, '')}. Actual: ${actual}.`;
    case 'toBeCloseTo': return `${what} — Expected: about ${exp}. Actual: ${actual}.`;
    case 'toBeAttached': return `${what} — Expected: present on the page. Actual: ${not ? 'present' : 'not found on the page'}.`;
    case 'toBeHidden': return `${what} — Expected: hidden. Actual: still shown.`;
    case 'toBeVisible': return `${what} — Expected: ${not ? 'hidden' : 'shown on the page'}. Actual: ${not ? 'shown' : 'not shown'}.`;
    case 'toEqual': case 'toStrictEqual': {
      if (exp && rec) return `${what} — Expected: ${cut(exp, 200)}. Actual: ${actual}.`;
      // diff output: "  " = in both, "- " = expected only, "+ " = received only
      const diff = m.split('\n').filter(l => /^[-+ ] /.test(l) && !/^[-+] (Expected|Received)/.test(l));
      const side = (keep: string) => diff.filter(l => l[0] === ' ' || l[0] === keep).map(l => l.slice(2).trim())
        .filter(l => !/^(Array \[|Object \{|\]|\})$/.test(l)).map(l => l.replace(/,$/, '').replace(/^"(.*)"$/, '$1')).join(', ');
      const e = side('-').replace(/^Array \[\]$/, ''), a = side('+').replace(/^Array \[\]$/, '');
      return `${what} — Expected: ${cut(e, 200) || 'none'}. Actual: ${cut(a, 300) || 'none'}.`;
    }
    default: {
      // Playwright already writes "Expected: not X" for .not matchers
      const e = cut(exp.replace(/^not\s+/, ''), 200) || 'the value in Expected Result';
      return not ? `${what} — Expected: anything except ${e}. Actual: ${actual}.` : `${what} — Expected: ${e}. Actual: ${actual}.`;
    }
  }
}

/** Turns Playwright assertion errors into "what was wrong" lines for the dev team. */
function actualResult(result: TestResult): { actual: string; details: string } {
  const lines: string[] = [];
  const details: string[] = [];
  for (const e of result.errors) {
    const msg = strip(e.message ?? e.value ?? '');
    details.push(msg.split('\n').slice(0, 12).join('\n'));
    lines.push(humanize(msg));
  }
  return { actual: [...new Set(lines)].join('\n'), details: details.join('\n\n') };
}

/**
 * Actual Result of a defect, for a reader who did not write the test:
 * "What happened" (each failed check in plain words) and the values the test saw on the page.
 */
export function readableActual(failures: string, notes: { type: string; description?: string }[]): string {
  const seen = notes.filter(a => a.description && a.type !== 'expected' && a.type !== 'skip' && !DATA_NOTES.test(a.type))
    .map(a => `• ${a.type}: ${cut(a.description!, 300)}`).filter((v, i, arr) => arr.indexOf(v) === i);
  const what = failures.split('\n').filter(Boolean).map(l => `• ${l}`);
  return ['What happened:', ...what, ...(seen.length ? ['', 'What the test saw on the page:', ...seen] : [])].join('\n').slice(0, 3000);
}

/**
 * A test that failed on its first try and on the retry: what the earlier try saw too, so the reader can tell the
 * repeated defect from a number moved by other activity on the shared QA site (failures of the test machine left out).
 */
function earlierAttempts(r: Row): string {
  const earlier = r.test.results.filter(x => x !== r.result && (x.status === 'failed' || x.status === 'timedOut'));
  const out: string[] = [];
  earlier.forEach(x => {
    const checks = actualResult(x).actual.split('\n').filter(l => l && !/ENOENT|playwright-artifacts|\.trace\b/.test(l));
    if (!checks.length) return;
    const seen = (x.annotations ?? []).filter(a => a.description && /^(before|after)$/i.test(a.type)).map(a => `   ${a.type}: ${cut(a.description!, 300)}`);
    out.push(`Attempt ${x.retry + 1} of ${r.test.results.length} (the result above is attempt ${r.result.retry + 1}):`, ...checks.map(l => `• ${l}`), ...seen);
  });
  return out.length ? `\n\n${out.join('\n')}`.slice(0, 1500) : '';
}

/** Annotation types that name the data a test typed or created: listed under the steps so a failure can be repeated by hand. */
const DATA_NOTES = /test data|created|test user|record|used|input/i;
function reproSteps(r: Row, steps: string[]): string {
  const data = r.test.annotations.concat(r.result.annotations ?? [])
    .filter(a => a.description && DATA_NOTES.test(a.type) && a.type !== 'expected')
    .map(a => `   • ${a.type}: ${cut(a.description, 400)}`).filter((v, i, arr) => arr.indexOf(v) === i);
  return [...steps.map((s, n) => `${n + 1}. ${s}`), ...(data.length ? ['', 'Data used in this run:', ...data] : [])].join('\n');
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
    const pages = [...new Set(rows.map(r => reportPageOf(r.id, r.title)))];
    const pageName = pages.length === 1 ? pages[0] : '';
    const baseName = process.env.REPORT_NAME ?? (pageName ? `${pageName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_Test_Report` : 'CRM_Defect_Report');
    const file = path.join(outDir, `${baseName}_${stamp}.xlsx`);
    const rel = (p: string) => path.relative(outDir, p).split(path.sep).join('/');
    const evDir = path.join(outDir, `${baseName}_${stamp}_evidence`); // screenshots / traces of the defects
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
      // copy the evidence next to the report (merged runs keep attachments in a temporary folder)
      const keep = (a: (typeof r.result.attachments)[number] | undefined, name: string) => {
        if (!a?.path || !fs.existsSync(a.path)) return a;
        try {
          fs.mkdirSync(evDir, { recursive: true });
          const to = path.join(evDir, `DEF-${String(i + 1).padStart(3, '0')}${name}${path.extname(a.path)}`);
          fs.copyFileSync(a.path, to);
          return { ...a, path: to };
        } catch { return a; }
      };
      const shot = keep(r.result.attachments.find(a => a.contentType === 'image/png' && a.path), '');
      const trace = keep(r.result.attachments.find(a => a.name === 'trace' && a.path), '_trace');
      const row = ws.addRow({
        defect: `DEF-${String(i + 1).padStart(3, '0')}`,
        id: r.id,
        title: r.title,
        module: info.module,
        page: { text: info.page, hyperlink: info.page },
        severity: info.severity,
        priority: priorityOf(info.severity),
        category: info.category,
        steps: reproSteps(r, info.steps),
        expected: info.expected,
        actual: readableActual(actual, r.test.annotations.concat(r.result.annotations ?? [])) + earlierAttempts(r),
        values,
        hint: info.hint ? `What this means / why it matters:
${info.hint}` : '',
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
      { header: 'Test Steps', key: 'steps', width: 55 },
      { header: 'Expected Result', key: 'expected', width: 50 },
      { header: 'Actual Result', key: 'actual', width: 50 },
    ];
    for (const r of rows) {
      const info = infoOf(r);
      const row = all.addRow({
        id: r.id, title: r.title, module: info.module, severity: info.severity, status: r.status,
        dur: Math.round(r.result.duration / 100) / 10, att: r.attempts,
        fail: r.status === 'Failed' || r.status === 'Timed out' ? actualResult(r.result).actual.replace(/\s*\n\s*/g, ' | ').replace(/:\s*\|/g, ':').slice(0, 300) : r.status === 'Skipped' ? (r.test.annotations.find(a => a.type === 'skip')?.description ?? 'Skipped') : '',
        file: `${path.relative(root, r.test.location.file).split(path.sep).join('/')}:${r.test.location.line}`,
        steps: info.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        expected: info.expected,
        actual: actualText(r),
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

    sm.getCell('A1').value = pageName ? `${pageName} — Automated Test Report` : 'CRM Reports & Analytics — Automated Test Report';
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
      'Screenshot and Evidence Links open the copies in the <report name>_evidence folder next to this report (DEF-nnn.png, DEF-nnn_trace.zip).',
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
