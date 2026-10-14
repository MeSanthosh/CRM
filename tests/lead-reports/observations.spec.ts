/**
 * Lead Reports workbook — "Observations" sheet. Each test checks the behaviour the observation asks for:
 *  - defects (the page should change) assert the expected behaviour, so they fail until fixed;
 *  - questions / info items record what the page does now (pass, with the finding in the report).
 */
import { test, expect, note } from '../pages/fixtures';
import { num } from '../helpers';
import { LEAD_FILTERS, BREAKDOWN_COLUMNS, SCORECARD_COLUMNS, toHours } from '../pages/LeadReportsPage';
import { DRILL_CAP } from '../pages/LeadDrill';
import { lrObs, OBSERVATIONS } from './catalog';
import { previousMonth, labelOf } from './shared';

const CHECKED = ['OBS-01', 'OBS-02', 'OBS-03', 'OBS-04', 'OBS-05', 'OBS-06', 'OBS-07', 'OBS-08', 'OBS-09', 'OBS-10', 'OBS-11', 'OBS-12', 'OBS-13'];

test.describe('Lead Reports · Observations', () => {
  test('LR-OBS-00 Every observation on the sheet has a check', { tag: '@lead-workbook' }, () => {
    expect(OBSERVATIONS.map(o => o.id).filter(id => !CHECKED.includes(id)), 'Observations without a check').toEqual([]);
  });

  test(...lrObs('OBS-01'), async ({ leadReports }) => {
    await leadReports.open();
    expect(await leadReports.period(), 'Default period').toBe('this_month');
  });

  test(...lrObs('OBS-02'), async ({ leadReports, page }) => {
    const [from, to] = previousMonth();
    await leadReports.open();
    await leadReports.setPeriod('custom');
    await leadReports.fromInput.fill(to);
    await leadReports.toInput.fill(from);
    await expect(page.locator('main').getByText(/before|after|invalid|must be|cannot be/i).first(), 'Validation message').toBeVisible({ timeout: 5000 });
  });

  test(...lrObs('OBS-03'), async ({ leadReports, page }) => {
    await leadReports.openWith('last_12_months');
    await leadReports.drill.openFrom(leadReports.cardLinks('SPA Signed').first());
    await page.keyboard.press('Escape');
    await expect(leadReports.drill.root, 'Esc closes the list').toHaveCount(0, { timeout: 3000 });
  });

  test(...lrObs('OBS-04'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const links = await leadReports.byRating.table.locator('tbody button, tbody a').count() + await leadReports.byScore.table.locator('tbody button, tbody a').count();
    note('finding', links ? `Rating / Score tables now have ${links} links` : 'Rating and Score counts are still not links (question open)');
    await leadReports.openTab('Source & Channel');
    const headers = await leadReports.breakdown.headers();
    const lost = (await leadReports.breakdown.rows()).find(r => num(r['Lost']) > 0);
    if (lost) await expect(leadReports.breakdown.link(lost, 'Lost', headers), 'Lost counts above 0 are links').toHaveCount(1);
  });

  test(...lrObs('OBS-05'), async ({ leadReports, page }) => {
    await leadReports.open();
    await leadReports.setFilter(LEAD_FILTERS['Lead Source'], (await leadReports.filterOptions(LEAD_FILTERS['Lead Source']))[0]);
    const url = page.url();
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    const kept = await leadReports.filterSelect(LEAD_FILTERS['Lead Source']).inputValue();
    note('finding', `URL after filtering: ${url.replace(/^https?:\/\/[^/]+/, '')} | filter after reload: ${kept ? 'kept' : 'reset'}`);
  });

  test(...lrObs('OBS-06'), async ({ leadReports }) => {
    await leadReports.open();
    const names = await leadReports.filterOptions(LEAD_FILTERS['Salesperson']);
    expect(names.filter((v, i, a) => a.indexOf(v) !== i), 'Salesperson names that appear more than once').toEqual([]);
  });

  test(...lrObs('OBS-07'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const link = leadReports.cardLinks('Leads Captured').first();
    const count = num(await link.innerText());
    test.skip(count <= DRILL_CAP, `Leads Captured (${count}) is not above ${DRILL_CAP}`);
    const d = await leadReports.drill.openFrom(link);
    const sheet = await leadReports.drill.export();
    note('finding', `${d.countLine}: ${d.rows.length} rows on screen, ${sheet.rows.length} in the export`);
    expect(sheet.rows.length, 'Export contains every lead').toBe(count);
  });

  test(...lrObs('OBS-08'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const breakdown = await leadReports.breakdown.export();
    await leadReports.openTab('Salesperson Scorecard');
    const scorecard = await leadReports.scorecard.export();
    const diff = (screen: string[], file: string[]) => `only on screen: ${screen.filter(h => !file.includes(h)).join(', ') || '—'}; only in file: ${file.filter(h => !screen.includes(h)).join(', ') || '—'}`;
    note('breakdown export', `${diff(['Lead Source', ...BREAKDOWN_COLUMNS], breakdown.header)}; Total row: ${breakdown.total ? 'yes' : 'no'}`);
    note('scorecard export', diff(SCORECARD_COLUMNS, scorecard.header));
  });

  test(...lrObs('OBS-09'), async ({ leadReports }) => {
    await leadReports.openAt('qualification', 'last_12_months');
    const mixed: string[] = [];
    for (const t of [leadReports.byRating, leadReports.byScore]) {
      for (const r of await t.rows()) {
        const v = r['Avg First Contact'];
        if ((/h$/.test(v) && toHours(v) >= 24) || (/d$/.test(v) && toHours(v) < 24)) mixed.push(`${labelOf(r)}: ${v}`);
      }
    }
    expect(mixed, 'Values in an unexpected unit (≥ 24 h shown in hours, < 1 d in days)').toEqual([]);
  });

  test(...lrObs('OBS-10'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const src = (await leadReports.dataCompleteness()).find(r => r.label === 'Lead source recorded');
    note('finding', src ? `Lead source recorded ${src.filled} / ${src.total} (${src.percent}%) — ${src.total - src.filled} leads Unspecified` : 'row not found');
    expect(src, 'Data Completeness row present').toBeTruthy();
  });

  test(...lrObs('OBS-11'), async ({ leadReports, page }) => {
    await leadReports.openAt('aging');
    await leadReports.openTab('Salesperson Scorecard');
    await page.goBack();
    await page.waitForLoadState('networkidle').catch(() => {});
    note('finding', `Back from Scorecard → "${await leadReports.activeTab()}" (${page.url().replace(/^https?:\/\/[^/]+/, '')})`);
  });

  test(...lrObs('OBS-12'), async ({ leadReports }) => {
    await leadReports.openAt('source', 'last_12_months');
    const before = (await leadReports.breakdown.rows()).map(labelOf);
    await leadReports.breakdown.table.locator('thead th').nth(1).click();
    await leadReports.page.waitForTimeout(500);
    const after = (await leadReports.breakdown.rows()).map(labelOf);
    note('finding', JSON.stringify(after) === JSON.stringify(before) ? 'Headers still do not sort' : 'Clicking a header now reorders the rows');
  });

  test(...lrObs('OBS-13'), async ({ leadReports }) => {
    await leadReports.openWith('last_12_months');
    const d = await leadReports.drill.openFrom(leadReports.funnelLink('Contacted'));
    const noDate = d.rows.filter(r => /^[—–-]?$/.test(r['First Contact'].trim()));
    note('finding', `${noDate.length} of ${d.rows.length} contacted leads show no First Contact date`);
    expect(noDate.map(r => `${r.LeadNo} (${r['Status']})`).slice(0, 10), 'Contacted leads without a First Contact date').toEqual([]);
  });
});
