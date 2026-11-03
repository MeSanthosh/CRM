/**
 * Fixtures for the Construction Updates suite: test(...cu('CU-005'), async ({ cup, api }) => …).
 *   cup — ConstructionUpdatesPage (the screen)
 *   api — CrmApi (the backend, called with the browser's own token) for the saved values the screen is compared with
 * Also holds the backend readers, the test-draft lookup and the upload files the lifecycle uses.
 */
import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { test as base, expect, note } from '../opportunities/fixtures';
import { CrmApi } from '../opportunities/api';
import { ConstructionUpdatesPage } from './ConstructionUpdatesPage';

export { expect, note };

export const test = base.extend<{ cup: ConstructionUpdatesPage }>({
  cup: async ({ page }, use) => use(new ConstructionUpdatesPage(page)),
});

export type Update = {
  id: string; projectId: string; projectCode: string; projectName: string; periodLabel: string | null; title: string;
  description: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: string | null; isVisibleToCustomers: boolean;
  createdAt: string; updatedAt: string; photos?: Photo[];
};
export type Photo = { id: string; fileName: string; contentType: string; visibility: string; caption: string | null };
export type Project = { id: string; projectCode: string; name: string };

/** The one draft the lifecycle creates (once) and then reuses: updates cannot be deleted. */
export const TEST_TITLE = 'Automated test update - do not publish';
/** File names the lifecycle uploads; anything named like this is removed again afterwards. */
export const TEST_FILE = /^automated-/;

/** GET /construction-updates — what the screen lists (same limit as the app). */
export async function updates(api: CrmApi, params: Record<string, string> = {}): Promise<{ items: Update[]; totalCount: number }> {
  const q = new URLSearchParams({ limit: '100', ...params });
  const r = await api.get(`/construction-updates?${q}`);
  expect(r.status, `GET /construction-updates?${q}`).toBe(200);
  return { items: r.body.items, totalCount: r.body.totalCount ?? r.body.items.length };
}

export async function update(api: CrmApi, id: string): Promise<Update> {
  const r = await api.get(`/construction-updates/${id}`);
  expect(r.status, `GET /construction-updates/${id}`).toBe(200);
  return r.body;
}

export async function projects(api: CrmApi): Promise<Project[]> {
  const r = await api.get('/construction-updates/projects');
  expect(r.status, 'GET /construction-updates/projects').toBe(200);
  return r.body.items;
}

/** The test draft, with its photos (undefined when it has not been created yet). */
export async function testDraft(api: CrmApi): Promise<Update | undefined> {
  const found = (await updates(api)).items.find(u => u.title === TEST_TITLE);
  return found ? update(api, found.id) : undefined;
}

/** Skips the test when the test draft does not exist (CU-031 did not create it). */
export async function needDraft(api: CrmApi): Promise<Update> {
  const d = await testDraft(api);
  test.skip(!d, `Not run: depends on CU-031 (save a new draft), which did not create "${TEST_TITLE}". Fix that step first; this test case was not checked.`);
  return d!;
}

/** Shown in the list's Period column: the period label, or "—" when there is none. */
export const periodShown = (u: Update) => u.periodLabel || '—';

/** Non-GET requests to /construction-updates (to prove that a refused form sends nothing). */
export function writesOf(page: Page): string[] {
  const out: string[] = [];
  page.on('request', r => { if (!['GET', 'OPTIONS'].includes(r.method()) && /\/api\/v1\/construction-updates/.test(r.url())) out.push(`${r.method()} ${r.url()}`); });
  return out;
}

/** A 1×1 PNG (or, for any other extension, a small text file) in the test's output folder. */
export function testFile(name: string): string {
  const file = test.info().outputPath(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  fs.writeFileSync(file, name.endsWith('.png') ? Buffer.from(png, 'base64') : 'Automated test file that is not an image\n');
  return file;
}

/** "October 2026" — the current month, as the Period label placeholder writes it. */
export const thisMonth = () => new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
