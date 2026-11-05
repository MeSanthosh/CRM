/** HLUC-03 Validate Lead Counts — tab, card and list counts (LP-061 … LP-075). */
import { test, expect, note, sharedLead, acquireLeadsLock, releaseLeadsLock } from './shared';
import { lp } from './catalog';
import { tabRule } from './test-data';
import { LEADS_TABS } from '../locators';

test.describe('Leads page · Lead counts', () => {
  test.describe.configure({ timeout: 600_000 }); // includes waiting for the leads lock
  // counts are read at several moments; no other worker may create a lead in between
  test.beforeEach(async () => { await acquireLeadsLock(); });
  test.afterEach(() => releaseLeadsLock());

  LEADS_TABS.forEach((tab, i) => {
    test(...lp(`LP-0${61 + i}`), async ({ leads }) => {
      const rule = tabRule(tab);
      await leads.openRoute(rule.route);
      expect.soft(await leads.description(), 'Tab opened').toMatch(new RegExp(`^${rule.description}`));
      const badge = await leads.tabCount(tab);
      const card = await leads.card('Total Leads');
      const listed = await leads.listed();
      note('tab / card / listed', `${badge} / ${card} / ${listed}`);
      expect.soft(card, 'TOTAL LEADS card = tab count').toBe(badge);
      expect(listed, 'Leads listed = tab count').toBe(badge);
    });
  });

  test(...lp('LP-066'), async ({ leads }) => {
    await leads.openRoute(tabRule('My Leads').route);
    const me = await leads.signedInUser();
    const owners: string[] = [];
    for (let i = 0; i < 2; i++) {
      await leads.sortBy('Assigned');
      owners.push((await leads.rows())[0]?.assigned ?? '');
    }
    note('signed-in user / first owner A→Z, Z→A', `${me} / ${owners.join(' / ')}`);
    expect(owners, 'Every lead on My Leads belongs to the signed-in user').toEqual([me, me]);
  });

  test(...lp('LP-067'), async ({ leads }) => {
    await leads.openRoute(tabRule('Unassigned').route);
    const total = await leads.listed();
    test.skip(total === 0, 'No unassigned leads right now');
    const owners: string[] = [];
    for (let i = 0; i < 2; i++) {
      await leads.sortBy('Assigned');
      owners.push((await leads.rows())[0]?.assigned ?? '');
    }
    note('owners (first row A→Z, Z→A)', owners.join(' / '));
    for (const o of owners) expect.soft(o, 'Owner of a lead on Unassigned').toMatch(/^(-|—|Unassigned)?$/i);
  });

  for (const [id, tab] of [['LP-068', 'To Qualify'], ['LP-069', 'Ready to Convert']] as const) {
    test(...lp(id), async ({ leads }) => {
      const rule = tabRule(tab);
      await leads.openRoute(rule.route);
      const total = await leads.tabCount(tab);
      const found: Record<string, number> = {};
      for (const s of await leads.statusOptions()) {
        await leads.filterStatus(s);
        const n = await leads.listed();
        if (n) found[s] = n;
      }
      note('leads per status', Object.entries(found).map(([s, n]) => `${s} ${n}`).join(', '));
      const unexpected = Object.keys(found).filter(s => !rule.statuses.includes(s));
      expect.soft(unexpected, `Statuses that should not be on "${tab}" (allowed: ${rule.statuses.join(', ')})`).toEqual([]);
      expect(Object.values(found).reduce((a, b) => a + b, 0), 'Status counts add up to the tab count').toBe(total);
    });
  }

  // Since build v2.0 the ASSIGNED card counts leads with an owner: its own formula line says "Total (N) − Unassigned (M)"
  test(...lp('LP-070'), async ({ leads }) => {
    await leads.openRoute();
    const value = await leads.card('Assigned');
    const total = await leads.card('Total Leads');
    const unassigned = await leads.tabCount('Unassigned');
    const formula = await leads.cardFormula('Assigned');
    const totalFormula = await leads.cardFormula('Total Leads');
    await leads.clickCard('Assigned');
    const byCard = await leads.listed();
    const statuses = [...new Set((await leads.rows()).map(r => r.status))];
    note('ASSIGNED card / its formula', `${value} / "${formula}"`);
    note('TOTAL LEADS card / its formula', `${total} / "${totalFormula}"`);
    note('Unassigned tab / leads listed after clicking ASSIGNED / statuses shown', `${unassigned} / ${byCard} / ${statuses.join(', ')}`);
    const nums = (s: string) => [...s.matchAll(/\((\d+)\)/g)].map(m => Number(m[1]));
    const [fTotal, fUnassigned] = nums(formula);
    expect.soft(fTotal, 'ASSIGNED formula: "Total (N)" = TOTAL LEADS card').toBe(total);
    expect.soft(fUnassigned, 'ASSIGNED formula: "Unassigned (M)" = Unassigned tab').toBe(unassigned);
    expect.soft(value, `ASSIGNED card = its own formula Total (${total}) − Unassigned (${unassigned}) = ${total - unassigned}`).toBe(total - unassigned);
    const parts = nums(totalFormula);
    expect.soft(parts.reduce((a, b) => a + b, 0), `TOTAL LEADS formula "${totalFormula}" adds up to the TOTAL LEADS card (${total})`).toBe(total);
    expect(byCard, 'Leads listed after clicking ASSIGNED = ASSIGNED card').toBe(value);
  });

  for (const [id, card] of [['LP-071', 'Qualified'], ['LP-072', 'Disqualified']] as const) {
    test(...lp(id), async ({ leads }) => {
      await leads.openRoute();
      const value = await leads.card(card);
      await leads.filterStatus(card);
      const byStatus = await leads.listed();
      await leads.filterStatus(null);
      await leads.clickCard(card);
      const byCard = await leads.listed();
      const statuses = [...new Set((await leads.rows()).map(r => r.status))];
      note('card / status filter / after card click / statuses shown', `${value} / ${byStatus} / ${byCard} / ${statuses.join(', ')}`);
      expect.soft(byStatus, `Leads with status ${card} = ${card.toUpperCase()} card`).toBe(value);
      expect.soft(byCard, `Leads shown after clicking the card = ${card.toUpperCase()} card`).toBe(value);
      expect(statuses.filter(s => s !== card), `Rows shown after clicking ${card.toUpperCase()}`).toEqual([]);
    });
  }

  test(...lp('LP-073'), async ({ leads }) => {
    await leads.openRoute();
    const total = await leads.card('Total Leads');
    await leads.clickCard('Assigned');
    await leads.clickCard('Total Leads');
    expect(await leads.listed(), 'Leads listed after clicking TOTAL LEADS').toBe(total);
  });

  test(...lp('LP-074'), async ({ leads }) => {
    await leads.openRoute();
    const total = await leads.card('Total Leads');
    const per: string[] = [];
    let statusSum = 0;
    for (const s of await leads.statusOptions()) {
      await leads.filterStatus(s);
      const n = await leads.listed();
      statusSum += n;
      if (n) per.push(`${s} ${n}`);
    }
    await leads.filterStatus(null);
    const types: Record<string, number> = {};
    for (const t of ['Individual', 'Corporate'] as const) {
      await leads.typeChip(t);
      types[t] = await leads.listed();
    }
    note('total / statuses / types', `${total} / ${per.join(', ')} / Individual ${types.Individual}, Corporate ${types.Corporate}`);
    expect.soft(statusSum, 'Sum of all status counts = TOTAL LEADS').toBe(total);
    expect(types.Individual + types.Corporate, 'Individual + Corporate = TOTAL LEADS').toBe(total);
  });

  test(...lp('LP-075'), async ({ leads }) => {
    const { lead } = await sharedLead(leads, 'Individual'); // the run's own lead, no extra record
    await leads.openRoute();
    await leads.search(lead.email);
    const listed = await leads.listed();
    const total = await leads.card('Total Leads');
    const rows = await leads.rows();
    note('after search: card / listed / status', `${total} / ${listed} / ${rows[0]?.status}`);
    expect.soft(listed, 'Leads listed after searching one email').toBe(1);
    expect.soft(total, 'TOTAL LEADS card after the search').toBe(1);
    if (rows[0]) expect(await leads.card(rows[0].status), `${rows[0].status.toUpperCase()} card after the search`).toBe(1);
  });
});
