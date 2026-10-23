/**
 * Brokers & Channels (BC-001…018). The page only reads data, so nothing on QA is changed.
 * Figures are checked against independent sources: the Customers & Brokers cards and Broker Register, and the
 * Leads export (leads created this month).
 */
import { test as base, expect, note } from '../opportunities/fixtures';
import { bc } from './catalog';
import { ROUTES } from '../locators';
import { download, Sheet } from '../helpers';
import { BrokersChannelsPage } from './BrokersChannelsPage';
import { CustomersBrokersPage } from '../customers-brokers/CustomersBrokersPage';

const test = base.extend<{ hub: BrokersChannelsPage; cbp: CustomersBrokersPage }>({
  hub: async ({ page }, use) => use(new BrokersChannelsPage(page)),
  cbp: async ({ page }, use) => use(new CustomersBrokersPage(page)),
});

const INTRO = 'Broker register, attribution, channel performance, and commission tracking.';
const BAD = /^\s*$|NaN|undefined|Infinity|null/;
const path = (url: string) => { const u = new URL(url); return `${u.pathname}${u.search}`; };

/** Leads created in the current month, from the Leads page export ("Created At" is an Excel date). */
async function leadsThisMonth(page: import('@playwright/test').Page): Promise<Sheet['rows']> {
  await page.goto(ROUTES.leads);
  await page.waitForLoadState('networkidle').catch(() => {});
  const file = await download(page, page.locator('main button.crm-export-button').first(), 120_000);
  const now = new Date();
  const asDate = (v: unknown) => typeof v === 'number' ? new Date(Math.round((v - 25569) * 86_400_000)) : new Date(String(v));
  return file.rows.filter(r => { const d = asDate(r['Created At']); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
}

test.describe('Brokers & Channels · Page', () => {
  // ── BC-001 · Brokers & Channels opens from the side menu
  // Area: Page › Navigation
  // Checks: URL is /brokers-channels; eyebrow "CHANNEL MANAGEMENT", heading "Brokers & Channels", "All amounts
  //   in USD" and the intro "Broker register, attribution, channel performance, and commission tracking."
  test(...bc('BC-001'), async ({ hub, page }) => {
    await page.goto(ROUTES.dashboard);
    await page.getByRole('link', { name: 'Brokers & Channels', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.brokersChannels}(\\?.*)?$`));
    await expect(hub.heading()).toBeVisible();
    await expect.soft(page.locator('main .crm-module-header .crm-eyebrow'), 'Eyebrow').toHaveText(/channel management/i);
    await expect.soft(hub.intro, 'Intro').toHaveText(INTRO);
    await expect.soft(page.locator('main .crm-module-header .crm-currency-label'), 'Currency').toHaveText(/All amounts in\s*USD/);
  });

  // ── BC-002 · Page loads without errors
  // Area: Page › Page
  // Checks: Sections "Live broker & channel signals" and "Module menu" are shown; no JavaScript errors, failed
  //   API calls, NaN or undefined
  test(...bc('BC-002'), async ({ hub, page }) => {
    hub.watchErrors();
    await hub.open();
    for (const h of ['Live broker & channel signals', 'Module menu']) await expect.soft(page.getByRole('heading', { name: h, exact: true }), h).toBeVisible();
    await hub.expectNoBrokenValues();
    hub.expectNoErrors();
  });

  // ── BC-003 · Status summary matches the module cards
  // Area: Page › Status summary
  // Checks: Each count equals the number of module cards with that status (2 Live, 5 Partial, 3 Planned at the
  //   time of writing)
  test(...bc('BC-003'), async ({ hub }) => {
    await hub.open();
    const summary = await hub.summary();
    const cards = await hub.moduleCards();
    const counted = cards.reduce<Record<string, number>>((m, c) => { const k = c.status.toLowerCase(); m[k] = (m[k] ?? 0) + 1; return m; }, {});
    note('status', { summary, cards: counted });
    expect(summary, 'Summary counts = module cards by status').toEqual(counted);
  });
});

test.describe('Brokers & Channels · Signals', () => {
  // ── BC-004 · Signal cards show loaded values
  // Area: Signals › Cards
  // Checks: Every card shows a number; Active Brokers ≤ Total Brokers
  test(...bc('BC-004'), async ({ hub }) => {
    await hub.open();
    const v = Object.fromEntries(await Promise.all(hub.signals.map(async s => [s, await hub.signal(s)])));
    note('signals', v);
    for (const s of hub.signals) expect.soft(v[s], s).toBeGreaterThanOrEqual(0);
    expect.soft(v['Active Brokers'], 'Active ≤ Total').toBeLessThanOrEqual(v['Total Brokers']);
  });

  // ── BC-005 · Total Brokers equals the Broker Register
  // Area: Signals › Cards
  // Checks: Total Brokers = Brokers card = Broker Register total
  test(...bc('BC-005'), async ({ hub, cbp }) => {
    await hub.open();
    const total = await hub.signal('Total Brokers');
    await cbp.open();
    const card = await cbp.card('Brokers');
    await cbp.showTab('Brokers');
    const listed = await cbp.total();
    note('brokers', { hub: total, card, register: listed });
    expect.soft(total, 'Total Brokers = Brokers card').toBe(card);
    expect.soft(total, 'Total Brokers = Broker Register').toBe(listed);
  });

  // ── BC-006 · Active Brokers counts the active brokers
  // Area: Signals › Cards
  // Checks: Active Brokers = Active Brokers card on Customers & Brokers = brokers with status ACTIVE
  test(...bc('BC-006'), async ({ hub, cbp }) => {
    await hub.open();
    const active = await hub.signal('Active Brokers');
    await cbp.open();
    const card = await cbp.card('Active Brokers');
    await cbp.showTab('Brokers');
    const info = await cbp.pagerInfo();
    const rows = await cbp.brokerRows();
    note('active', { hub: active, card, activeRows: rows.filter(r => r.status === 'ACTIVE').length, rows: rows.length });
    expect.soft(active, 'Active Brokers = Active Brokers card').toBe(card);
    if (!info || info.pages === 1) expect.soft(active, 'Active Brokers = ACTIVE rows').toBe(rows.filter(r => r.status === 'ACTIVE').length);
  });

  // ── BC-007 · Lead Sources (this month) counts this month's sources
  // Area: Signals › Cards
  // Checks: Lead Sources (this month) = number of different lead sources among this month's leads
  test(...bc('BC-007'), async ({ hub, page }) => {
    test.setTimeout(180_000);
    await hub.open();
    const shown = await hub.signal('Lead Sources (this month)');
    const leads = await leadsThisMonth(page);
    const sources = [...new Set(leads.map(r => String(r['Source'] ?? '').trim()).filter(Boolean))].sort();
    note('sources', { shown, fromLeads: sources });
    expect(shown, 'Lead Sources (this month) = different sources of this month\'s leads').toBe(sources.length);
  });

  // ── BC-008 · Capture Channels (this month) counts the channels listed
  // Area: Signals › Top capture channels
  // Checks: Capture Channels (this month) = number of rows in Top capture channels
  test(...bc('BC-008'), async ({ hub }) => {
    await hub.open();
    const rows = await hub.miniList('Top capture channels');
    note('channels', rows);
    expect(await hub.signal('Capture Channels (this month)'), 'Capture Channels = rows listed').toBe(rows.length);
  });

  // ── BC-009 · Top capture channels add up to this month's leads
  // Area: Signals › Top capture channels
  // Checks: Every row reads "<channel> · N leads"; the rows add up to the number of leads created this month
  test(...bc('BC-009'), async ({ hub, page }) => {
    test.setTimeout(180_000);
    await hub.open();
    const rows = await hub.miniList('Top capture channels');
    for (const [channel, leads] of rows) {
      expect.soft(channel, 'Channel name').not.toMatch(BAD);
      expect.soft(leads, `${channel}: "N leads"`).toMatch(/^\d[\d,]* leads?$/);
    }
    const sum = rows.reduce((a, [, l]) => a + Number(l.replace(/\D/g, '')), 0);
    const created = (await leadsThisMonth(page)).length;
    note('capture channels', { rows, sum, leadsCreatedThisMonth: created });
    expect(sum, 'Top capture channels add up to this month\'s leads').toBe(created);
  });

  // ── BC-010 · Registered brokers lists the newest brokers
  // Area: Signals › Registered brokers
  // Checks: The list shows the 5 newest brokers of the Broker Register, in the same order, each with its BRK-…
  //   code
  test(...bc('BC-010'), async ({ hub, cbp }) => {
    await hub.open();
    const listed = await hub.miniList('Registered brokers');
    await cbp.open();
    await cbp.showTab('Brokers');
    const newest = (await cbp.brokerRows()).slice(0, 5).map(r => [r.name, r.code]);
    note('brokers', { hub: listed, register: newest });
    for (const [, code] of listed) expect.soft(code, 'Broker code').toMatch(/^BRK-[\w-]+$/);
    expect(listed, 'The 5 newest brokers, same order').toEqual(newest);
  });

  // ── BC-011 · Open Broker Register opens the Brokers tab
  // Area: Signals › Navigation
  // Checks: Customers & Brokers opens on the Brokers tab (/customers?tab=brokers) showing the Broker Register
  test(...bc('BC-011'), async ({ hub, cbp, page }) => {
    await hub.open();
    await hub.openBrokerRegister.click();
    await expect(page).toHaveURL(/\/customers\?tab=brokers/);
    await expect(cbp.tab('Brokers'), 'Brokers tab selected').toHaveClass(/is-active/);
    await expect(page.getByRole('heading', { name: 'Broker Register', exact: true }), 'Broker Register shown').toBeVisible();
  });
});

test.describe('Brokers & Channels · Module menu', () => {
  // ── BC-012 · Module menu lists the broker and channel modules
  // Area: Module menu › Cards
  // Checks: Cards: Broker Register (Live), Broker Portal (Planned), Broker Leads (Partial), Broker Attribution
  //   (Partial), Broker Performance (Planned), Broker Reservations (Partial), Broker SPAs (Partial), Broker
  //   Commission Status (Partial), Channel Performance (Live), Broker Documents (Planned), each with its
  //   description
  test(...bc('BC-012'), async ({ hub }) => {
    await hub.open();
    const cards = (await hub.moduleCards()).map(c => ({ name: c.name, status: c.status, description: c.description }));
    expect(cards, 'Module cards').toEqual(hub.modules.map(m => ({ name: m.name, status: m.status, description: m.description })));
  });

  // ── BC-013 · Available modules open; planned ones say so
  // Area: Module menu › Cards
  // Checks: Live and Partial cards are links ending "Open module →"; Planned cards are not links and say
  //   "Development in progress"
  test(...bc('BC-013'), async ({ hub }) => {
    await hub.open();
    for (const c of await hub.moduleCards()) {
      if (c.status === 'Planned') {
        expect.soft(c.href, `${c.name}: not a link`).toBeNull();
        expect.soft(c.footer, `${c.name}: footer`).toBe('Development in progress');
      } else {
        expect.soft(c.href, `${c.name}: is a link`).not.toBeNull();
        expect.soft(c.footer, `${c.name}: footer`).toBe('Open module →');
      }
    }
  });

  // ── BC-014 · Module links open working pages
  // Area: Module menu › Navigation
  // Checks: Broker Register and Broker Commission Status open Customers & Brokers on the Brokers tab; Broker
  //   Leads and Broker Attribution open Leads; Broker Reservations opens Unit Reservations; Broker SPAs opens
  //   SPA / Sales Contracts — each without errors
  test(...bc('BC-014'), async ({ hub, page }) => {
    test.setTimeout(240_000);
    const LANDS: Record<string, { url: RegExp; check: () => Promise<void> }> = {
      '/customers?tab=brokers': { url: /\/customers\?tab=brokers/, check: () => expect(page.getByRole('heading', { name: 'Broker Register', exact: true })).toBeVisible() },
      '/leads': { url: /\/leads(\?.*)?$/, check: () => expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible() },
      '/reservations': { url: /\/reservations(\?.*)?$/, check: () => expect(page.getByRole('heading', { name: 'Unit Reservations', exact: true })).toBeVisible() },
      '/spa-contracts': { url: /\/spa-contracts(\?.*)?$/, check: () => expect(page.getByRole('heading', { name: 'SPA / Sales Contracts', exact: true })).toBeVisible() },
    };
    const results: string[] = [];
    for (const m of hub.modules.filter(x => x.href && x.name !== 'Channel Performance')) {
      const errors: string[] = [];
      const onError = (e: Error) => errors.push(e.message);
      await hub.open();
      page.on('pageerror', onError);
      await hub.moduleCard(m.name).click();
      const land = LANDS[m.href!];
      await expect.soft(page, `${m.name}: opens ${m.href}`).toHaveURL(land.url);
      await land.check().catch(e => expect.soft(String(e), `${m.name}: page shown`).toBe(''));
      await page.waitForLoadState('networkidle').catch(() => {});
      page.off('pageerror', onError);
      expect.soft(errors, `${m.name}: JavaScript errors`).toEqual([]);
      results.push(`${m.name} → ${path(page.url())}`);
    }
    note('landed', results);
  });

  // ── BC-015 · Channel Performance opens the channel comparison
  // Area: Module menu › Navigation
  // Checks: A page comparing lead sources and capture channels opens (the card is marked Live)
  test(...bc('BC-015'), async ({ hub, page }) => {
    await hub.open();
    await hub.moduleCard('Channel Performance').click();
    await page.waitForLoadState('networkidle').catch(() => {});
    note('landed', path(page.url()));
    await expect(page.locator('main').getByText(/lead source|capture channel/i).first(), 'A lead-source / capture-channel comparison is shown')
      .toBeVisible({ timeout: 15_000 });
  });

  // ── BC-016 · Planned modules cannot be opened
  // Area: Module menu › Cards
  // Checks: Nothing opens; the page stays on /brokers-channels
  test(...bc('BC-016'), async ({ hub, page }) => {
    await hub.open();
    for (const m of hub.modules.filter(x => !x.href)) {
      await hub.moduleCard(m.name).click();
      await page.waitForTimeout(500);
      await expect.soft(page, `${m.name}: stays on Brokers & Channels`).toHaveURL(new RegExp(`${ROUTES.brokersChannels}(\\?.*)?$`));
    }
  });
});

test.describe('Brokers & Channels · Access', () => {
  // ── BC-017 · Signed-out user is sent to the login page
  // Area: Access › Navigation
  // Checks: Redirected to /login; no broker or channel data shown
  test(...bc('BC-017'), async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(ROUTES.brokersChannels);
    await expect(page, 'Signed-out user sent to login').toHaveURL(/\/login/, { timeout: 15_000 });
    await expect.soft(page.getByRole('heading', { name: 'Brokers & Channels' }), 'No data shown').toHaveCount(0);
    await ctx.close();
  });

  // ── BC-018 · Backend rejects the page's data requests without a login
  // Area: Access › API
  // Checks: Every call returns 401
  test(...bc('BC-018'), async ({ api }) => {
    await api.ready();
    const got: Record<string, number> = {};
    for (const [path, auth] of [['/brokers?limit=5', 'none'], ['/brokers?limit=5', 'invalid'],
      ['/dashboard/summary?period=this_month&view=audience', 'none'], ['/dashboard/summary?period=this_month&view=audience', 'invalid']] as const) {
      got[`GET ${path} (${auth === 'none' ? 'no token' : 'invalid token'})`] = (await api.call('GET', path, undefined, { auth })).status;
    }
    note('statuses', got);
    expect.soft(Object.entries(got).filter(([, s]) => s !== 401).map(([k, s]) => `${k} → ${s}`), 'Calls not answered 401').toEqual([]);
  });
});

