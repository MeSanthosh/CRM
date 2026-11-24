/**
 * My Smart Workspace (/), MSW-001…025. Read only, except MSW-017 (a pin) and MSW-018 (AI panel), which save the signed-in
 * user's own preferences and put them back. Task ticks, Ask AI and reminder buttons are never clicked.
 * Run: npx playwright test tests/executive-dashboards/workspace.spec.ts
 */
import { test, expect } from './fixtures';
import { tc, S, N, sheet, note, shown, displays, expectShows, BAD } from './shared';
import { EXD, at } from '../locators';
import { WorkspacePage } from './WorkspacePage';

const userName = async (page: import('@playwright/test').Page) =>
  (await page.locator('.crm-user-menu-text').first().innerText()).split('\n')[0].trim();
/** "My overdue" card and the one after it on Tasks & Calendar. */
async function tasksPageCards(page: import('@playwright/test').Page) {
  await page.goto(S('Tasks Route'));
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('main')).toContainText('My overdue', { timeout: 30_000 });
  await page.waitForTimeout(800);
  const ls = (await page.locator('main').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  const i = ls.findIndex(l => /^My overdue$/i.test(l));
  const nums = ls.slice(i + 1).filter(l => /^[\d,]+$/.test(l)).slice(0, 2).map(x => Number(x.replace(/,/g, '')));
  return { overdue: nums[0], today: nums[1], text: ls.slice(i, i + 6).join(' | ') };
}

test.describe('Executive Dashboards · My Smart Workspace', () => {
  // MSW-017 / MSW-018 change the user's workspace preferences that other tests here read: run in order on one worker
  test.describe.configure({ mode: 'default' });
  test(...tc('MSW-001'), async ({ ws, page }) => {
    await page.goto(S('Dashboards Route'));
    await page.getByRole('link', { name: S('Side Menu Workspace'), exact: true }).first().click();
    await ws.ready();
    await expect(page, 'Home page').toHaveURL(new RegExp(`${new URL(page.url()).origin}/?(\\?.*)?$`));
    await expect.soft(page.locator(EXD.eyebrow), 'Eyebrow').toHaveText(new RegExp(S('Workspace Eyebrow'), 'i'));
    const user = await userName(page);
    note('signed-in user', user);
    await expect.soft(page.locator(EXD.wsTitle), 'Welcome line names the user').toHaveText(`${S('Workspace Welcome')} ${user}`);
  });

  test(...tc('MSW-002'), async ({ ws, page }) => {
    await ws.open();
    await page.waitForTimeout(3000);
    const failed = ws.replies.filter(r => r.status >= 400).map(r => `${r.method} ${r.url} → ${r.status}`);
    note('requests', `${ws.replies.length} sent; failed: ${failed.join(' | ') || 'none'}`);
    expect.soft(failed, 'Requests that failed while the workspace loaded').toEqual([]);
    expect.soft(ws.errors, 'Script errors').toEqual([]);
    const text = await ws.main.innerText();
    expect.soft(text.match(BAD)?.[0] ?? '', 'Broken value on the page').toBe('');
  });

  test(...tc('MSW-003'), async ({ ws, src, page }) => {
    await ws.open();
    const sub = await ws.text(EXD.wsSub);
    const magnet = await src.leadMagnet();
    const kes = await src.usdToKes();
    note('welcome line', `${await ws.text(EXD.wsTitle)} ${sub}`);
    note('AI service / Currency module', `${magnet.locationName}, ${magnet.watamuTempCelsius}°C ${magnet.weatherCondition} · 1 USD = ${kes.toFixed(4)} KES (Currency Master)`);
    expect.soft(sub, 'Location of the AI service').toContain(magnet.locationName);
    expect.soft(sub, 'Temperature of the AI service').toContain(`${magnet.watamuTempCelsius}°C`);
    const fx = sub.match(/1 USD = ([\d.,]+) KES/)?.[1];
    expect(fx, 'FX line "1 USD = N KES"').toBeTruthy();
    expectShows(fx, kes, 'FX rate on the workspace = Currency Master rate (1 USD in KES)');
    void page;
  });

  test(...tc('MSW-004'), async ({ ws, src, page }) => {
    await ws.open();
    const c = await ws.counts();
    const api = await src.taskSummary('mine');
    const tp = await tasksPageCards(page);
    note('workspace / API / Tasks & Calendar', `${c.text} / overdue ${api.body.overdue}, today ${api.body.today} / ${tp.text}`);
    expect.soft(c.overdue, 'Overdue on the workspace = API').toBe(api.body.overdue);
    expect.soft(c.today, 'Due today on the workspace = API').toBe(api.body.today);
    expect.soft(c.overdue, 'Overdue on the workspace = Tasks & Calendar "My overdue"').toBe(tp.overdue);
    expect.soft(c.today, 'Due today on the workspace = Tasks & Calendar due today').toBe(tp.today);
  });

  test(...tc('MSW-005'), async ({ ws, page }) => {
    await ws.open();
    const c = await ws.counts();
    const btn = page.locator(EXD.tasksBadgeButton).first();
    const label = (await btn.getAttribute('aria-label')) ?? '';
    const badge = (await btn.innerText()).trim();
    const n = c.overdue + c.today;
    note('header', `label "${label}" · badge "${badge}" · ${c.text}`);
    expect.soft(label, 'Badge label').toBe(`Tasks (${n} due or overdue)`);
    expect.soft(badge, 'Badge text').toBe(n > 99 ? '99+' : String(n));
  });

  test(...tc('MSW-006'), async ({ ws, src }) => {
    await ws.open();
    const mine = await ws.counts();
    const r = await ws.scope(S('Team Scope'));
    const team = await ws.counts();
    const api = await src.taskSummary('team');
    note('Team', `request ${r ? `${r.url().replace(/^.*\/api\/v1/, '')} → ${r.status()}` : 'not sent'} · shown "${team.text}" · API ${api.status} ${JSON.stringify(api.body).slice(0, 200)}`);
    expect.soft(r?.status() ?? 0, 'Team counts request succeeds').toBeLessThan(400);
    expect.soft(api.status, 'GET /activities/summary?scope=team answers').toBe(200);
    if (api.status === 200) {
      expect.soft(team.overdue, 'Team overdue = API').toBe(api.body.overdue);
      expect.soft(team.today, 'Team due today = API').toBe(api.body.today);
    }
    await ws.scope(S('Mine Scope'));
    const back = await ws.counts();
    expect.soft(back.text, 'Mine shows the user\'s counts again').toBe(mine.text);
  });

  test(...tc('MSW-007'), async ({ ws, src }) => {
    await ws.open();
    const cards = await ws.taskCards();
    const open = (await src.get('/activities?status=OPEN&scope=mine&limit=12&offset=0')).items as any[];
    note('task cards', cards.map(c => `${c.tag} · ${c.name} · ${c.sub}`).join(' | '));
    expect(cards.length, 'Task cards shown').toBeGreaterThan(0);
    cards.forEach((c, i) => {
      const t = open[i];
      expect.soft(c.name, `Card ${i + 1} = open task ${i + 1} of the user`).toBe(t?.subject);
      const overdue = !!t && new Date(t.dueAt).getTime() < Date.now();
      expect.soft(c.tag.toUpperCase().includes(S('Overdue Tag')), `Card ${i + 1} tagged OVERDUE only when due before now (${t?.dueAt})`).toBe(overdue);
      expect.soft(c.check, `Card ${i + 1} tick is labelled`).toBe(`Mark ${c.name} complete`);
    });
  });

  test(...tc('MSW-008'), async ({ ws, src, page }) => {
    await ws.open();
    const link = await ws.tasksLink();
    const api = await src.taskSummary('mine');
    note('link', `${link.text} → ${link.href} · API totalOpen ${api.body.totalOpen}`);
    expect.soft(shown(link.text).value, '"Open all N tasks" = open tasks of the user').toBe(api.body.totalOpen);
    expect.soft(link.href, 'Link').toBe(S('Tasks Route'));
    await page.locator(EXD.tasksLink).first().click();
    await expect(page, 'Tasks & Calendar opens').toHaveURL(/\/activities/);
    await expect(page.locator('main')).toContainText('Tasks & Calendar');
  });

  test(...tc('MSW-009'), async ({ ws, src }) => {
    await ws.open();
    const prefs = await src.preferences();
    const deck = (await ws.decks())[0];
    const cards = await ws.allCards(0);
    const titleOf = Object.fromEntries(sheet('Deck Modules').map(r => [r['Key'], r['Card Title']]));
    note('saved pins / deck', `${prefs.pinnedModules.join(', ')} / ${cards.map(c => c.title).join(', ')} · "${deck.badge}" · "${deck.customize}"`);
    const n = prefs.pinnedModules.length;
    expect.soft(WorkspacePage.badge(deck.badge).of, '"of N pinned" = saved pins').toBe(n);
    expect.soft(cards.length, 'Cards shown = saved pins (none left out)').toBe(n);
    expect.soft(deck.customize, '"Customize (n/5)"').toContain(`(${n}/${S('Deck Limit')})`);
    const known = prefs.pinnedModules.filter((k: string) => titleOf[k]).map((k: string) => titleOf[k]);
    expect.soft(cards.map(c => c.title).filter(t => known.includes(t)), 'Cards follow the saved order').toEqual(known);
  });

  test(...tc('MSW-010'), async ({ ws, src }) => {
    await ws.open();
    const prefs = await src.preferences();
    const deck = (await ws.decks())[1];
    const cards = await ws.allCards(1);
    const codes = cards.map(c => c.step.split('·').pop()!.trim());
    note('saved report pins / deck', `${prefs.pinnedReports.join(', ')} / ${codes.join(', ')} · "${deck.badge}" · "${deck.customize}"`);
    const n = prefs.pinnedReports.length;
    expect.soft(WorkspacePage.badge(deck.badge).of, '"of N pinned" = saved report pins').toBe(n);
    expect.soft(codes, 'Report cards = saved report pins, in order').toEqual(prefs.pinnedReports);
    expect.soft(deck.customize, '"Customize (n/5)"').toContain(`(${n}/${S('Deck Limit')})`);
  });

  test(...tc('MSW-011'), async ({ ws, src }) => {
    await ws.open();
    const card = await ws.findCard(0, 'Leads');
    test.skip(!card, 'Leads is not pinned on the workspace');
    const c = await ws.counts();
    const leads = (await src.leads()).summary;
    const dash = await src.get('/dashboard/summary?period=this_month&view=audience');
    note('Leads card / Leads module / dashboard', `${card!.num} ${card!.unit} · ${card!.sub} / total ${leads.total}, converted ${leads.converted}, disqualified ${leads.disqualified} / active ${dash.metrics.activeLeads}, converted this month ${dash.audience.leadsConverted}`);
    expectShows(card!.num, leads.total - leads.converted - leads.disqualified, 'Active leads = Leads total − converted − disqualified');
    expectShows(card!.num, dash.metrics.activeLeads, 'Active leads = Lead & Customer Insights Active Leads');
    const follow = Number(card!.sub.match(/([\d,]+)\s*follow-ups today/)?.[1]?.replace(/,/g, ''));
    expect.soft(follow, 'Follow-ups today = due today of the Today strip').toBe(c.today);
    const conv = Number(card!.sub.match(/([\d,]+)\s*converted/)?.[1]?.replace(/,/g, ''));
    expect.soft(conv, 'Converted = converted leads of this month on the dashboards').toBe(dash.audience.leadsConverted);
  });

  test(...tc('MSW-012'), async ({ ws, src }) => {
    await ws.open();
    const card = await ws.findCard(0, 'Opportunities');
    test.skip(!card, 'Opportunities is not pinned on the workspace');
    const s = (await src.opportunities()).summary;
    const dash = await src.get('/dashboard/summary?period=this_month&view=audience');
    note('card / module', `${card!.num} ${card!.unit} · ${card!.sub} / open ${s.open}, won ${s.won}, avg ${s.avgProbability}% · won this month ${dash.metrics.wonOpportunities}`);
    expectShows(card!.num, s.open, 'Open deals = Opportunities Open');
    expectShows(card!.sub.match(/([\d.]+)%/)?.[0], s.avgProbability, 'Avg probability = Opportunities Avg Probability');
    expect.soft(Number(card!.sub.match(/(\d+)\s*won/)?.[1]), 'Won = deals won this month (dashboards)').toBe(dash.metrics.wonOpportunities);
  });

  test(...tc('MSW-013'), async ({ ws, src }) => {
    await ws.open();
    const card = await ws.findCard(0, 'Inventory');
    test.skip(!card, 'Inventory is not pinned on the workspace');
    const s = (await src.units()).summary;
    note('card / Inventory', `${card!.num} ${card!.unit} · ${card!.sub} / total ${s.total}, available ${s.available}, reserved ${s.reserved}`);
    expectShows(card!.num, s.total, 'Total units = Inventory Units');
    expect.soft(Number(card!.sub.match(/([\d,]+)\s*available/)?.[1]?.replace(/,/g, '')), 'Available = Inventory').toBe(s.available);
    expect.soft(Number(card!.sub.match(/([\d,]+)\s*reserved/)?.[1]?.replace(/,/g, '')), 'Reserved = Inventory').toBe(s.reserved);
  });

  test(...tc('MSW-014'), async ({ ws }) => {
    await ws.open();
    const root = (await ws.decks())[0].root;
    const prev = root.locator(EXD.deckSlide('Prev')), next = root.locator(EXD.deckSlide('Next'));
    const start = WorkspacePage.badge((await ws.decks())[0].badge);
    note('start', JSON.stringify(start));
    expect.soft(start.from, 'Starts on the first card').toBe(1);
    await expect.soft(prev, 'Prev disabled on the first card').toBeDisabled();
    let last = start;
    for (let i = 0; i < 10 && !(await next.isDisabled()); i++) {
      await next.click();
      await ws.page.waitForTimeout(300);
      const b = WorkspacePage.badge((await ws.decks())[0].badge);
      expect.soft(b.from, 'Next moves by one card').toBe(last.from + 1);
      const dots = await root.locator(EXD.deckDot).evaluateAll(ds => ds.findIndex(d => d.classList.contains('is-active')));
      expect.soft(dots, 'Active dot follows').toBeGreaterThan(-1);
      last = b;
    }
    expect.soft(last.to, 'Next is disabled only on the last card').toBe(last.of);
    while (!(await prev.isDisabled())) { await prev.click(); await ws.page.waitForTimeout(200); }
    expect.soft(WorkspacePage.badge((await ws.decks())[0].badge).from, 'Prev returns to the first card').toBe(1);
  });

  test(...tc('MSW-015'), async ({ ws, page }) => {
    test.setTimeout(600_000);
    await ws.open();
    const cards = [...await ws.allCards(0), ...await ws.allCards(1)];
    const routeOf = Object.fromEntries(sheet('Deck Modules').map(r => [r['Card Title'], r['Route']]));
    note('links', cards.map(c => `${c.title}: ${c.link} → ${c.href}`).join(' | '));
    for (const c of cards) {
      expect.soft(c.href, `${c.title}: has a link`).not.toBe('');
      if (!c.href) continue;
      if (routeOf[c.title]) expect.soft(c.href.startsWith(routeOf[c.title]), `${c.title}: link ${c.href} opens ${routeOf[c.title]}`).toBeTruthy();
      await page.goto(c.href);
      await page.waitForLoadState('networkidle').catch(() => {});
      const text = await page.locator('main').innerText().catch(() => '');
      expect.soft(/not found|something went wrong|page doesn.t exist/i.test(text), `${c.title}: ${c.href} loads`).toBeFalsy();
      expect.soft(text.length, `${c.title}: ${c.href} shows content`).toBeGreaterThan(50);
    }
  });

  test(...tc('MSW-016'), async ({ ws, src }) => {
    await ws.open();
    const before = JSON.stringify(await src.fresh('/preferences/my-workspace'));
    const decks = [await ws.allCards(0), await ws.allCards(1)];
    const win = await ws.openCustomize();
    await expect.soft(win, 'Customize note').toContainText(S('Customize Note'));
    const tabs = await ws.customizeTabs();
    note('tabs', tabs.join(' | '));
    const mods = await ws.customizeItems();
    const pinnedMods = mods.filter(m => m.pinned).map(m => m.name);
    note('pinned modules in Customize / deck', `${pinnedMods.join(', ')} / ${decks[0].map(c => c.title).join(', ')}`);
    expect.soft(pinnedMods.sort(), 'Pinned modules = cards of the Frequent Modules deck').toEqual(decks[0].map(c => c.title).sort());
    expect.soft(tabs[0], 'Modules tab count').toContain(`(${pinnedMods.length}/${S('Deck Limit')})`);
    await ws.customizeTab(tabs[1]?.split('(')[0].trim() ?? 'Reports');
    const reps = (await ws.customizeItems()).filter(m => m.pinned);
    note('pinned reports in Customize', reps.map(r => r.name).join(', '));
    expect.soft(reps.length, 'Pinned reports = cards of the Reports deck').toBe(decks[1].length);
    expect.soft(tabs[1], 'Reports tab count').toContain(`(${reps.length}/${S('Deck Limit')})`);
    await ws.closeCustomize();
    expect.soft(JSON.stringify(await src.fresh('/preferences/my-workspace')), 'Opening and closing Customize changes nothing').toBe(before);
  });

  test(...tc('MSW-017'), async ({ ws, src }) => {
    await ws.open();
    const original = await src.fresh('/preferences/my-workspace');
    note('saved pins before', original.pinnedModules.join(', '));
    await ws.openCustomize();
    const items = await ws.customizeItems();
    const pinned = items.filter(i => i.pinned);
    const candidate = items.find(i => !i.pinned);
    test.skip(pinned.length >= Number(S('Deck Limit')) || !candidate, 'The deck is full: no module can be pinned without unpinning one');
    let toggled = false;
    try {
      const st1 = await ws.togglePin(candidate!.name);
      toggled = true;
      note('pinned', `${candidate!.name} (save → ${st1})`);
      await ws.closeCustomize();
      const after = await ws.allCards(0);
      const deck = (await ws.decks())[0];
      expect.soft(after.map(c => c.title), `${candidate!.name} is on the deck`).toContain(candidate!.name);
      expect.soft(deck.customize, 'Count goes up by one').toContain(`(${pinned.length + 1}/`);
      await ws.openCustomize();
      await ws.togglePin(candidate!.name);
      toggled = false;
      await ws.closeCustomize();
      const back = await ws.allCards(0);
      expect.soft(back.map(c => c.title), `${candidate!.name} is off the deck again`).not.toContain(candidate!.name);
    } finally {
      if (toggled) { await ws.open(); await ws.openCustomize(); await ws.togglePin(candidate!.name); await ws.closeCustomize(); }
      let now = await src.fresh('/preferences/my-workspace');
      note('saved pins after', now.pinnedModules.join(', '));
      // a save from Customize rewrites the whole list and drops pins it does not show (e.g. "settings"): put the original back
      if (JSON.stringify(now.pinnedModules) !== JSON.stringify(original.pinnedModules)) {
        const r = await src.api.call('PUT', '/preferences/my-workspace', { ...now, pinnedModules: original.pinnedModules });
        note('pins put back', `PUT /preferences/my-workspace → ${r.status}`);
        expect.soft(now.pinnedModules, 'Pinning and unpinning in Customize keeps the other saved pins').toEqual(original.pinnedModules);
        now = await src.fresh('/preferences/my-workspace');
      }
      expect(now.pinnedModules, 'Saved pins are back to the original list').toEqual(original.pinnedModules);
    }
  });

  test(...tc('MSW-018'), async ({ ws, src, page }) => {
    await ws.open();
    const original = (await src.fresh('/preferences/my-workspace')).aiAdvisorCollapsed;
    const toggle = page.locator(EXD.aiToggle).first();
    if (original) { await toggle.click(); await page.waitForTimeout(800); }
    try {
      await expect.soft(toggle, 'Button while shown').toHaveText(new RegExp(S('AI Hide Button')));
      await toggle.click();
      await page.waitForTimeout(1000);
      await expect.soft(page.locator(EXD.aiPanel), 'Hide removes the AI panel').toHaveCount(0);
      await expect.soft(toggle, 'Button while hidden').toHaveText(new RegExp(S('AI Show Button')));
      await ws.open();
      await expect.soft(page.locator(EXD.aiPanel), 'Still hidden after a reload').toHaveCount(0);
      await page.locator(EXD.aiToggle).first().click();
      await page.waitForTimeout(1000);
      await expect.soft(page.locator(EXD.aiPanel), 'Show brings the panel back').toBeVisible();
    } finally {
      await ws.open();
      const now = (await src.fresh('/preferences/my-workspace')).aiAdvisorCollapsed;
      if (now !== original) { await page.locator(EXD.aiToggle).first().click(); await page.waitForTimeout(1000); }
      expect((await src.fresh('/preferences/my-workspace')).aiAdvisorCollapsed, 'AI panel preference put back').toBe(original);
    }
  });

  test(...tc('MSW-019'), async ({ ws, src, page }) => {
    await ws.open();
    const p = await ws.aiPanel();
    test.skip(!p, 'The AI panel is hidden for this user');
    const m = await src.leadMagnet();
    const sc = m.scenarios[m.activeScenario];
    note('panel / API', `${JSON.stringify(p)} / ${JSON.stringify({ label: sc.label, title: sc.title, fit: sc.matchScore, count: sc.leadCount, signals: sc.signals })}`);
    expect.soft(p!.fit, 'Fit').toBe(sc.matchScore);
    expect.soft(shown(p!.count).value, 'Matching leads').toBe(sc.leadCount);
    expect.soft(p!.title, 'Focus title').toContain(sc.title);
    expect.soft(p!.active, 'Active scenario').toBe(sc.label);
    expect.soft(p!.signals.map(s => `${s.label}: ${s.value}`), 'Signals').toEqual(sc.signals.map((s: any) => `${s.label}: ${s.value}`));
    for (const key of Object.keys(m.scenarios)) {
      const s = m.scenarios[key];
      await page.locator(EXD.aiScenario, { hasText: s.label }).first().click();
      await page.waitForTimeout(500);
      const q = await ws.aiPanel();
      expect.soft(q?.title ?? '', `${s.label}: focus title`).toContain(s.title);
      expect.soft(shown(q?.count ?? '').value, `${s.label}: matching leads`).toBe(s.leadCount);
    }
  });

  test(...tc('MSW-020'), async ({ ws, src, page }) => {
    await ws.open();
    const p = await ws.aiPanel();
    test.skip(!p, 'The AI panel is hidden for this user');
    const m = await src.leadMagnet();
    const sc = m.scenarios[m.activeScenario];
    await page.locator(EXD.aiShowLeads).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    // the pager ("Showing 1–20 of N leads") is hidden for 25 rows or fewer: then count the rows
    await expect(page.locator('main a.crm-record-link').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const text = await page.locator('main').innerText();
    const pager = text.match(/of\s+([\d,]+)\s+leads/);
    const listed = pager ? Number(pager[1].replace(/,/g, '')) : await page.locator('main tbody tr', { has: page.locator('a.crm-record-link') }).count();
    expect.soft(page.url(), `The Leads page is filtered by the scenario (${sc.filterQuery})`).toContain(sc.filterQuery.split('=')[1]);
    note('opened', `${page.url()} · listed ${listed} · panel says ${sc.leadCount} (filter ${sc.filterQuery})`);
    expect.soft(page.url(), 'Leads page opens').toContain(S('Leads Route'));
    expect.soft(listed, 'Leads listed = matching leads of the panel').toBe(sc.leadCount);
  });

  test(...tc('MSW-021'), async ({ ws, src, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ws.open();
    test.skip(!(await ws.aiPanel()), 'The AI panel is hidden for this user');
    const m = await src.leadMagnet();
    const sc = m.scenarios[m.activeScenario];
    await page.locator(EXD.aiCopyPitch).first().click();
    await page.waitForTimeout(800);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    note('clipboard', clip);
    expect.soft(clip, 'Clipboard holds the scenario pitch').toBe(sc.pitch);
    expect.soft(clip, `Project name spelled "${S('Pitch Brand')}"`).toContain(S('Pitch Brand'));
  });

  test(...tc('MSW-022'), async ({ ws, page }) => {
    await ws.open();
    await at(page, EXD.wsButton(S('Executive Button'))).click();
    await expect(page, 'Dashboards open').toHaveURL(new RegExp(`${S('Dashboards Route')}(\\?.*)?$`));
    await expect.soft(at(page, EXD.dashTab(S('Default Tab'))), 'Commercial / Sales tab').toHaveClass(/is-active/);
  });

  test(...tc('MSW-023'), async ({ ws, page }) => {
    await ws.open();
    await page.evaluate(() => document.getElementById('qa-hide-reminders')?.remove());
    const stack = page.locator(EXD.reminderStack);
    test.skip(!(await stack.isVisible().catch(() => false)), 'No reminder is due for this user right now');
    const box = (await stack.boundingBox())!;
    const hit = async (sel: string, what: string) => {
      const b = await page.locator(sel).first().boundingBox().catch(() => null);
      return b && b.x < box.x + box.width && box.x < b.x + b.width && b.y < box.y + box.height && box.y < b.y + b.height ? what : '';
    };
    const covered = (await Promise.all([hit(EXD.userMenu, 'user menu'), hit(EXD.tasksBadgeButton, 'task icon'), hit('header button[aria-label="Calendar"], .crm-title-banner button[aria-label="Calendar"]', 'calendar icon'),
      hit(EXD.wsButton(S('Executive Button')).replace(/^\/\//, 'xpath=//'), 'Executive Dashboards button'), hit(EXD.deckSection, 'deck cards')])).filter(Boolean);
    const toasts = await stack.locator('.crm-reminder-toast').evaluateAll(ts => ts.map(t => [...t.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') ?? (b as HTMLElement).innerText).trim())));
    note('reminders', `${toasts.length} cards at x=${Math.round(box.x)} y=${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)} · buttons: ${toasts.map(b => b.join('/')).join(' | ')} · covers: ${covered.join(', ') || 'nothing'}`);
    await page.screenshot({ path: test.info().outputPath('reminders.png') });
    expect.soft(covered, 'Reminder cards cover parts of the page').toEqual([]);
    expect.soft(toasts.every(b => b.some(x => /^(×|✕|close|hide)$/i.test(x))), 'Each reminder can be closed without changing the task').toBeTruthy();
  });

  test(...tc('MSW-024'), async ({ ws, page }) => {
    test.setTimeout(300_000);
    for (const v of sheet('Viewports')) {
      await page.setViewportSize({ width: Number(v['Width']), height: Number(v['Height']) });
      await ws.open();
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth,
        cut: [...document.querySelectorAll('.crm-sw-deck-kpi-num')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => (e as HTMLElement).innerText.trim()) }));
      note(v['Name'], `page ${r.sw}px in ${r.w}px · cut off: ${r.cut.join(', ') || 'none'}`);
      expect.soft(r.sw, `${v['Name']}: no sideways scrolling`).toBeLessThanOrEqual(r.w + 1);
      expect.soft(r.cut, `${v['Name']}: titles and figures not cut off`).toEqual([]);
    }
  });

  test(...tc('MSW-025'), async ({ ws, page }) => {
    const t0 = Date.now();
    await page.goto(S('Workspace Route'));
    await expect(page.locator(EXD.tasksCounts)).toContainText(/\d/, { timeout: 30_000 });
    const ms = Date.now() - t0;
    await ws.ready();
    const nums = await page.locator(EXD.deckNum).allInnerTexts();
    const text = await page.locator(EXD.workspace).innerText();
    note('timing / figures', `${ms} ms · ${nums.join(', ')}`);
    expect.soft(ms, `Ready within ${N('Load Budget Ms')} ms`).toBeLessThanOrEqual(N('Load Budget Ms'));
    for (const n of nums) expect.soft(/^\d{1,3}(,\d{3})*$/.test(n.trim()), `"${n}" is a whole number with thousands separators`).toBeTruthy();
    for (const p of text.match(/\d[\d.,]*\s*%/g) ?? []) expect.soft(displays(p, shown(p).value), `"${p}" is a percentage`).toBeTruthy();
    expect.soft(text.match(BAD)?.[0] ?? '', 'Broken value').toBe('');
  });
});
