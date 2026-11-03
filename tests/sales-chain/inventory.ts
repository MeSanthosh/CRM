/**
 * Inventory helpers shared by the Inventory suite and the deal chain: the test project (created once when
 * missing) and units created in it. Real projects and units are never touched.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ModulePage, ModalForm } from '../pages/SalesPages';
import { ModuleData, fill, formValues, seq } from './data';
import type { Row } from '../leads-page/test-data';

/** Inventory page: tabs + registers. */
export class InventoryPage extends ModulePage {
  async openTab(tab: string) {
    await this.open();
    await this.tab(tab);
  }
}

const LOCK_DIR = path.resolve(__dirname, '../../.auth');
/**
 * Runs `fn` while no other worker or suite changes inventory / deal records, so before-and-after card
 * counts are not spoiled by a parallel test (same idea as the Leads page lock).
 */
export async function withSalesLock<T>(fn: () => Promise<T>, name = 'sales-write'): Promise<T> {
  const lock = path.join(LOCK_DIR, `${name}.lock`);
  if (held.has(lock)) return fn();
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const until = Date.now() + 10 * 60_000;
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 8 * 60_000) fs.rmSync(lock, { recursive: true, force: true }); } catch { /* gone */ }
      if (Date.now() > until) throw new Error(`Waited 10 minutes for ${lock}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
  held.add(lock);
  try { return await fn(); } finally { held.delete(lock); fs.rmSync(lock, { recursive: true, force: true }); }
}
const held = new Set<string>();

export type TestProject = { code: string; name: string };
let project: Promise<TestProject> | undefined;

/** The test project named in the data (Test Project Name), created when there is no active one. */
export function testProject(page: Page, data: ModuleData): Promise<TestProject> {
  project ??= (async () => {
    const inv = new InventoryPage(page, data.setting('Inventory Route'));
    const name = data.setting('Test Project Name');
    await inv.openTab(data.setting('Projects Tab'));
    const rows = await inv.allRows();
    const active = rows.find(r => r.lines.includes(name) && (r.cells['Status'] ?? '').trim() === data.setting('Test Project Active Status'));
    if (active) return { code: active.lines[0], name };
    if (!mayCreate(data, 'Projects')) throw new Error(`No active test project "${name}" in the Project Register, and the data says Create New Projects = No: activate or create it by hand first`);
    const code = fill(data.setting('Test Project Code Pattern'));
    const form = new ModalForm(page);
    await form.open(data.setting('New Project Button'));
    const f = data.formFields('Project');
    await form.fill({
      [f['Project Code']]: code, [f['Project Name']]: name, [f['Location']]: data.setting('Test Project Location'), [f['Currency']]: data.setting('Test Project Currency'),
      [f['Legal Entity']]: data.setting('Test Project Legal Entity'), [f['Description']]: data.setting('Test Project Description'),
    });
    const r = await form.submit(data.setting('Create Project Button'));
    expect(r.closed, `Test project ${code} created (${r.notice?.text ?? 'no message'})`).toBeTruthy();
    return { code, name };
  })().catch(e => { project = undefined; throw e; });
  return project;
}

export type CreatedUnit = { code: string; name: string; price: number; values: Record<string, string>; reused?: boolean };

/** May the tests create projects / units? (Create New Projects / Create New Units in the data; default Yes.) */
export function mayCreate(data: ModuleData, what: 'Projects' | 'Units'): boolean {
  try { return !/^n/i.test(data.setting(`Create New ${what}`)); } catch { return true; }
}

// units handed out by existingUnit(), kept for 12 hours so the suites of one test round never share a unit
const CLAIMS = path.resolve(__dirname, '../../.auth/claimed-units.json');
function claimed(): Record<string, number> {
  try {
    const all = JSON.parse(fs.readFileSync(CLAIMS, 'utf8')) as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([, t]) => Date.now() - t < 12 * 3600_000));
  } catch { return {}; }
}

/**
 * Create New Units = No: an Available unit of the test project that has no active hold and was not handed to
 * another deal / test in this round (same shape as a created unit; `reused` = true).
 */
async function existingUnit(page: Page, data: ModuleData, proj: TestProject, names: Record<string, string>) {
  return withSalesLock(async () => {
    const inv = new InventoryPage(page, data.setting('Inventory Route'));
    await inv.openTab(data.setting('Holds Tab'));
    await page.locator(`xpath=//main//select[@aria-label=${JSON.stringify(data.setting('Holds Whose Label'))}]`).selectOption({ label: data.setting('Holds Scope All') });
    await page.locator(`xpath=//main//select[@aria-label=${JSON.stringify(data.setting('Holds Show Label'))}]`).selectOption({ label: data.setting('Holds Active') });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    const held = new Set((await inv.rows()).map(r => r.lines[0]));
    await inv.openTab(data.setting('Units Tab'));
    await inv.search(data.setting('Unit Search Placeholder'), proj.code);
    const taken = claimed();
    const free = (await inv.allRows()).filter(r => r.lines[0].startsWith(`${proj.code}-`) && r.cells['Status'] === data.setting('Available Status') && !held.has(r.lines[0]) && !(r.lines[0] in taken));
    if (!free.length) throw new Error(`No Available unit left in the test project ${proj.code} (Create New Units = No; held: ${[...held].join(', ') || 'none'}; already used in this round: ${Object.keys(taken).join(', ') || 'none'})`);
    const r = free[0];
    fs.mkdirSync(path.dirname(CLAIMS), { recursive: true });
    fs.writeFileSync(CLAIMS, JSON.stringify({ ...taken, [r.lines[0]]: Date.now() }));
    const unit: CreatedUnit = {
      code: r.lines[0], name: r.lines[1] ?? '', price: /\d/.test(r.cells['Price'] ?? '') ? Number((r.cells['Price'].match(/[\d,.]+/) ?? ['0'])[0].replace(/,/g, '')) : 0,
      values: { [names['Unit Code']]: r.lines[0], [names['Unit Name']]: r.lines[1] ?? '' }, reused: true,
    };
    const result = { notice: { title: 'Existing unit', text: `Create New Units = No: reusing ${unit.code} (${r.cells['Status']}, ${r.cells['Price']})`, buttons: [], kind: 'info' as const }, notices: [], closed: true, formText: '' };
    return { unit, result };
  });
}

/**
 * Creates a unit in the test project from a data row (columns = Form Fields labels for "Unit").
 * Returns the submit result too, so tests can check the save.
 */
export async function createUnit(page: Page, data: ModuleData, row: Row, opts: { names?: Record<string, string> } = {}) {
  const proj = await testProject(page, data);
  const names = opts.names ?? data.formFields('Unit');
  if (!mayCreate(data, 'Units')) return { ...(await existingUnit(page, data, proj, names)), project: proj };
  const ctx = { project: proj.code, seq: seq() };
  const values = formValues(row, names, ctx);
  const inv = new InventoryPage(page, data.setting('Inventory Route'));
  await inv.openTab(data.setting('Units Tab'));
  const form = new ModalForm(page);
  await form.open(data.setting('New Unit Button'));
  await form.set(names['Project'], `~${proj.code}`);
  await form.fill(values);
  const result = await form.submit(data.setting('Create Unit Button'));
  const unit: CreatedUnit = { code: values[names['Unit Code']], name: values[names['Unit Name']] ?? '', price: Number(values[names['Base Price']] ?? 0), values };
  await form.close();
  return { unit, result, project: proj };
}

/** Unit row in the Unit Register (searched by code), or undefined. */
export async function findUnit(page: Page, data: ModuleData, code: string) {
  const inv = new InventoryPage(page, data.setting('Inventory Route'));
  await inv.openTab(data.setting('Units Tab'));
  await inv.search(data.setting('Unit Search Placeholder'), code);
  return (await inv.rows()).find(r => r.lines[0] === code);
}
