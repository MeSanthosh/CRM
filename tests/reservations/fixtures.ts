/**
 * Fixtures for the Unit Reservations suite: test('UR-034 …', async ({ rsv, opps, leads, api }) => …).
 * Builds on the Opportunities fixtures (opps, leads, api) and adds `rsv` (ReservationsPage).
 * Also holds the state the lifecycle tests share and small helpers to make test files.
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect, note } from '../opportunities/fixtures';
import { ReservationsPage } from './ReservationsPage';

export { expect, note };

export const test = base.extend<{ rsv: ReservationsPage }>({
  rsv: async ({ page }, use) => use(new ReservationsPage(page)),
});

/** Non-GET calls to the endpoints that change reservation data. */
export const RSV_WRITE = /\/api\/v1\/(reservations|documents|approvals|opportunities|leads|unit-holds)/;

/** Records the data-changing requests a page sends from now on. */
export function writesOf(page: import('@playwright/test').Page) {
  const out: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && RSV_WRITE.test(r.url())) out.push(`${r.method()} ${r.url()}`); });
  return out;
}

/** Writes a small valid one-page PDF (or any text file) into the test's output folder and returns its path. */
export function testFile(name: string): string {
  const file = test.info().outputPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  fs.writeFileSync(file, name.endsWith('.pdf') ? pdf : 'Automated test file that is not a PDF\n');
  return file;
}

// ── state shared by the lifecycle tests (test-results/ is emptied at the start of a run) ──
export type Res = { id: string; no: string; unit: string };
export type RsvLifecycle = {
  leadNo?: string; oppId?: string; oppNo?: string; customer?: string;
  r1?: Res; r2?: Res; amount?: string; allBefore?: number;
};
const STATE = path.resolve(__dirname, '../../test-results/reservation-lifecycle.json');

export function lifecycle(): RsvLifecycle {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
export function saveLifecycle(patch: Partial<RsvLifecycle>) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ ...lifecycle(), ...patch }, null, 2));
}
/** Which lifecycle test case produces each piece of state (used to explain a dependent skip). */
const MADE_BY: Record<keyof RsvLifecycle, string> = {
  leadNo: 'UR-031 (prepare a Reservation Ready opportunity)', oppId: 'UR-031 (prepare a Reservation Ready opportunity)',
  oppNo: 'UR-031 (prepare a Reservation Ready opportunity)', customer: 'UR-031 (prepare a Reservation Ready opportunity)',
  allBefore: 'UR-034 (create the reservation)', r1: 'UR-034 (create the reservation)', amount: 'UR-034 (create the reservation)',
  r2: 'UR-044 (replace the reservation)',
};

/**
 * Skips the test when an earlier lifecycle step did not produce what it needs. The reason names that step,
 * so the report reads e.g. "Not run: depends on UR-034 (create the reservation), which did not complete in this run".
 */
export function need<K extends keyof RsvLifecycle>(...keys: K[]): RsvLifecycle & Required<Pick<RsvLifecycle, K>> {
  const s = lifecycle();
  const missing = [...new Set(keys.filter(k => !s[k]).map(k => MADE_BY[k]))];
  test.skip(missing.length > 0, `Not run: depends on ${missing.join(' and ')}, which did not complete in this run. Fix that step first; this test case was not checked.`);
  return s as RsvLifecycle & Required<Pick<RsvLifecycle, K>>;
}
