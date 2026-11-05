/**
 * HLUC-04 Leads list & form layout — parts added by the redesign of build CAITer8U (LP-081 … LP-089):
 * paging and S.No., row selection and its bar, the AVG SCORE / QUALIFIED / DISQUALIFIED formula lines,
 * the Duplicates & Merge and Insights tabs, the address blocks of the create forms, and the pencil Edit button.
 * Nothing here saves a lead: selection is cleared without a bulk action, forms are closed and discarded.
 */
import { test, expect, note, withLeadsLock } from './shared';
import { lp } from './catalog';
import { setting, addressData, actionValue, type Form } from './test-data';
import { LeadForm } from '../pages/LeadForm';
import { XP, at } from '../locators';

const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
const range = (pager: string) => {
  const m = pager.match(/Showing (\d+)\s*[–-]\s*(\d+) of (\d+)/);
  return m ? { from: +m[1], to: +m[2], total: +m[3] } : undefined;
};

test.describe('Leads page · List & form layout', () => {
  test.describe.configure({ timeout: 600_000 }); // includes waiting for the leads lock

  test(...lp('LP-081'), async ({ leads }) => {
    const size = Number(setting('Page Size'));
    // no lead may be created while the pages are read, or the numbering shifts
    await withLeadsLock(async () => {
      await leads.openRoute();
      const total = await leads.card('Total Leads');
      const serials: number[] = [];
      const seen: string[] = [];
      const pagers: string[] = [];
      const covered: string[] = [];
      for (let p = 1; p <= 50; p++) {
        const rows = await leads.rows();
        const pager = await leads.pagerText();
        const r = range(pager);
        pagers.push(pager.replace(/ Previous Next$/, ''));
        expect.soft(r, `Page ${p}: pager reads "Showing a–b of N" (${pager})`).toBeTruthy();
        if (r) expect.soft(rows.length, `Page ${p}: rows = pager range ${r.from}–${r.to}`).toBe(r.to - r.from + 1);
        expect.soft(rows.length, `Page ${p}: at most ${size} leads`).toBeLessThanOrEqual(size);
        serials.push(...await leads.serialNumbers());
        seen.push(...rows.map(x => x.leadNo));
        const turned = await leads.turnPage('Next');
        if (leads.coveredBy) covered.push(`page ${p}: ${leads.coveredBy}`);
        if (!turned) break;
      }
      note('pages', pagers.join(' | '));
      if (covered.length) note('Next button covered by', covered.join('; '));
      expect.soft(covered, 'Next button is not covered by anything (a user can click it)').toEqual([]);
      note('S.No. read', `${serials.length} rows: ${serials[0]} … ${serials[serials.length - 1]}`);
      expect.soft(serials, 'S.No. runs 1 … N across the pages').toEqual(Array.from({ length: serials.length }, (_, i) => i + 1));
      expect.soft(new Set(seen).size, 'No lead shown on two pages').toBe(seen.length);
      expect.soft(seen.length, 'Rows over all pages = TOTAL LEADS card').toBe(total);
      expect.soft(await leads.pagerButtonDisabled('Next'), 'Next is disabled on the last page').toBeTruthy();
      if (pagers.length > 1) {
        await leads.turnPage('Previous');
        expect(range(await leads.pagerText())?.from, 'Previous goes back one page').toBe(range(pagers[pagers.length - 2])?.from);
      }
    });
  });

  test(...lp('LP-082'), async ({ leads }) => {
    await leads.openRoute();
    const rows = await leads.rows();
    await leads.select('all');
    const selected = await leads.selectedLeads();
    const bar = await leads.bulkBar();
    note('selection bar', bar);
    expect.soft(selected, 'Every row of the page is ticked').toEqual(rows.map(r => r.leadNo));
    expect.soft(bar, `Bar reads "${rows.length} selected"`).toMatch(new RegExp(`^${rows.length} selected\\b`));
    for (const b of list(setting('Selection Bar Buttons'))) expect.soft(bar, `Bar button "${b}"`).toContain(b);
    await leads.bulkButton('Clear selection');
    expect.soft(await leads.selectedLeads(), 'Clear selection unticks every row').toEqual([]);
    expect(await leads.bulkBar(), 'Bar hidden after Clear selection').toBe('');
  });

  test(...lp('LP-083'), async ({ leads }) => {
    await leads.openRoute();
    const [a, b] = (await leads.rows()).map(r => r.leadNo);
    test.skip(!b, 'Fewer than two leads on the list');
    await leads.select(a);
    await leads.select(b);
    const two = await leads.bulkBar();
    expect.soft(two, 'Two ticked').toMatch(/^2 selected\b/);
    expect.soft(await leads.selectedLeads(), 'Only the ticked leads are selected').toEqual([a, b]);
    await leads.select(a, false);
    const one = await leads.bulkBar();
    expect.soft(one, 'One left').toMatch(/^1 selected\b/);
    expect.soft(await leads.selectedLeads(), 'Only the other lead stays ticked').toEqual([b]);
    await leads.select(b, false);
    note('bar after 2 / 1 / 0 ticks', `${two} | ${one} | ${await leads.bulkBar() || '(hidden)'}`);
    expect(await leads.bulkBar(), 'Bar hidden with nothing ticked').toBe('');
  });

  test(...lp('LP-084'), async ({ leads }) => {
    await withLeadsLock(async () => {
      await leads.openRoute();
      const avg = await leads.card('Avg Score');
      const total = await leads.card('Total Leads');
      const formula = await leads.cardFormula('Avg Score');
      let sum = 0, counted = 0;
      const unscored: string[] = [];
      for (let p = 1; p <= 50; p++) {
        for (const r of await leads.rows()) {
          counted++;
          if (/^\d+$/.test(r.score)) sum += Number(r.score); else unscored.push(`${r.leadNo} "${r.score}"`);
        }
        if (!(await leads.turnPage('Next'))) break;
      }
      const nums = [...formula.matchAll(/\((\d+)\)/g)].map(m => Number(m[1]));
      note('AVG SCORE / its formula', `${avg} / "${formula}"`);
      note('Score column', `sum ${sum} over ${counted} leads${unscored.length ? `; no score: ${unscored.join(', ')}` : ''}`);
      expect.soft(nums[1], `Formula "Total (T)" = TOTAL LEADS card (${total})`).toBe(total);
      expect.soft(nums[0], 'Formula "Σ Score (S)" = sum of the Score column over all pages').toBe(sum);
      expect(avg, `AVG SCORE = ${sum} ÷ ${total}, rounded`).toBe(Math.round(sum / total));
    });
  });

  test(...lp('LP-085'), async ({ leads }) => {
    await leads.openRoute();
    const total = await leads.card('Total Leads');
    for (const card of ['Qualified', 'Disqualified']) {
      const value = await leads.card(card);
      const formula = await leads.cardFormula(card);
      note(`${card.toUpperCase()} card / formula`, `${value} / "${formula}"`);
      const m = formula.match(/\((\d+) of (\d+)\)/);
      expect.soft(m, `${card.toUpperCase()} formula reads "Status = ${card.toUpperCase()} (N of T)"`).toBeTruthy();
      if (!m) continue;
      expect.soft(Number(m[1]), `${card.toUpperCase()} formula N = the card`).toBe(value);
      expect.soft(Number(m[2]), `${card.toUpperCase()} formula T = TOTAL LEADS card`).toBe(total);
    }
  });

  test(...lp('LP-086'), async ({ leads }) => {
    const watched = leads.watchErrors();
    await leads.openRoute();
    const tabs = await leads.tabLabels();
    note('tabs', tabs.join(' | '));
    expect.soft(tabs, 'Tabs of the Leads page, in order').toEqual(list(setting('Leads Tabs')));
    for (const [tab, route] of [['Duplicates & Merge', setting('Duplicates Route')], ['Insights', setting('Insights Route')]]) {
      await leads.openRoute();
      await at(leads.page, XP.leadsTabLink(tab)).click();
      await leads.page.waitForLoadState('networkidle').catch(() => {});
      await expect.soft(leads.page, `${tab} opens ${route}`).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(\\?.*)?$`));
      const text = (await leads.page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect.soft(text, `${tab} page loads without an error message`).not.toMatch(/something went wrong|failed to load|not found|access denied/i);
    }
    note('errors seen', JSON.stringify(watched));
    expect.soft(watched.errors, 'No script error on the two pages').toEqual([]);
    expect(watched.failed, 'No failed API call on the two pages').toEqual([]);
  });

  for (const [id, form] of [['LP-087', 'Individual'], ['LP-088', 'Corporate']] as const) {
    test(...lp(id), async ({ leads }) => {
      const a = addressData(form as Form);
      const f = new LeadForm(leads.page, form as Form);
      await f.open();
      note('address typed', `${a['First Block']}: ${a['Address Line 1']}, ${a['Address Line 2']}, ${a['City']}, ${a['Country']}, ${a['Postal Code']}`);
      const parts = ['Address Line 1', 'Address Line 2', 'City', 'Country', 'Postal Code'];
      for (const p of parts) await f.set(`Address 1 ${p}`, a[p], { leave: false });
      await at(leads.page, XP.leadFormButton(a['Copy Button'])).click();
      for (const p of parts) {
        const el = f.control(`Address 2 ${p}`);
        const shown = p === 'Country'
          ? await el.evaluate(s => (s as HTMLSelectElement).selectedOptions[0]?.text.trim() ?? '')
          : await el.inputValue();
        expect.soft(shown, `${a['Second Block']} ${p} after "${a['Copy Button']}"`).toBe(a[p]);
      }
      const asked = await f.close(actionValue('Close Form', 'Confirm Button'));
      note('pop-up on Close', asked?.text ?? 'none');
      await expect(leads.page, 'Back on the Leads list, nothing saved').toHaveURL(/\/leads(\?.*)?$/);
    });
  }

  // read-only: any Individual lead on the list, compared with its own row (no lead is created for this)
  test(...lp('LP-089'), async ({ leads }) => {
    await leads.openRoute();
    await leads.typeChip('Individual');
    const row = (await leads.rows())[0];
    test.skip(!row, 'No Individual lead on the list');
    note('lead opened for edit', `${row.leadNo} · ${row.name} · ${row.phone} · ${row.email}`);
    const f = await leads.editLead(row.leadNo, 'Individual');
    if (leads.coveredBy) note('pencil button covered by', leads.coveredBy);
    expect.soft(leads.coveredBy, 'Pencil button is not covered by anything (a user can click it)').toBe('');
    note('edit form', `${leads.page.url()} · ${await f.heading().catch(() => '')}`);
    const value = async (label: string) => (await f.control(label).inputValue()).trim();
    const first = await value('First Name'), last = await value('Last Name');
    expect.soft(`${first} ${last}`.trim(), 'Edit form First + Last Name = the name on the list').toBe(row.name);
    expect.soft((await value('Mobile')).replace(/\s/g, ''), 'Edit form Mobile = the list').toBe(row.phone.replace(/\s/g, ''));
    expect.soft(await value('Email'), 'Edit form Email = the list').toBe(row.email);
    const asked = await f.close(actionValue('Close Form', 'Confirm Button'));
    note('pop-up on Close', asked?.text ?? 'none (nothing changed)');
    await leads.openRoute();
    const after = await leads.find(row.leadNo);
    expect(after.map(r => `${r.leadNo} ${r.name} ${r.email}`), 'Lead unchanged after closing the edit form').toEqual([`${row.leadNo} ${row.name} ${row.email}`]);
  });
});
