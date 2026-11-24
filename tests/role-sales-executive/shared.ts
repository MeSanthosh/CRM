/**
 * Role-based suite for the Sales Executive (RSE-…): workbook Testcase/Role_Sales_Executive_Test_Cases.xlsx, data
 * TestData/Role_Sales_Executive_Test_Data.xlsx (scripts/build_role_sales_executive.py).
 * Fixtures: `matrix` = the role's permissions read as the admin (what is expected), `se` = a separate browser signed in
 * as the role's user (SALES_USERNAME / SALES_PASSWORD from .env; the password is never changed or printed).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import type { Browser, BrowserContext, Page, Response } from '@playwright/test';
import { test as base, expect } from '../auth';
import { makeCatalog } from '../leads-page/catalog';
import { dataBook } from '../leads-page/test-data';
import { CrmApi } from '../opportunities-page/api';
import { login } from '../global-setup';

export { expect };
const CAT = makeCatalog('Role_Sales_Executive_Test_Cases.xlsx', '@role-sales-executive');
export const RSE_CASES = CAT.CASES;
export const TAG = CAT.tag;
export const tc = CAT.tc;
const BOOK = dataBook('Role_Sales_Executive_Test_Data.xlsx', 'Role_Sales_Executive');
export const sheet = BOOK.sheet;
export const S = (name: string): string => {
  const r = sheet('Settings').find(x => x['Setting'] === name);
  if (!r) throw new Error(`Setting "${name}" missing on the Settings sheet`);
  return r['Value'];
};
export const list = (name: string) => S(name).split('|').map(s => s.trim());
export type Module = Record<'Permission' | 'Module' | 'Menu Label' | 'Route' | 'List API' | 'Create API' | 'Create Button' | 'Edit Button' | 'Export Button', string>;
export const modules = () => sheet('Modules') as unknown as Module[];
export type Grant = { view: boolean; create: boolean; update: boolean; delete: boolean; approve: boolean; export: boolean; name: string };
export type Matrix = Record<string, Grant>;

export function note(type: string, description: string) {
  base.info().annotations.push({ type, description: description.slice(0, 2500) });
}

/** A browser signed in as the role's user, with the API client and every failed request it saw. */
export type Session = { ctx: BrowserContext; page: Page; api: CrmApi; failed: string[]; user: string };
const STATE = path.resolve(__dirname, '../../.auth/role-sales-executive.json');
function tokenSecondsLeft(): number {
  try {
    const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    let exp = 0;
    for (const o of state.origins ?? []) for (const { value } of o.localStorage ?? []) for (const m of String(value).matchAll(/eyJ[\w-]+\.([\w-]+)\.[\w-]+/g)) {
      try { exp = Math.max(exp, JSON.parse(Buffer.from(m[1], 'base64url').toString()).exp ?? 0); } catch { /* not a JWT */ }
    }
    return exp - Date.now() / 1000;
  } catch { return 0; }
}
async function session(browser: Browser, baseURL: string): Promise<Session> {
  const user = process.env[S('User Env')], pass = process.env[S('User Env').replace('USERNAME', 'PASSWORD')];
  if (!user || !pass) throw new Error(`${S('User Env')} / password missing in .env`);
  const reuse = tokenSecondsLeft() > 180;
  const ctx = await browser.newContext({ baseURL, storageState: reuse ? STATE : { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const failed: string[] = [];
  page.on('response', (r: Response) => { if (/\/api\/v1\//.test(r.url()) && r.status() >= 400) failed.push(`${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '').slice(0, 100)} → ${r.status()}`); });
  const api = new CrmApi(page);
  if (!reuse) { await login(page, user, pass); fs.mkdirSync(path.dirname(STATE), { recursive: true }); await ctx.storageState({ path: STATE }); }
  else { await page.goto('/'); await page.waitForLoadState('networkidle').catch(() => {}); }
  return { ctx, page, api, failed, user };
}

let matrixCache: Promise<{ matrix: Matrix; roleId: string }> | undefined;
/** The role's permission matrix as the admin sees it in Users & Roles. */
async function readMatrix(page: Page): Promise<{ matrix: Matrix; roleId: string }> {
  const api = new CrmApi(page);
  await page.goto('/admin');
  await page.waitForLoadState('networkidle').catch(() => {});
  const roles = (await api.get('/admin/roles?limit=100&offset=0')).body.items as any[];
  const role = roles.find(r => r.code === S('Role Code'));
  if (!role) throw new Error(`Role ${S('Role Code')} not found`);
  const perms = (await api.get(`/admin/roles/${role.id}/permissions`)).body.permissions as any[];
  const matrix: Matrix = {};
  for (const p of perms) matrix[p.permissionCode] = { view: p.canView, create: p.canCreate, update: p.canUpdate, delete: p.canDelete, approve: p.canApprove, export: p.canExport, name: p.permissionName };
  return { matrix, roleId: role.id };
}

export const test = base.extend<{ matrix: Matrix; se: Session; admin: CrmApi }>({
  matrix: async ({ page }, use) => { matrixCache ??= readMatrix(page); await use((await matrixCache).matrix); },
  admin: async ({ page }, use) => {
    const api = new CrmApi(page);
    if (!/\/admin|\/$/.test(page.url())) { await page.goto('/'); await page.waitForLoadState('networkidle').catch(() => {}); }
    await use(api);
  },
  se: async ({ browser, baseURL }, use) => {
    const s = await session(browser, baseURL!);
    await use(s);
    await s.ctx.storageState({ path: STATE }).catch(() => {}); // keeps the rotated refresh token for the next test
    await s.ctx.close();
  },
});

/** Opens a page as the user and returns the requests that failed while it loaded. */
export async function visit(se: Session, route: string): Promise<{ text: string; failed: string[] }> {
  const from = se.failed.length;
  await se.page.goto(route);
  await se.page.waitForLoadState('networkidle').catch(() => {});
  await se.page.waitForTimeout(1500);
  return { text: (await se.page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' '), failed: [...new Set(se.failed.slice(from))] };
}
/** A button or link by its visible text (starts with), in the main area. */
export const action = (page: Page, text: string) => page.locator('main').locator('button, a').filter({ hasText: new RegExp(`^\\s*[^A-Za-z0-9]*\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') }).first();
