/**
 * Fixtures for the Customers & Brokers suite: test('CB-024 …', async ({ cbp, api }) => …).
 * Builds on the Opportunities fixtures (api: the backend with the browser's own login) and adds `cbp`.
 */
import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { test as base, expect, note } from '../opportunities/fixtures';
import { CustomersBrokersPage, CustomerRow } from './CustomersBrokersPage';
import { CrmApi } from '../opportunities/api';

export { expect, note };

export const test = base.extend<{ cbp: CustomersBrokersPage }>({
  cbp: async ({ page }, use) => use(new CustomersBrokersPage(page)),
});

/** Non-GET calls to the endpoints that change customer, broker or KYC data. */
const WRITES = /\/api\/v1\/(customers|brokers|kyc|documents)/;
export function writesOf(page: Page) {
  const out: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && WRITES.test(r.url())) out.push(`${r.method()} ${r.url()}`); });
  return out;
}

/** Name of the one test broker the suite creates (once) and then reuses. */
export const TEST_BROKER = 'Automated test broker';
export const EDIT_MARK = ' [automated test edit]';

/** A customer whose names pass the form's "letters only" rule (customers created from leads may have digits). */
export const editable = (r: CustomerRow) => /^[A-Za-z' -]+$/.test(r.name);

/** Writes a small one-page PDF (or a text file) into the test's output folder and returns its path. */
export function testFile(name: string): string {
  const file = test.info().outputPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  fs.writeFileSync(file, name.endsWith('.pdf') ? pdf : 'Automated test file that is not a PDF\n');
  return file;
}

/** Puts a customer's remarks back (removes the test's mark) through the API, if a step left it behind. */
export async function restoreRemarks(api: CrmApi, id: string, original?: string) {
  const cur = (await api.get(`/customers/${id}`)).body;
  const want = original ?? String(cur.remarks ?? '').split(EDIT_MARK).join('').split(' [unsaved]').join('');
  if ((cur.remarks ?? '') !== want) {
    const r = await api.call('PATCH', `/customers/${id}`, { remarks: want });
    note('restored remarks', `${cur.crmCustomerCode}: ${r.status}`);
  }
}

// ── state shared by the lifecycle tests (test-results/ is emptied at the start of a run) ──
export type CbState = { customerId?: string; customerCode?: string; kycNumber?: string; brokerId?: string; brokerCode?: string; brokerCreated?: boolean };
const STATE = path.resolve(__dirname, '../../test-results/customers-brokers-lifecycle.json');
export const state = (): CbState => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
export const save = (p: CbState) => { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify({ ...state(), ...p }, null, 2)); };
