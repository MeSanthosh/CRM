/** PII Data Protection & Field Masking (SEC-061 … SEC-065). */
import { test, expect, note, sc, scRow, signIn, fragments } from './shared';
import { setting, roleMasking, maskingChecks, userIdForRole, noAccess, moduleRoutes, rolePermissions } from './test-data';
import { readTable, AuditLogPage } from '../pages/SecurityPages';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadDetail } from '../pages/LeadDetail';
import type { Page } from '@playwright/test';

const MASK = () => setting('Mask Character');

/** Values of the masking checks for one page: { column/kind → first rows' values }. */
async function valuesOn(page: Page, pageName: string) {
  const checks = maskingChecks().filter(c => c.page === pageName);
  await page.goto(checks[0].route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('main table tbody tr').first().waitFor({ timeout: 15_000 }).catch(() => {}); // rows render after the KPIs
  const rows = (await readTable(page.locator('main table').first())).slice(0, 5);
  const out: { label: string; values: string[] }[] = [];
  for (const c of checks) {
    const vals = rows.map(r => {
      const lines = (r[c.column] ?? '').split('\n').map(s => s.trim()).filter(Boolean);
      if (c.kind === 'email') return lines.find(l => l.includes('@')) ?? '';
      if (c.kind === 'phone') return lines.find(l => /^\+?[\d\s•]+$/.test(l)) ?? '';
      return lines[0] ?? '';
    }).filter(Boolean);
    out.push({ label: `${c.column} (${c.kind})`, values: vals });
  }
  return out;
}

test.describe('Security · PII masking', () => {
  test.describe.configure({ timeout: 600_000 });

  for (const [id, pageName] of [['SEC-061', 'Leads'], ['SEC-062', 'Customers']] as const) {
    roleMasking().forEach((rm, i) => {
      test(...scRow(id, i + 1, rm.role, `${pageName}: ${rm.masked ? 'names, phones and emails partly hidden' : 'full names, phones and emails'} for ${rm.role}`, `${rm.role} · ${rm.note}`), async ({ sec, browser, baseURL }) => {
        const s = await signIn(browser, baseURL!, await sec.makeUser(userIdForRole(rm.role)));
        const seen = await valuesOn(s.page, pageName);
        // the test role holds only the permissions of its Base matrix: a page without View must show no records
        const route = maskingChecks().find(c => c.page === pageName)!.route;
        const perm = moduleRoutes().find(m => m.route === route)?.permission;
        if (rm.role === setting('Test Role Name') && perm && !(rolePermissions('Base')[perm] ?? []).includes('View')) {
          note('records shown', String(Math.max(...seen.map(f => f.values.length))));
          expect(seen.every(f => f.values.length === 0), `${pageName}: no records without View permission`).toBeTruthy();
          await s.close();
          return;
        }
        test.skip(seen.every(f => f.values.length === 0) && noAccess().test(await s.page.locator('main').innerText()), `${rm.role} has no access to ${pageName}`);
        for (const f of seen) {
          note(f.label, f.values.join(' | '));
          expect.soft(f.values.length, `${f.label}: values shown`).toBeGreaterThan(0);
          for (const v of f.values) expect.soft(v.includes(MASK()), `${f.label} "${v}" ${rm.masked ? 'masked' : 'not masked'}`).toBe(rm.masked);
        }
        await s.close();
      });
    });
  }

  test(...sc('SEC-063'), async ({ sec, browser, baseURL }) => {
    const leads = new LeadsPage(sec.admin);
    await leads.openRoute();
    const full = (await leads.rows())[0];
    const s = await signIn(browser, baseURL!, await sec.makeUser(userIdForRole(roleMasking().find(r => r.masked)!.role)));
    const theirs = new LeadsPage(s.page);
    await theirs.openRoute();
    await theirs.search(full.leadNo);
    const masked = (await theirs.rows())[0];
    note('admin / masked', `${full.name} ${full.phone} ${full.email} / ${masked?.name} ${masked?.phone} ${masked?.email}`);
    expect(masked?.leadNo, 'Same lead').toBe(full.leadNo);
    const keeps = (m: string, f: string) => { let at = 0; const flat = f.replace(/\s/g, ''); return fragments(m.replace(/\s/g, ''), MASK()).every(p => { const k = flat.indexOf(p, at); if (k < 0) return false; at = k + p.length; return true; }); };
    expect.soft(keeps(masked.name.replace(/ /g, MASK()), full.name), 'Name keeps the visible letters').toBeTruthy();
    expect.soft(keeps(masked.phone, full.phone), 'Phone keeps the visible digits').toBeTruthy();
    expect(keeps(masked.email, full.email), 'Email keeps the visible characters').toBeTruthy();
    await s.close();
  });

  test(...sc('SEC-064'), async ({ sec, browser, baseURL }) => {
    const s = await signIn(browser, baseURL!, await sec.makeUser(userIdForRole(roleMasking().find(r => r.masked)!.role)));
    const leads = new LeadsPage(s.page);
    await leads.openRoute();
    await s.page.locator('main tbody a.crm-record-link').first().click();
    const d = new LeadDetail(s.page);
    await d.waitOpen();
    const shown = { name: await d.headerName(), phone: await d.value('Phone'), email: await d.value('Email') };
    note('lead detail', JSON.stringify(shown));
    for (const [k, v] of Object.entries(shown)) expect.soft(v.includes(MASK()), `${k} "${v}" masked`).toBeTruthy();
    await s.close();
  });

  test(...sc('SEC-065'), async ({ sec }) => {
    const audit = new AuditLogPage(sec.admin, setting('Audit Route'));
    await audit.open('Login activity');
    const ids = (await audit.rows()).map(r => r['Login ID']).filter(v => v && v !== '-').slice(0, 15);
    note('login IDs', ids.join(' | '));
    const visible = Number(setting('Login ID Visible Characters'));
    expect(ids.length, 'Login IDs listed').toBeGreaterThan(0);
    for (const v of ids) {
      expect.soft(v.includes(MASK()), `"${v}" masked`).toBeTruthy();
      expect.soft(v.indexOf(MASK()), `"${v}" shows ${visible} characters`).toBe(visible);
    }
  });
});
