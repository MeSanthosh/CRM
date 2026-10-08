import { Page, expect } from '@playwright/test';
import { XP, at, kpiLocator } from './locators';

/** "1,234" -> 1234, "2.18B USD" -> 2180000000, "1.23M" -> 1230000, "52.8%" -> 52.8 */
export function parseNum(text: string): number {
  const m = text.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([KMB])?(?![a-z])/i);
  if (!m) throw new Error(`No number found in "${text}"`);
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
  return parseFloat(m[1]) * (mult[(m[2] ?? '').toUpperCase()] ?? 1);
}

/** Opens a page and waits until its data has loaded. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('main')).not.toContainText(/^\s*loading/i);
}

/** Raw text of a KPI card value on any page, e.g. "2.18B USD". */
export async function kpiText(page: Page, label: string): Promise<string> {
  const loc = kpiLocator(page, label);
  await expect(loc, `KPI "${label}" is visible`).toBeVisible();
  await expect(loc, `KPI "${label}" loaded`).not.toHaveText(/^\s*[—–-]?\s*$/, { timeout: 15_000 });
  return (await loc.innerText()).trim();
}

/** Numeric value of a KPI card on any page. */
export async function kpi(page: Page, label: string): Promise<number> {
  return parseNum(await kpiText(page, label));
}
export const cardValue = kpi; // backwards-compatible name

/** Leads tab and its badge number, e.g. "Unassigned" -> 1. */
export async function tabBadge(page: Page, name: string) {
  const tab = at(page, XP.leadsTab(name));
  const count = at(page, XP.leadsTabCount(name));
  await expect(count, `Tab "${name}" badge`).toBeVisible();
  return { tab, value: parseNum(await count.innerText()) };
}

/**
 * Number of leads in the current list.
 * Reads "Page 1 of 25 · 615 leads" when the pager is shown. The app hides the pager when all
 * results fit on one page (≤ 25), so then it counts the rows that hold a lead link
 * (the empty-state row "No leads found." has none → 0).
 */
export async function listCount(page: Page): Promise<number> {
  const table = at(page, XP.leadsTable);
  await expect(table).toBeVisible();
  const pager = at(page, XP.leadsPager);
  if (await pager.isVisible()) {
    const m = (await pager.innerText()).replace(/,/g, '').match(/(\d+)\s+leads?\s*$/i);
    if (m) return Number(m[1]);
  }
  return table.locator('tbody tr').filter({ has: page.locator('a.crm-record-link') }).count();
}

/** Waits until a KPI shows real data (not the "—" loading placeholder). */
export async function waitForKpi(page: Page, label: string) {
  await expect(kpiLocator(page, label), `KPI "${label}" loaded`).not.toHaveText(/^\s*[—–-]?\s*$/, { timeout: 15_000 });
}

/** Number of rows in a report table identified by its panel heading. */
export async function tableRows(page: Page, heading: string): Promise<number> {
  await expect(at(page, XP.reportTable(heading)), `Table "${heading}"`).toBeVisible();
  return at(page, XP.reportTableRows(heading)).count();
}

/** Values of one column in a report table (by header text). */
export async function tableColumn(page: Page, heading: string, column: string): Promise<string[]> {
  const table = at(page, XP.reportTable(heading));
  const headers = (await table.locator('thead th').allInnerTexts()).map(h => h.replace(/[↕▼▲]/g, '').trim());
  const idx = headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
  if (idx < 0) throw new Error(`Column "${column}" not in "${heading}" (${headers.join(' | ')})`);
  return table.locator(`tbody tr > :nth-child(${idx + 1})`).allInnerTexts();
}

/** Runs a UI action and waits for the API call it triggers, then lets the UI re-render. */
export async function act(page: Page, fn: () => Promise<unknown>) {
  const resp = page
    .waitForResponse(r => ['xhr', 'fetch'].includes(r.request().resourceType()), { timeout: 3000 })
    .catch(() => null);
  await fn();
  await resp;
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

/** Captures every JSON API response the page receives. */
export function collectJson(page: Page) {
  const bodies: { url: string; body: unknown }[] = [];
  page.on('response', async r => {
    if (!['xhr', 'fetch'].includes(r.request().resourceType())) return;
    if (!(r.headers()['content-type'] ?? '').includes('json')) return;
    try {
      bodies.push({ url: r.url(), body: await r.json() });
    } catch {
      /* ignore */
    }
  });
  return bodies;
}

/** Every number found anywhere inside the captured API responses. */
export function numbersIn(bodies: { body: unknown }[]): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) out.push(Number(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  bodies.forEach(b => walk(b.body));
  return out;
}

/** True when the UI value matches an API number (exactly, or within display rounding for 1.23M / 2.18B). */
export function matchesApi(uiValue: number, apiNums: number[]): boolean {
  return apiNums.some(n => n === uiValue || (uiValue >= 1000 && Math.abs(n - uiValue) / uiValue <= 0.005));
}

/** Collects JS errors and failed API calls for a page. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (['xhr', 'fetch'].includes(r.request().resourceType()) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  return { errors, failed };
}
