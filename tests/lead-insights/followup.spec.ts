/**
 * Leads → Insights: source figures against the lead records (LSI-014…016), Aging (LSI-031…037), Follow-up — "Lead
 * Follow-up Tracking Workspace" (LSI-041…049) and UI (LSI-051…053). Read only: every expected value comes from the page,
 * from the lead records (GET /leads, read with the browser's session) or from the Executive Dashboards API.
 * Run: npx playwright test tests/lead-insights/followup.spec.ts
 */
import { test as base, expect, lsi, note, S, list } from './shared';
import { CrmApi } from '../opportunities-page/api';
import { XP, at } from '../locators';
import type { Page } from '@playwright/test';

type Lead = any;
const test = base.extend<{ api: CrmApi }>({
  // created with the page, so it picks up the token from the page's own requests (no extra navigation)
  api: async ({ page }, use) => { await use(new CrmApi(page)); },
});

/** Every lead record (100 per request). */
async function allLeads(api: CrmApi): Promise<{ items: Lead[]; summary: any }> {
  const items: Lead[] = [];
  let summary: any;
  for (let offset = 0; offset < 20_000; offset += 100) {
    const r = await api.get(`/leads?limit=100&offset=${offset}`);
    expect(r.status, 'GET /leads').toBe(200);
    summary ??= r.body.summary;
    items.push(...r.body.items);
    if (items.length >= r.body.pagination.total || !r.body.items.length) break;
  }
  return { items, summary };
}
const closed = () => list('Closed Statuses');
const isOpen = (l: Lead) => !closed().includes(l.leadStatus?.code) && l.status !== 'CLOSED';
/** Idle days as the page counts them: from the last interaction, else the capture date, to today (calendar days). */
function idleDays(l: Lead, now = new Date()): number {
  const from = new Date(l.lastInteractionAt ?? l.capturedAt);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(from)) / 86_400_000);
}
/** "0–7 days" → [0, 7]; "61+ days" → [61, ∞] */
const range = (label: string): [number, number] => { const m = label.match(/(\d+)\s*[–-]\s*(\d+)/); return m ? [+m[1], +m[2]] : [Number(label.match(/(\d+)\+/)?.[1] ?? NaN), Infinity]; };
const tol = () => Number(S('Idle Tolerance Days'));
const ownerOf = (l: Lead) => l.assignedToUser?.name ?? l.ownerUser?.name ?? l.owner?.name ?? l.assignedTo?.name ?? null;
const nameOf = (l: Lead) => [l.firstName, l.lastName].filter(Boolean).join(' ').trim();
const shownDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`; };
async function cardValue(page: Page, label: string): Promise<number> {
  const t = (await page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  const i = t.findIndex(x => x === label);
  return i < 0 ? NaN : Number((t.slice(i + 1).find(x => /^\d[\d,]*$/.test(x)) ?? 'NaN').replace(/,/g, ''));
}

test.describe('Lead Insights · Source figures, Aging and Follow-up', () => {
  test.describe.configure({ timeout: 300_000 });

  // ── Source figures against the records ──
  test(...lsi('LSI-014'), async ({ insights, api, page }) => {
    await insights.open();
    const active = await insights.card(S('Active Leads Card'));
    await insights.openView(S('Aging Route'));
    const open = await cardValue(page, S('Open Leads Card'));
    const dash = (await api.get(S('Dashboards Active Leads'))).body?.metrics?.activeLeads;
    note('Active Leads card / Aging Open Leads / dashboards Active Leads', `${active} / ${open} / ${dash}`);
    expect.soft(active, '"Active Leads" (Sources) = Open Leads (Aging)').toBe(open);
    expect.soft(active, '"Active Leads" (Sources) = Active Leads (Executive Dashboards)').toBe(dash);
  });

  test(...lsi('LSI-015'), async ({ insights, api }) => {
    await insights.open();
    const rows = await insights.sources();
    const { items } = await allLeads(api);
    for (const r of rows) {
      const mine = items.filter(l => (l.leadSource?.name ?? '') === r.source);
      const want = { total: mine.length, qualified: mine.filter(l => l.qualifiedAt).length, converted: mine.filter(l => l.leadStatus?.code === 'CONVERTED').length, unassigned: mine.filter(l => !ownerOf(l) && !l.assignedAt).length };
      note(r.source, `shown ${r.total}/${r.qualified}/${r.converted}/${r.unassigned} · records ${want.total}/${want.qualified}/${want.converted}/${want.unassigned} (total/qualified/converted/unassigned)`);
      expect.soft(r.total, `${r.source}: Total = its leads`).toBe(want.total);
      expect.soft(r.qualified, `${r.source}: Qualified = its leads ever qualified`).toBe(want.qualified);
      expect.soft(r.converted, `${r.source}: Converted = its leads with status Converted`).toBe(want.converted);
      expect.soft(r.unassigned, `${r.source}: Unassigned = its leads without an owner`).toBe(want.unassigned);
    }
  });

  test(...lsi('LSI-016'), async ({ insights, api }) => {
    await insights.open();
    const shown = (await insights.sources()).map(r => r.source);
    const used = [...new Set((await allLeads(api)).items.map(l => l.leadSource?.name ?? '(no source)'))];
    note('sources shown / used by leads', `${shown.join(', ')} / ${used.join(', ')}`);
    expect.soft(used.filter(u => !shown.includes(u)), 'Lead Sources with leads that are not listed').toEqual([]);
  });

  // ── Aging ──
  test(...lsi('LSI-031'), async ({ insights, page }) => {
    await insights.openView(S('Aging Route'));
    const text = await insights.text();
    const b = await insights.buckets();
    note('aging', `${await insights.activeSubTab()} · ${b.map(x => `${x.label} ${x.count}`).join(', ')}`);
    await expect.soft(page, 'Address').toHaveURL(new RegExp(`${S('Aging Route')}$`));
    expect.soft(await insights.activeSubTab(), 'Aging marked active').toBe('Aging');
    for (const t of [S('Open Leads Card'), S('Aging Basis'), S('Aging Hint')]) expect.soft(text, `"${t}" shown`).toContain(t);
    expect.soft(b.map(x => x.label), 'Buckets in order').toEqual(list('Aging Buckets'));
  });

  test(...lsi('LSI-032'), async ({ insights, page }) => {
    await insights.openView(S('Aging Route'));
    const open = await cardValue(page, S('Open Leads Card'));
    const b = await insights.buckets();
    const sum = b.reduce((a, x) => a + x.count, 0);
    note('buckets / Open Leads', `${b.map(x => x.count).join(' + ')} = ${sum} / ${open}`);
    expect(sum, 'Buckets add up to Open Leads').toBe(open);
  });

  test(...lsi('LSI-033'), async ({ insights, api, page }) => {
    await insights.openView(S('Aging Route'));
    const open = await cardValue(page, S('Open Leads Card'));
    const { items, summary } = await allLeads(api);
    const records = items.filter(isOpen).length;
    const dash = (await api.get(S('Dashboards Active Leads'))).body?.metrics?.activeLeads;
    note('Open Leads / open records / dashboards', `${open} / ${records} (total ${summary.total} − converted ${summary.converted} − disqualified ${summary.disqualified}) / ${dash}`);
    expect.soft(open, 'Open Leads = open lead records').toBe(records);
    expect.soft(open, 'Open Leads = Executive Dashboards Active Leads').toBe(dash);
  });

  test(...lsi('LSI-034'), async ({ insights, api }) => {
    await insights.openView(S('Aging Route'));
    const b = await insights.buckets();
    const open = (await allLeads(api)).items.filter(isOpen).map(l => idleDays(l));
    for (const x of b) {
      const [lo, hi] = range(x.label);
      const exact = open.filter(d => d >= lo && d <= hi).length;
      const loose = { min: open.filter(d => d >= lo + tol() && d <= hi - tol()).length, max: open.filter(d => d >= lo - tol() && d <= hi + tol()).length };
      note(x.label, `shown ${x.count} · records ${exact} (within one day: ${loose.min}–${loose.max})`);
      expect.soft(x.count >= loose.min && x.count <= loose.max, `${x.label}: ${x.count} = open leads idle ${lo}–${hi} days (${exact} by the records)`).toBeTruthy();
    }
  });

  test(...lsi('LSI-035'), async ({ insights, api }) => {
    await insights.openView(S('Aging Route'));
    const byNo = new Map((await allLeads(api)).items.map(l => [l.leadNo, l]));
    for (const x of await insights.buckets()) {
      if (!x.count) continue;
      await insights.clickBucket(x.label);
      const pager = await insights.pagerTotal();
      const rows = await insights.listLeads();
      const [lo, hi] = range(x.label);
      const wrong = rows.filter(r => { const d = Number(r.idle.replace(/\D/g, '')); return Number.isNaN(d) || d < lo - tol() || d > hi + tol(); });
      const notOpen = rows.filter(r => { const l = byNo.get(r.lead); return !l || !isOpen(l); });
      note(x.label, `bucket ${x.count} · pager ${pager} · listed ${rows.length}${wrong.length ? ` · idle outside: ${wrong.map(r => `${r.lead} ${r.idle}`).join(', ')}` : ''}${notOpen.length ? ` · not open: ${notOpen.map(r => r.lead).join(', ')}` : ''}`);
      expect.soft(rows.length, `${x.label}: leads listed = bucket`).toBe(x.count);
      if (!Number.isNaN(pager)) expect.soft(pager, `${x.label}: pager total = bucket`).toBe(x.count);
      expect.soft(wrong.map(r => `${r.lead} ${r.idle}`), `${x.label}: every lead's Idle is in the bucket`).toEqual([]);
      expect.soft(notOpen, `${x.label}: every lead is open`).toEqual([]);
      await insights.clickBucket(x.label); // clear
    }
  });

  test(...lsi('LSI-036'), async ({ insights }) => {
    await insights.openView(S('Aging Route'));
    const b = (await insights.buckets()).find(x => x.count > 0);
    test.skip(!b, 'Every bucket is empty');
    await insights.clickBucket(b!.label);
    expect.soft(await at(insights.page, XP.insightsListRows).count(), 'List shown after the first click').toBeGreaterThan(0);
    await insights.clickBucket(b!.label);
    expect.soft(await at(insights.page, XP.insightsListRows).count(), 'List gone after the second click').toBe(0);
    expect.soft(await insights.text(), 'Hint shown again').toContain(S('Aging Hint'));
  });

  test(...lsi('LSI-037'), async ({ insights, page }) => {
    await insights.openView(S('Aging Route'));
    const b = (await insights.buckets()).find(x => x.count > 0);
    test.skip(!b, 'Every bucket is empty');
    await insights.clickBucket(b!.label);
    const row = at(page, XP.insightsListRows).first();
    const no = (await row.locator('td').nth(1).innerText()).split('\n')[0].trim();
    const link = row.locator('a').first();
    note('first lead', `${no} · link: ${(await link.count()) ? await link.getAttribute('href') : 'none'}`);
    await ((await link.count()) ? link : row.locator('td').nth(1)).click();
    await page.waitForTimeout(1500);
    const opened = await at(page, XP.leadDetailPanel).isVisible().catch(() => false) || /\/leads\/[^/]+\/?$/.test(new URL(page.url()).pathname) && !/aging/.test(page.url());
    expect(opened, `Clicking ${no} opens the lead`).toBeTruthy();
    if (await at(page, XP.leadDetailPanel).isVisible().catch(() => false)) await expect.soft(at(page, XP.leadDetailPanel), 'Lead Detail of that lead').toContainText(no);
  });

  // ── Follow-up ──
  test(...lsi('LSI-041'), async ({ insights, page }) => {
    await insights.openView(S('Follow-up Route'));
    const text = await insights.text();
    const heads = await insights.headers(XP.insightsListHeaders);
    note('follow-up', `${await insights.activeSubTab()} · columns ${heads.join(', ')}`);
    await expect.soft(page, 'Address').toHaveURL(new RegExp(`${S('Follow-up Route')}$`));
    expect.soft(await insights.activeSubTab(), 'Follow-up marked active').toBe('Follow-up');
    for (const t of [S('Follow-up Card'), S('Follow-up Rule')]) expect.soft(text, `"${t}" shown`).toContain(t);
    expect.soft(heads, 'Columns').toEqual(list('Follow-up Columns'));
  });

  test(...lsi('LSI-042'), async ({ insights, page }) => {
    await insights.openView(S('Follow-up Route'));
    const card = await cardValue(page, S('Follow-up Card'));
    const matching = await insights.drillCount(S('Drill Count Word'));
    const pager = await insights.pagerTotal();
    const rows = await insights.listLeads();
    note('card / matching / pager / rows', `${card} / ${matching} / ${pager} / ${rows.length}`);
    expect.soft(matching, '"N matching" = card').toBe(card);
    if (!Number.isNaN(pager)) expect.soft(pager, 'Pager total = card').toBe(card);
    expect.soft(rows.length, 'Rows listed = card').toBe(card);
    expect.soft(new Set(rows.map(r => r.lead)).size, 'No lead listed twice').toBe(rows.length);
  });

  test(...lsi('LSI-043'), async ({ insights, api, page }) => {
    await insights.openView(S('Follow-up Route'));
    const card = await cardValue(page, S('Follow-up Card'));
    const min = Number(S('Follow-up Idle Days'));
    const open = (await allLeads(api)).items.filter(isOpen);
    const due = open.filter(l => idleDays(l) >= min).length;
    const band = { min: open.filter(l => idleDays(l) >= min + tol()).length, max: open.filter(l => idleDays(l) >= min - tol()).length };
    await insights.openView(S('Aging Route'));
    const b = await insights.buckets();
    const over = b.filter(x => range(x.label)[0] > min).reduce((a, x) => a + x.count, 0);
    note('due / records / aging', `card ${card} · open leads idle ${min}+ days: ${due} (within one day: ${band.min}–${band.max}) · Aging buckets above ${min} days: ${over}`);
    expect.soft(card >= band.min && card <= band.max, `Due for follow-up (${card}) = open leads idle ${min}+ days (${due})`).toBeTruthy();
    expect.soft(card, 'Not less than the Aging buckets above 7 days').toBeGreaterThanOrEqual(over);
  });

  test(...lsi('LSI-044'), async ({ insights, api }) => {
    await insights.openView(S('Follow-up Route'));
    const rows = await insights.listLeads();
    const byNo = new Map((await allLeads(api)).items.map(l => [l.leadNo, l]));
    const min = Number(S('Follow-up Idle Days'));
    const problems: string[] = [];
    for (const r of rows) {
      const l = byNo.get(r.lead);
      const shownIdle = Number(r.idle.replace(/\D/g, ''));
      if (!l) { problems.push(`${r.lead}: not found`); continue; }
      if (!isOpen(l)) problems.push(`${r.lead}: status ${l.leadStatus?.code}`);
      if (shownIdle < min) problems.push(`${r.lead}: idle ${r.idle} (< ${min})`);
      if (Math.abs(shownIdle - idleDays(l)) > tol()) problems.push(`${r.lead}: idle ${r.idle}, records say ${idleDays(l)}d (last interaction ${l.lastInteractionAt ?? '—'}, captured ${l.capturedAt})`);
    }
    note('rows checked', `${rows.length}${problems.length ? ` · ${problems.join(' | ')}` : ''}`);
    expect.soft(problems, 'Every listed lead is open, idle 7+ days, idle = days since last interaction (else capture)').toEqual([]);
  });

  test(...lsi('LSI-045'), async ({ insights, api }) => {
    await insights.openView(S('Follow-up Route'));
    const rows = await insights.listLeads();
    const byNo = new Map((await allLeads(api)).items.map(l => [l.leadNo, l]));
    const problems: string[] = [];
    for (const r of rows as any[]) {
      const l = byNo.get(r.lead);
      if (!l) continue;
      const contact = r.contact.split('\n')[0].trim();
      if (contact.toLowerCase() !== nameOf(l).toLowerCase()) problems.push(`${r.lead}: contact "${contact}" vs "${nameOf(l)}"`);
      if (r.source !== (l.leadSource?.name ?? '')) problems.push(`${r.lead}: source "${r.source}" vs "${l.leadSource?.name}"`);
      const owner = ownerOf(l) ?? S('Unassigned Owner');
      if (r.owner !== owner) problems.push(`${r.lead}: owner "${r.owner}" vs "${owner}"`);
      if (r.captured !== shownDate(l.capturedAt)) problems.push(`${r.lead}: captured "${r.captured}" vs ${shownDate(l.capturedAt)}`);
    }
    note('rows checked', `${rows.length}${problems.length ? ` · ${problems.slice(0, 15).join(' | ')}` : ''}`);
    expect.soft(problems, 'Contact, Source, Owner and Captured equal the lead record').toEqual([]);
  });

  test(...lsi('LSI-046'), async ({ insights, page }) => {
    await insights.openView(S('Follow-up Route'));
    const size = Number(S('Page Size'));
    const prev = page.locator('main').getByRole('button', { name: 'Previous', exact: true });
    const next = page.locator('main').getByRole('button', { name: 'Next', exact: true });
    const nums: number[] = [];
    const pagers: string[] = [];
    await expect.soft(prev, 'Previous disabled on page 1').toBeDisabled();
    for (let i = 0; i < 30; i++) {
      const rows = await at(page, XP.insightsListRows).evaluateAll(trs => trs.map(tr => Number((tr.querySelector('td') as HTMLElement)?.innerText.trim())));
      const pager = (await at(page, XP.pagerText).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
      pagers.push(pager);
      nums.push(...rows);
      if (await next.isDisabled().catch(() => true)) { expect.soft(rows.length, 'Last page holds the rest').toBeLessThanOrEqual(size); break; }
      expect.soft(rows.length, `Page ${i + 1}: ${size} rows`).toBe(size);
      await next.click();
      await expect.poll(() => at(page, XP.pagerText).first().innerText(), { timeout: 15_000 }).not.toBe(pager);
      await page.waitForTimeout(500);
    }
    note('pages', pagers.join(' | '));
    expect.soft(nums, '# runs 1, 2, 3 … without gaps or repeats').toEqual(nums.map((_, i) => i + 1));
    while (!(await prev.isDisabled().catch(() => true))) { await prev.click(); await page.waitForTimeout(500); }
    expect.soft(await at(page, XP.pagerText).first().innerText(), 'Back on page 1').toMatch(/Page 1 of/);
  });

  test(...lsi('LSI-047'), async ({ insights }) => {
    await insights.openView(S('Follow-up Route'));
    const idle = (await insights.listLeads()).map((r: any) => Number(r.idle.replace(/\D/g, '')));
    const sorted = [...idle].sort((a, b) => b - a);
    const firstOut = idle.findIndex((d, i) => d !== sorted[i]);
    note('idle in list order', idle.join(', '));
    expect.soft(firstOut, `Most idle first (first row out of order: ${firstOut + 1})`).toBe(-1);
  });

  test(...lsi('LSI-048'), async ({ insights, page }) => {
    await insights.openView(S('Follow-up Route'));
    const row = at(page, XP.insightsListRows).first();
    const no = (await row.locator('td').nth(1).innerText()).split('\n')[0].trim();
    const link = row.locator('a').first();
    note('first lead', `${no} · link: ${(await link.count()) ? await link.getAttribute('href') : 'none'}`);
    await ((await link.count()) ? link : row.locator('td').nth(1)).click();
    await page.waitForTimeout(1500);
    const opened = await at(page, XP.leadDetailPanel).isVisible().catch(() => false) || !/follow-up/.test(page.url());
    expect(opened, `Clicking ${no} opens the lead`).toBeTruthy();
  });

  test(...lsi('LSI-049'), async ({ insights }) => {
    await insights.openView(S('Follow-up Route'));
    const rows = await insights.listLeads() as any[];
    const bad = rows.filter(r => !/^\d+d$/.test(r.idle) || !/^\d{2} [A-Z][a-z]{2} \d{4}$/.test(r.captured) || /NaN|undefined|null/.test(r.text) || !r.lead || !r.contact);
    note('rows', `${rows.length}${bad.length ? ` · bad: ${bad.slice(0, 10).map(r => r.text).join(' || ')}` : ''}`);
    expect.soft(bad.map(r => r.text), 'Idle "<n>d", Captured "dd Mon yyyy", no empty or broken cells').toEqual([]);
  });

  // ── UI ──
  test(...lsi('LSI-051'), async ({ insights, page }) => {
    for (const [route, sub] of [[S('Insights Route'), 'Sources'], [S('Aging Route'), 'Aging'], [S('Follow-up Route'), 'Follow-up']]) {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      expect.soft(await insights.activeSubTab(), `${route}: ${sub} active`).toBe(sub);
      expect.soft((await page.locator('main a.crm-leads-tab.is-active').first().innerText().catch(() => '')).trim(), `${route}: Insights tab active`).toBe('Insights');
    }
    for (const sub of list('Sub-tabs')) {
      await at(page, XP.leadsSubTab(sub)).click();
      await expect.soft.poll(() => insights.activeSubTab(), { message: `Click ${sub}: ${sub} becomes active`, timeout: 10_000 }).toBe(sub);
    }
  });

  test(...lsi('LSI-052'), async ({ page }) => {
    for (const vp of list('Viewports')) {
      const [name, size] = vp.split(' ');
      const [w, h] = size.split('x').map(Number);
      await page.setViewportSize({ width: w, height: h });
      for (const route of [S('Insights Route'), S('Aging Route'), S('Follow-up Route')]) {
        await page.goto(route);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(800);
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
        note(`${name} ${route}`, `page ${r.sw}px in ${r.w}px`);
        expect.soft(r.sw, `${name} ${route}: no sideways scrolling`).toBeLessThanOrEqual(r.w + 1);
      }
    }
  });

  test(...lsi('LSI-053'), async ({ page }) => {
    const failed: string[] = [], errors: string[] = [];
    page.on('response', r => { if (/\/api\/v1\//.test(r.url()) && r.status() >= 400) failed.push(`${r.request().method()} ${r.url().replace(/^.*\/api\/v1/, '')} → ${r.status()}`); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    for (const route of [S('Insights Route'), S('Aging Route'), S('Follow-up Route')]) {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1000);
      const text = await page.locator('main').innerText();
      expect.soft(text.match(/\bNaN\b|undefined|Infinity/)?.[0] ?? '', `${route}: broken value`).toBe('');
    }
    note('requests', failed.join(' | ') || 'all succeeded');
    expect.soft(failed, 'Failed requests').toEqual([]);
    expect.soft(errors, 'Script errors').toEqual([]);
  });
});
