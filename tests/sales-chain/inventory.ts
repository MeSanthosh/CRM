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

export type CreatedUnit = { code: string; name: string; price: number; values: Record<string, string> };

/**
 * Creates a unit in the test project from a data row (columns = Form Fields labels for "Unit").
 * Returns the submit result too, so tests can check the save.
 */
export async function createUnit(page: Page, data: ModuleData, row: Row, opts: { names?: Record<string, string> } = {}) {
  const proj = await testProject(page, data);
  const names = opts.names ?? data.formFields('Unit');
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
