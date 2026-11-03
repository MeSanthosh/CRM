/**
 * Fixtures for the Opportunities suite: test('OPP-019 …', async ({ opps, leads, api }) => …).
 * Also holds the state the lifecycle tests share (the lead they convert and the opportunity it becomes).
 */
import fs from 'fs';
import path from 'path';
import { test as base, expect } from '../auth';
import { OpportunitiesPage } from './OpportunitiesPage';
import { LeadsConversion } from './LeadsConversion';
import { CrmApi } from './api';

export { expect };

export const test = base.extend<{ opps: OpportunitiesPage; leads: LeadsConversion; api: CrmApi }>({
  opps: async ({ page }, use) => use(new OpportunitiesPage(page)),
  leads: async ({ page }, use) => use(new LeadsConversion(page)),
  api: async ({ page }, use) => use(new CrmApi(page)),
});

/** Records a value in the Excel report's "observed values" column. */
export const note = (type: string, description: unknown) =>
  test.info().annotations.push({ type, description: typeof description === 'string' ? description : JSON.stringify(description) });

/** Non-GET calls to the endpoints that change opportunity or lead data. */
export const WRITE_ENDPOINT = /\/api\/v1\/(opportunities|leads|site-visits|notes|reservations|contracts|unit-holds)/;

// ── state shared by the lifecycle tests (one file per run; test-results/ is emptied at the start of a run) ──
export type Lifecycle = {
  leadId?: string; leadNo?: string; customer?: string; leadBudget?: string; leadOwner?: string;
  oppId?: string; oppNo?: string; budgetAmount?: number; createdBy?: string;
  before?: { total: number; open: number; ready: number; qualified: { count: number; value: string } };
  visitShown?: string; note?: string;
};
const STATE = path.resolve(__dirname, '../../test-results/opportunity-lifecycle.json');

export function lifecycle(): Lifecycle {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
export function saveLifecycle(patch: Partial<Lifecycle>) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ ...lifecycle(), ...patch }, null, 2));
}
/** Skips the test when the conversion at the start of the lifecycle did not happen. */
export function needOpportunity(): Required<Pick<Lifecycle, 'oppId' | 'oppNo'>> & Lifecycle {
  const s = lifecycle();
  test.skip(!s.oppId || !s.oppNo, 'Not run: depends on OPP-009 (convert a lead into an opportunity), which did not complete in this run. Fix that step first; this test case was not checked.');
  return s as Required<Pick<Lifecycle, 'oppId' | 'oppNo'>> & Lifecycle;
}
