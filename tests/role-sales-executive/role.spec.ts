/**
 * Role-based testing — Sales Executive (RSE-001…041). What the role may do is read from its permission matrix (as the
 * admin) at run time; the role's user signs in in a separate browser. Only RSE-030…033 write: one test lead, edited,
 * qualified and converted by the Sales Executive. Runs in order on one worker.
 * Run: npm run test:role-sales-executive
 */
import fs from 'fs';
import path from 'path';
import { test, expect, tc, S, list, note, modules, visit, action, type Matrix, type Module, type Session } from './shared';
import { LeadForm } from '../pages/LeadForm';
import { LeadsPage } from '../pages/LeadsPage';
import { newLead, basicValues } from '../leads-page/test-data';
import { checklistValues } from '../lead-detail/test-data';
import { download } from '../helpers';

// kept outside test-results (Playwright clears that folder on every run)
const LEAD_FILE = path.resolve(__dirname, '../../.auth/role-sales-executive-lead.json');
const savedLead = (): { leadNo: string; email: string; name: string } | undefined => { try { return JSON.parse(fs.readFileSync(LEAD_FILE, 'utf8')); } catch { return undefined; } };
const can = (m: Matrix, perm: string, what: 'view' | 'create' | 'update' | 'export') => !!m[perm]?.[what];
const fullName = async (se: Session) => (await se.api.get('/auth/me')).body.fullName as string;
const ownerOf = (i: any) => i.assignedToUser?.name ?? i.assignedTo?.name ?? i.owner?.name ?? i.ownerUser?.name ?? null;

test.describe('Role · Sales Executive', () => {
  test.describe.configure({ mode: 'default', timeout: 600_000 });

  test(...tc('RSE-001'), async ({ se }) => {
    await visit(se, '/');
    const me = (await se.api.get('/auth/me')).body;
    const header = (await se.page.locator('.crm-user-menu-button').first().innerText()).replace(/\s+/g, ' ');
    note('signed in', `${se.page.url()} · header "${header}" · mustChangePassword ${me.mustChangePassword}`);
    expect.soft(me.mustChangePassword, 'No forced password change').toBeFalsy();
    expect.soft(header, 'Header shows the full name').toContain(me.fullName);
    expect.soft(header, 'Header shows the role').toContain(S('Role Name'));
    await expect.soft(se.page.locator('main .crm-smart-workspace'), 'My Smart Workspace opens').toBeVisible();
  });

  test(...tc('RSE-002'), async ({ se, matrix }) => {
    await visit(se, '/');
    const menu = (await se.page.locator('nav a, aside a').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
    note('menu', menu.join(' | '));
    for (const m of modules().filter(x => x['Menu Label'])) {
      const shown = menu.includes(m['Menu Label']);
      expect.soft(shown, `${m['Menu Label']}: in the menu = role can view ${m.Permission} (${can(matrix, m.Permission, 'view')})`).toBe(can(matrix, m.Permission, 'view'));
    }
  });

  test(...tc('RSE-003'), async ({ admin, se }) => {
    const users = (await admin.get('/admin/users?limit=100&offset=0&roleScope=exclude_portal')).body.items as any[];
    const u = users.find(x => x.username.toLowerCase() === se.user.toLowerCase());
    const me = (await se.api.get('/auth/me')).body;
    note('user (admin view) / me', `${JSON.stringify({ role: u?.roles?.map((r: any) => `${r.roleCode}${r.isPrimary ? '*' : ''}`), status: u?.status, login: u?.loginEnabled, reportsTo: u?.reportsTo?.name })} / ${JSON.stringify({ roles: me.roles?.map((r: any) => r.code), mustChange: me.mustChangePassword })}`);
    expect(u, 'User listed in Users & Roles').toBeTruthy();
    expect.soft(u.roles.find((r: any) => r.isPrimary)?.roleCode, 'Primary role').toBe(S('Role Code'));
    expect.soft(u.status, 'Status').toBe('ACTIVE');
    expect.soft(u.loginEnabled, 'Login enabled').toBe(true);
    expect.soft(u.reportsTo?.name ?? '', 'Reports to a manager').not.toBe('');
    expect.soft(me.roles.map((r: any) => r.code), 'Signed-in user has the role').toContain(S('Role Code'));
  });

  test(...tc('RSE-010'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x.Route && !can(matrix, x.Permission, 'view'))) {
      const v = await visit(se, m.Route);
      const denied = v.text.includes(S('Denied Title')) || v.text.includes(S('Users Denied Title'));
      note(m.Route, `${denied ? 'denied' : 'NOT denied'} · ${v.text.slice(v.text.search(/PERMISSION|ACCESS/i), v.text.search(/PERMISSION|ACCESS/i) + 160) || v.text.slice(0, 160)}`);
      expect.soft(denied, `${m.Module} (${m.Route}) shows Permission Denied`).toBeTruthy();
    }
  });

  test(...tc('RSE-011'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x.Route && can(matrix, x.Permission, 'view'))) {
      const v = await visit(se, m.Route);
      note(m.Route, `failed requests: ${v.failed.join(' | ') || 'none'}`);
      expect.soft(v.text.includes(S('Denied Title')), `${m.Module} (${m.Route}) opens`).toBeFalsy();
      expect.soft(v.failed, `${m.Module} (${m.Route}): no request fails`).toEqual([]);
    }
  });

  test(...tc('RSE-012'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x['List API'] && !can(matrix, x.Permission, 'view'))) {
      const r = await se.api.get(m['List API']);
      note(m['List API'], `${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
      expect.soft(r.status, `GET ${m['List API']} refused`).toBe(403);
      expect.soft(r.body?.message ?? '', `${m.Module}: names the permission`).toContain(`${m.Permission}.view`);
    }
  });

  test(...tc('RSE-013'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x['Create API'] && !can(matrix, x.Permission, 'create'))) {
      const r = await se.api.call('POST', m['Create API'], {});
      note(m['Create API'], `${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
      expect.soft(r.status, `POST ${m['Create API']} refused`).toBe(403);
      expect.soft(r.body?.message ?? '', `${m.Module}: names the permission`).toContain(`${m.Permission}.create`);
    }
  });

  test(...tc('RSE-014'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x['Create API'] && can(matrix, x.Permission, 'create'))) {
      const r = await se.api.call('POST', m['Create API'], {});
      note(m['Create API'], `${r.status} ${JSON.stringify(r.body).slice(0, 140)}`);
      expect.soft(r.status, `POST ${m['Create API']} not refused for permission (empty body → 400)`).not.toBe(403);
      expect.soft(r.status, `POST ${m['Create API']}: nothing saved from an empty body`).toBeGreaterThanOrEqual(400);
    }
  });

  test(...tc('RSE-015'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x.Route && can(matrix, x.Permission, 'view'))) {
      await visit(se, m.Route);
      for (const [col, right] of [['Create Button', 'create'], ['Edit Button', 'update']] as const) {
        if (!m[col] || can(matrix, m.Permission, right)) continue;
        const b = action(se.page, m[col]);
        const shown = await b.isVisible().catch(() => false), enabled = shown && await b.isEnabled().catch(() => false);
        note(`${m.Route} "${m[col]}"`, `shown ${shown}, enabled ${enabled}${shown ? `, title "${await b.getAttribute('title') ?? ''}"` : ''}`);
        if (enabled) await se.page.screenshot({ path: test.info().outputPath(`${m.Permission}-${m[col].replace(/\W+/g, '_')}.png`) });
        expect.soft(enabled, `${m.Module}: "${m[col]}" not offered without ${right} permission`).toBeFalsy();
      }
    }
  });

  test(...tc('RSE-016'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x.Route && x['Create Button'] && can(matrix, x.Permission, 'view') && can(matrix, x.Permission, 'create'))) {
      await visit(se, m.Route);
      const b = action(se.page, m['Create Button']);
      const shown = await b.isVisible().catch(() => false);
      note(`${m.Route} "${m['Create Button']}"`, `shown ${shown}, enabled ${shown && await b.isEnabled().catch(() => false)}`);
      expect.soft(shown && await b.isEnabled(), `${m.Module}: "${m['Create Button']}" offered`).toBeTruthy();
    }
  });

  test(...tc('RSE-017'), async ({ se, matrix }) => {
    for (const m of modules().filter(x => x.Route && x['Export Button'] && can(matrix, x.Permission, 'view') && can(matrix, x.Permission, 'export'))) {
      await visit(se, m.Route);
      const b = action(se.page, m['Export Button']);
      if (!(await b.isVisible().catch(() => false))) { note(m.Route, 'no Export button'); expect.soft(false, `${m.Module}: Export offered (role has Export)`).toBeTruthy(); continue; }
      const total = (await se.api.get(m['List API'])).body?.pagination?.total;
      const file = await download(se.page, b, 90_000).catch(e => ({ rows: [] as any[], error: String(e).slice(0, 120) } as any));
      note(m.Route, `exported ${file.rows?.length ?? 0} rows · register total ${total}${file.error ? ` · ${file.error}` : ''}`);
      expect.soft(file.rows?.length ?? 0, `${m.Module}: export holds the records the user sees`).toBe(total);
    }
  });

  test(...tc('RSE-018'), async ({ se, matrix }) => {
    const v = await visit(se, '/');
    const strip = (await se.page.locator('main .crm-sw-tasks-strip').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const badge = await se.page.locator('button[aria-label^="Tasks ("]').first().getAttribute('aria-label').catch(() => null);
    note('workspace', `Tasks permission view=${can(matrix, 'ACTIVITIES', 'view')} · strip "${strip.slice(0, 200)}" · badge ${badge} · failed: ${v.failed.join(' | ') || 'none'}`);
    expect.soft(v.failed, 'No request fails on My Smart Workspace').toEqual([]);
    if (!can(matrix, 'ACTIVITIES', 'view')) expect.soft(/\b0 overdue · 0 due today\b/.test(strip), 'Without Tasks permission the strip does not pretend there are no tasks').toBeFalsy();
  });

  test(...tc('RSE-019'), async ({ se, matrix }) => {
    test.skip(!can(matrix, 'SERVICE_REQUESTS', 'create'), 'Role cannot create service requests');
    await visit(se, '/service-requests');
    const from = se.failed.length;
    await action(se.page, 'New Request').click();
    await se.page.waitForLoadState('networkidle').catch(() => {});
    await se.page.waitForTimeout(1500);
    const form = se.page.locator('[role=dialog], form').last();
    const selects = await form.locator('select').evaluateAll(ss => ss.map(s => `${s.getAttribute('name') ?? s.getAttribute('aria-label') ?? ''}: ${(s as HTMLSelectElement).options.length} options`));
    const failed = [...new Set(se.failed.slice(from))];
    note('New Request form', `${selects.join(' | ')} · failed: ${failed.join(' | ') || 'none'}`);
    await se.page.screenshot({ path: test.info().outputPath('service-request-form.png') });
    expect.soft(failed, 'No request fails while the form opens').toEqual([]);
    await se.page.keyboard.press('Escape');
  });

  test(...tc('RSE-020'), async ({ se }) => {
    const mask = S('Mask Character');
    await visit(se, '/customers');
    const cust = (await se.page.locator('main table tbody tr').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const lead = (await se.api.get('/leads?limit=1&offset=0')).body.items?.[0];
    note('masked', `customer row "${cust.slice(0, 160)}" · lead API email "${lead?.email}" mobile "${lead?.mobileNo}"`);
    expect.soft(cust, 'Customer contact masked').toContain(mask);
    expect.soft(`${lead?.email}${lead?.mobileNo}`, 'Lead contact masked').toContain(mask);
  });

  // ── lead lifecycle (one lead) ──
  test(...tc('RSE-030'), async ({ se }) => {
    const lead = newLead('Individual');
    const f = new LeadForm(se.page, 'Individual');
    await f.open();
    await f.fill(basicValues(lead));
    const r = await f.submit();
    await f.closeNotice();
    note('test data', `${lead.name} · ${lead.values['Mobile']} · ${lead.values['Email']} · ${lead.values['Lead Source']}`);
    expect(r.saved, `Lead saved (status ${r.status} ${r.notice?.text ?? ''})`).toBeTruthy();
    const found = (await se.api.get(`/leads?search=${encodeURIComponent(r.leadNo ?? lead.values['Email'])}&limit=5&offset=0`)).body.items?.[0];
    const me = await fullName(se);
    fs.mkdirSync(path.dirname(LEAD_FILE), { recursive: true });
    fs.writeFileSync(LEAD_FILE, JSON.stringify({ leadNo: found?.leadNo ?? r.leadNo, email: lead.values['Email'], name: lead.name }));
    note('lead created', `${found?.leadNo ?? r.leadNo} · owner ${ownerOf(found)}`);
    expect.soft(ownerOf(found), 'Owner is the Sales Executive').toBe(me);
    const mine = (await se.api.get('/leads/tab-counts')).body;
    note('tab counts', JSON.stringify(mine));
    const leads = new LeadsPage(se.page);
    await se.page.goto('/leads/my');
    await se.page.waitForLoadState('networkidle').catch(() => {});
    await expect.soft(se.page.locator('main'), 'The lead is in My Leads').toContainText(found?.leadNo ?? r.leadNo ?? lead.name);
    void leads;
  });

  test(...tc('RSE-031'), async ({ se }) => {
    const l = savedLead();
    test.skip(!l, 'No lead from RSE-030');
    const leads = new LeadsPage(se.page);
    await leads.openRoute();
    await leads.find(l!.leadNo);
    const f = await leads.editLead(l!.leadNo, 'Individual');
    const text = `Role test address ${Date.now() % 10000}`;
    await f.set('Address 1 Address Line 1', text);
    const saved = se.page.waitForResponse(r => /\/api\/v1\/leads\//.test(r.url()) && ['PUT', 'PATCH'].includes(r.request().method()), { timeout: 60_000 }).catch(() => undefined);
    await se.page.getByRole('button', { name: /^(Save|Update)/ }).last().click();
    const r = await saved;
    const n = await f.notice.wait(5_000);
    if (n) await f.notice.close().catch(() => {});
    const after = (await se.api.get(`/leads?search=${l!.leadNo}&limit=1&offset=0`)).body.items?.[0];
    note('edit', `${r ? `${r.request().method()} → ${r.status()}` : 'no save request sent'} · ${n ? `${n.title}: ${n.text}` : 'no message'} · address now "${JSON.stringify(after?.addresses ?? '').slice(0, 120)}"`);
    expect.soft(r ? r.status() < 300 : false, `Edit saved (${n?.text ?? 'no save request'})`).toBeTruthy();
  });

  test(...tc('RSE-032'), async ({ se, matrix }) => {
    const l = savedLead();
    test.skip(!l, 'No lead from RSE-030');
    const leads = new LeadsPage(se.page);
    await leads.openRoute();
    await leads.find(l!.leadNo);
    const from = se.failed.length;
    const d = await leads.openLead(l!.leadNo);
    await d.waitOpen();
    await se.page.waitForTimeout(2000);
    const failed = [...new Set(se.failed.slice(from))];
    const panel = se.page.locator('section.crm-lead-detail-modal');
    const shown: string[] = [];
    for (const b of list('Lead Detail Activity Buttons')) if (await panel.getByRole('button', { name: b }).first().isVisible().catch(() => false)) shown.push(b);
    note('lead detail', `Tasks permission ${JSON.stringify(matrix.ACTIVITIES)} · activity buttons shown: ${shown.join(', ') || 'none'} · failed: ${failed.join(' | ') || 'none'}`);
    await se.page.screenshot({ path: test.info().outputPath('lead-detail.png') });
    expect.soft(failed, 'No request fails when the lead opens').toEqual([]);
    if (!can(matrix, 'ACTIVITIES', 'create')) expect.soft(shown, 'Activity buttons hidden without Tasks permission').toEqual([]);
  });

  test(...tc('RSE-033'), async ({ se }) => {
    const l = savedLead();
    test.skip(!l, 'No lead from RSE-030');
    const leads = new LeadsPage(se.page);
    await leads.openRoute();
    await leads.find(l!.leadNo);
    const d = await leads.openLead(l!.leadNo);
    await d.waitOpen();
    const status = (await se.api.get(`/leads?search=${l!.leadNo}&limit=1&offset=0`)).body.items?.[0]?.leadStatus?.code;
    if (status !== 'QUALIFIED') {
      const q = await d.qualify(checklistValues());
      note('qualify', `${q?.title ?? ''} · ${q?.text ?? ''}`);
    } else note('qualify', 'already qualified (an earlier run of this test)');
    const again = await leads.openLead(l!.leadNo);
    await again.waitOpen();
    const c = await again.convert(S('Convert Button'));
    note('convert', `${c?.title ?? ''} · ${c?.text ?? ''}`);
    const lead = (await se.api.get(`/leads?search=${l!.leadNo}&limit=1&offset=0`)).body.items?.[0];
    const opp = (await se.api.get(`/opportunities?search=${l!.leadNo}&limit=5&offset=0`)).body.items?.[0];
    note('after', `lead status ${lead?.leadStatus?.code} · opportunity ${opp?.opportunityNo ?? 'none'} owner ${ownerOf(opp)}`);
    expect.soft(lead?.leadStatus?.code, 'Lead converted').toBe('CONVERTED');
    expect(opp, 'Opportunity created').toBeTruthy();
    expect.soft(ownerOf(opp), 'Opportunity owned by the Sales Executive').toBe(await fullName(se));
  });

  // ── data visibility ──
  test(...tc('RSE-040'), async ({ se, admin }) => {
    const me = await fullName(se);
    const rows: string[] = [];
    let others = 0;
    for (const p of ['/leads', '/opportunities', '/reservations', '/proposals', '/customers']) {
      const a = (await admin.get(`${p}?limit=100&offset=0`)).body, s = (await se.api.get(`${p}?limit=100&offset=0`)).body;
      const owners: Record<string, number> = {};
      for (const i of s.items ?? []) { const o = ownerOf(i) ?? i.createdBy?.name ?? 'not shown'; owners[o] = (owners[o] ?? 0) + 1; }
      const notMine = Object.entries(owners).filter(([o]) => o !== me && o !== 'not shown').reduce((x, [, n]) => x + n, 0);
      others += notMine;
      rows.push(`${p}: user sees ${s.pagination?.total} of ${a.pagination?.total} · owners ${JSON.stringify(owners)}`);
    }
    note(`expected: ${S('Data Scope Expected')}`, rows.join(' | '));
    expect.soft(others, `Records owned by other people visible to the Sales Executive (${S('Data Scope Expected')} expected)`).toBe(0);
  });

  test(...tc('RSE-041'), async ({ se, matrix }) => {
    test.skip(!can(matrix, 'DASHBOARD', 'view'), 'Role cannot view the dashboards');
    const v = await visit(se, '/dashboards');
    const sum = (await se.api.get('/dashboard/summary?period=this_month&view=audience')).body;
    const leads = (await se.api.get('/leads?limit=1&offset=0')).body.pagination?.total;
    note('dashboards', `failed: ${v.failed.join(' | ') || 'none'} · total leads ${sum?.metrics?.totalLeads} vs leads the user sees ${leads}`);
    expect.soft(v.failed, 'No request fails').toEqual([]);
    expect.soft(sum?.metrics?.totalLeads, 'Dashboard total leads = leads the user sees').toBe(leads);
  });
});
