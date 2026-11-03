/**
 * SPA / Sales Contracts page (SPC-001 … SPC-041). One worker, in this order: register & counts, New Contract,
 * then the life of one contract (issue → payment plan → KYC → sign → ERP), then replace / cancel on a second deal.
 */
import { test, expect, spc, spcRow, note, DATA, S, acceptedDeal, contractRows, cards, cardsAfter, expectedCard, expectChanges, contractNo, openContract, contractAction, newContract, CON } from './shared';
import { ModalForm, ModulePage, RecordPanel } from '../pages/SalesPages';
import { withSalesLock, findUnit } from '../sales-chain/inventory';
import { DealChain } from '../sales-chain/deal';
import { fill, runOnce, runValue } from '../sales-chain/data';
import { parseNum } from '../helpers';
import { pickDate } from '../pages/Notice';
import { relativeDate } from '../leads-page/test-data';

const F = () => DATA.fieldNames();
const stages = () => DATA.sheet('Workflow Stages').map(r => r['Stage']);
const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
const lines = (t: string) => t.split('\n').map(s => s.trim()).filter(Boolean);

test.describe('Contracts · Register & counts', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...spc('SPC-001'), async ({ contracts }) => {
    await contracts.open();
    const title = await contracts.title();
    note('title', title);
    expect.soft(title, 'Page title').toContain(S('Page Title'));
    for (const c of DATA.cardRules()) note(`card ${c.card}`, await contracts.kpiText(c.card));
    expect.soft(await contracts.headers(), 'Register columns').toEqual(DATA.sheet('Register Columns').map(r => r['Column']));
    for (const b of [S('New Contract Button'), S('Export Button')]) expect.soft(await contracts.page.locator('main').getByRole('button', { name: b, exact: true }).count(), `${b} button`).toBeGreaterThan(0);
  });

  for (const [id, card] of [['SPC-002', 'Total'], ['SPC-003', 'Draft / Issued'], ['SPC-004', 'Signed'], ['SPC-005', 'Value']] as const) {
    test(...spc(id), async ({ contracts }) => {
      const shown = (await cards(contracts))[card];
      const rows = await contractRows(contracts);
      const want = expectedCard(card, rows);
      const rule = DATA.cardRules().find(c => c.card === card)!;
      note(`${card}: card / register`, `${shown} / ${want} (statuses: ${rule.statuses.join(', ') || 'all'}; register: ${[...new Set(rows.map(r => r.status))].map(s => `${s} ${rows.filter(r => r.status === s).length}`).join(', ')})`);
      if (/sum/i.test(rule.measure)) expect(Math.abs(shown - want), `${card} = ${rule.measure} of ${rule.statuses.join(', ')} (difference)`).toBeLessThanOrEqual(Math.max(want * Number(S('Value Tolerance %')) / 100, 0.01e6 * rows.length));
      else expect(shown, `${card} = contracts with status ${rule.statuses.join(', ') || 'any'}`).toBe(want);
    });
  }

  test(...spc('SPC-007'), async ({ contracts }) => {
    const rows = await contractRows(contracts);
    await contracts.open();
    const file = await contracts.export(S('Export Button'));
    const cells = new Set(file.rows.flatMap(r => Object.values(r)));
    note('export', `${file.name}: ${file.rows.length} rows; register ${rows.length}`);
    expect.soft(file.rows.length, 'Rows in the export = contracts in the register').toBe(rows.length);
    expect(rows.map(r => r.number).filter(n => !cells.has(n)), 'Every contract number is in the export').toEqual([]);
  });
});

test.describe('Contracts · New Contract', () => {
  test.describe.configure({ timeout: 1_200_000 });

  test(...spc('SPC-011'), async ({ contracts, page }) => {
    await contracts.open();
    const form = new ModalForm(page);
    await form.open(S('New Contract Button'));
    const text = await form.text();
    note('form', text.slice(0, 300));
    expect.soft(text, 'Form note').toContain(S('Form Note'));
    for (const f of DATA.sheet('Form Fields')) {
      expect.soft(await form.field(f['Field Name']).count(), `Field "${f['Field Label']}"`).toBeGreaterThan(0);
      expect.soft(text, `Label "${f['Field Label']}"`).toContain(f['Field Label']);
    }
    await form.close();
  });

  test(...spc('SPC-013'), async ({ contracts, page }) => {
    await contracts.open();
    const form = new ModalForm(page);
    await form.open(S('New Contract Button'));
    const r = await form.submit(S('Create Contract Button'));
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.title, 'Pop-up title').toBe(DATA.message('Reservation Required Title'));
    expect.soft(r.notice?.text ?? '', 'Pop-up text').toContain(DATA.message('Reservation Required Body'));
    expect(r.closed, 'Nothing created (form open)').toBeFalsy();
    await form.closeNotice();
    await form.close();
  });

  test(...spc('SPC-012'), async ({ contracts, page, chain }) => {
    const d = await acceptedDeal(chain, 0);
    const taken = (await contractRows(contracts)).filter(r => ![S('Superseded Status'), S('Cancelled Status')].includes(r.status)).map(r => r.reservation);
    await contracts.open();
    const form = new ModalForm(page);
    await form.open(S('New Contract Button'));
    const opts = await form.options(F()['Approved Reservation']);
    note('reservations offered / with a live contract', `${opts.join(' | ')} / ${taken.join(', ')}`);
    expect.soft(opts.some(o => o.includes(d.reservation!)), `${d.reservation} (approved, no contract) offered`).toBeTruthy();
    expect(opts.filter(o => taken.some(t => o.includes(t))), 'Reservations that already have a contract are not offered').toEqual([]);
    await form.close();
  });

  test(...spc('SPC-014'), async ({ contracts, page, chain }) => {
    const d = await acceptedDeal(chain, 0);
    await contracts.open();
    const form = new ModalForm(page);
    await form.open(S('New Contract Button'));
    await form.set(F()['Approved Reservation'], `~${d.reservation}`);
    await page.waitForTimeout(1500);
    const value = await form.value(F()['Contract Value']);
    const currency = await form.selected(F()['Currency']);
    note('Contract Value / Currency after choosing the reservation', `"${value}" / "${currency}" (accepted price ${d.unit!.price})`);
    expect.soft(/\d/.test(value) ? parseNum(value) : NaN, 'Contract Value = accepted proposal price').toBe(d.unit!.price);
    expect(currency, 'Currency = deal currency').toBe(S('Expected Default Currency'));
    await form.close();
  });

  DATA.sheet('Invalid Values').forEach((v, i) => {
    test(...spcRow('SPC-015', i + 1, v['Why it is wrong'], v['Expected'], `Contract Value "${v['Contract Value']}"`), async ({ contracts, chain }) => {
      const d = await acceptedDeal(chain, 1);
      const { result, number } = await newContract(contracts, d, v['Contract Value']);
      if (number) {
        const row = (await contractRows(contracts)).find(r => r.number === number);
        note('saved anyway', `${number} · ${row?.status} · value ${row?.row.cells['Value']}`);
      }
      expect.soft(result.notice?.kind, 'An error message is shown').toBe('error');
      expect(number, `No contract created for value "${v['Contract Value']}"`).toBe('');
    });
  });

  test(...spc('SPC-016'), async ({ contracts, chain, page }) => {
    const d = await acceptedDeal(chain, 0);
    let main = '';
    await withSalesLock(async () => {
      const before = await cards(contracts);
      const { result, number } = await newContract(contracts, d);
      runValue.set('contracts-main', number);
      main = number;
      expect.soft(result.notice?.title, 'Pop-up').toBe(DATA.message('Created Title'));
      expect.soft(result.notice?.text ?? '', 'Pop-up text').toContain(DATA.message('Created Body', { contract: number }));
      const after = await cardsAfter(contracts, before, 'Create Contract');
      expectChanges('Create Contract', before, after);
    });
    expect(main, 'Contract number format').toMatch(contractNo());
    const row = (await contractRows(contracts)).find(r => r.number === main);
    note('register row', row?.row.text ?? 'not listed');
    expect.soft(row?.status, 'Status').toBe(S('Draft Status'));
    expect.soft(row?.erp, 'ERP').toBe(S('ERP Not Ready'));
    expect.soft(row?.value, 'Value').toBeCloseTo(d.unit!.price, -4);
    const rsv = new ModulePage(page, S('Reservations Route'));
    await rsv.open();
    const r = (await rsv.allRows()).find(x => x.lines[0] === d.reservation);
    note('reservation status', r?.cells['Status'] ?? 'not listed');
    expect(r?.cells['Status'], 'Reservation status').toBe(S('Reservation Status After Contract'));
  });
});

// ── Life of the main contract ─────────────────────────────────────────────────

async function mainContract(contracts: ModulePage, chain: DealChain): Promise<string> {
  const known = runValue.get<string>('contracts-main');
  if (known) return known;
  const d = await acceptedDeal(chain, 0);
  const existing = (await contractRows(contracts)).find(r => r.reservation === d.reservation && ![S('Superseded Status'), S('Cancelled Status')].includes(r.status));
  const n: string = existing?.number ?? (await runOnce<string>('contracts-main-create', () => newContract(contracts, d).then(x => x.number)));
  runValue.set('contracts-main', n);
  return n;
}
const statusOf = async (contracts: ModulePage, number: string) => (await contractRows(contracts)).find(r => r.number === number)?.status ?? '';
async function issued(contracts: ModulePage, chain: DealChain) {
  const n = await mainContract(contracts, chain);
  if ((await statusOf(contracts, n)) === S('Draft Status')) await contractAction(contracts, n, 'Issue');
  return n;
}
/** Opens the payment plan dialog of a contract. */
async function openPlan(contracts: ModulePage, number: string) {
  const panel = await openContract(contracts, number);
  await panel.root.getByRole('button', { name: DATA.action('Contract Actions', 'Open Plan').submit, exact: true }).click();
  const form = new ModalForm(contracts.page);
  await expect(form.root).toBeVisible();
  await contracts.page.waitForTimeout(1000);
  return form;
}
async function setDueDates(form: ModalForm) {
  const dates = form.root.locator('label.crm-field, .crm-field').filter({ hasText: S('Due Date Label') });
  for (const [i, r] of DATA.sheet('Payment Plan').entries()) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Number(r['Due In Days']));
    await pickDate(form.page, dates.nth(i), d);
  }
}
/** Re-opens a contract until `ok(text)` holds or Plan Wait Seconds run out; returns its text and the seconds it took (-1 = never). */
async function reopenUntil(contracts: ModulePage, number: string, ok: (text: string) => boolean): Promise<{ text: string; secs: number }> {
  const start = Date.now();
  for (;;) {
    const p = await openContract(contracts, number);
    await contracts.page.waitForTimeout(2000);
    const text = await p.text();
    if (ok(text)) return { text, secs: Math.round((Date.now() - start) / 1000) };
    if (Date.now() - start > Number(S('Plan Wait Seconds')) * 1000) return { text, secs: -1 };
    await contracts.page.waitForTimeout(10_000);
  }
}
const PLAN_LINE = /(d+)s+([A-Za-z][A-Za-z ]+?)s+(d{2} w{3} d{4})s+([d.]+)%s+([d.,]+[KMB]? USD)/g;
/** Re-opens the contract until its plan shows as saved, up to Plan Wait Seconds; returns the seconds it took (-1 = never). */
async function waitPlanSaved(contracts: ModulePage, number: string, seconds = Number(S('Plan Wait Seconds'))): Promise<number> {
  const start = Date.now();
  for (;;) {
    const p = await openContract(contracts, number);
    await contracts.page.waitForTimeout(2000);
    if (/Payment Plan (Saved)/i.test(await p.text())) return Math.round((Date.now() - start) / 1000);
    if (Date.now() - start > seconds * 1000) return -1;
    await contracts.page.waitForTimeout(10_000);
  }
}
async function planSaved(contracts: ModulePage, chain: DealChain) {
  const n = await issued(contracts, chain);
  // SPC-026 saved it already: wait for the app to show it instead of saving a second plan
  if (runValue.get<string>('contracts-plan-saved') === n) { const secs = await waitPlanSaved(contracts, n); note('plan shown after', secs < 0 ? 'not shown within the wait' : `${secs} s`); if (secs >= 0) return n; }
  const panel = await openContract(contracts, n);
  // the panel loads the plan a moment after opening: wait a little for "(Saved)" before creating one
  const saved = await expect.poll(async () => /Payment Plan \(Saved\)/i.test(await panel.text()), { timeout: 10_000 }).toBeTruthy().then(() => true, () => false);
  if (saved) return n;
  const form = await openPlan(contracts, n);
  await setDueDates(form);
  const notes = DATA.action('Contract Actions', 'Plan Notes');
  await form.fill(notes.fields);
  await form.submit(notes.submit);
  await form.closeNotice();
  return n;
}

test.describe('Contracts · Issue, plan & sign', () => {
  test.describe.configure({ timeout: 1_200_000 });

  test(...spc('SPC-021'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    const d = await acceptedDeal(chain, 0);
    const p = await openContract(contracts, n);
    const shown = { reservation: await p.summary('RESERVATION'), opportunity: await p.summary('OPPORTUNITY'), unit: await p.summary('UNIT'), value: await p.summary('VALUE'), erp: await p.summary('ERP HANDOFF') };
    const wf = await p.workflow(stages());
    const sign = await p.actionState(DATA.action('Contract Actions', 'Sign').submit);
    note('detail', `${JSON.stringify(shown)} · ${JSON.stringify(wf)} · sign: ${sign}`);
    expect.soft(shown.reservation, 'Reservation').toBe(d.reservation);
    expect.soft(shown.opportunity, 'Opportunity').toBe(d.opportunity);
    expect.soft(shown.unit, 'Unit').toBe(d.unit!.code);
    expect.soft(parseNum(shown.value), 'Value').toBeCloseTo(d.unit!.price, -4);
    expect.soft(shown.erp, 'ERP handoff').toBe(S('ERP Not Ready'));
    expect.soft(wf[stages()[0]], `${stages()[0]} stage`).toBe('IN PROGRESS');
    expect(sign, 'Sign waits for issue').toContain(DATA.message('After Issue'));
  });

  test(...spc('SPC-022'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    const { seen } = await contractAction(contracts, n, 'Issue');
    expect.soft(seen.map(x => x.title), 'Pop-up').toContain(DATA.message('Issued Title'));
    expect(await statusOf(contracts, n), 'Status').toBe(S('Issued Status'));
  });

  test(...spc('SPC-023'), async ({ contracts, chain }) => {
    const n = await issued(contracts, chain);
    const d = await acceptedDeal(chain, 0);
    const form = await openPlan(contracts, n);
    const l = lines(await form.root.innerText());
    const after = (label: string) => l[l.findIndex(x => x === label) + 1] ?? '';
    const spa = d.unit!.price;
    const deposit = parseNum(after(S('Deposit Label')));
    const depositPct = Number((l.find((x, i) => i > l.indexOf(S('Deposit Label')) && /% of SPA$/.test(x)) ?? '').match(/[\d.]+/)?.[0] ?? NaN);
    const balance = parseNum(after(S('Balance Label')));
    const total = l.find(x => x.startsWith(S('Plan Total Line'))) ?? '';
    note('plan summary', `deposit ${deposit} (${depositPct}%) · balance ${balance} · ${total}`);
    expect.soft(deposit, 'Deposit = reservation amount').toBeCloseTo(spa * Number(S('Deposit Percent')) / 100, -2);
    expect.soft(depositPct, 'Deposit % of SPA').toBeCloseTo((deposit / spa) * 100, 1);
    expect.soft(balance, 'Balance = SPA − deposit').toBeCloseTo(spa - deposit, -4);
    for (const t of DATA.sheet('Taxes')) {
      const i = l.findIndex(x => x === t['Tax']);
      const amount = i >= 0 ? parseNum(l.slice(i + 1, i + 4).find(x => /USD$/.test(x)) ?? '0') : NaN;
      note(t['Tax'], `${amount}`);
      expect.soft(amount, `${t['Tax']} = ${t['Percent of SPA']}% of SPA`).toBeCloseTo(spa * Number(t['Percent of SPA']) / 100, -3);
    }
    expect(total, 'Default stages add up to 100%').toMatch(/= 100(\.0+)?%/);
    await form.close();
  });

  test(...spc('SPC-024'), async ({ contracts, chain }) => {
    const n = await issued(contracts, chain);
    const form = await openPlan(contracts, n);
    const r = await form.submit(DATA.action('Contract Actions', 'Plan Notes').submit);
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.title, 'Pop-up').toBe(DATA.message('Due Date Title'));
    expect(r.notice?.text ?? '', 'Pop-up text').toContain(DATA.message('Due Date Body'));
    await form.closeNotice();
    await form.close();
  });

  test(...spc('SPC-025'), async ({ contracts, chain }) => {
    const n = await issued(contracts, chain);
    const form = await openPlan(contracts, n);
    await setDueDates(form);
    const wrong = DATA.sheet('Payment Plan').find(r => r['Wrong Percentage'])!;
    await form.set(wrong['Percentage Field Name'], wrong['Wrong Percentage']);
    const r = await form.submit(DATA.action('Contract Actions', 'Plan Notes').submit);
    const total = lines(await form.root.innerText()).find(x => x.startsWith(S('Plan Total Line'))) ?? '';
    note('pop-up / total line', `${r.notice?.text ?? 'none'} / ${total}`);
    expect.soft(r.notice?.title, 'Pop-up').toBe(DATA.message('Percentages Title'));
    expect(total, 'Total line shows the wrong total').not.toMatch(/= 100(\.0+)?%/);
    await form.closeNotice();
    await form.close();
  });

  test(...spc('SPC-026'), async ({ contracts, chain }) => {
    const n = await issued(contracts, chain);
    const d = await acceptedDeal(chain, 0);
    if (runValue.get<string>('contracts-plan-saved') !== n) {
      const form = await openPlan(contracts, n);
      await setDueDates(form);
      const notes = DATA.action('Contract Actions', 'Plan Notes');
      await form.fill(notes.fields);
      const r = await form.submit(notes.submit);
      note('pop-up', r.notice?.text ?? 'none');
      expect.soft(r.notice?.title, 'Pop-up').toBe(DATA.message('Plan Saved Title'));
      if (r.notice?.title === DATA.message('Plan Saved Title')) runValue.set('contracts-plan-saved', n);
      await form.closeNotice();
    } else note('plan', 'already saved earlier in this run (this is a retry): checking it only');
    // the contract may show the saved plan only after a while: re-open it until it does (the delay is recorded)
    const secs = await waitPlanSaved(contracts, n);
    note('plan shown on the contract after', secs < 0 ? `not within ${S('Plan Wait Seconds')} s` : `${secs} s`);
    expect.soft(secs, 'The contract shows the saved plan (seconds after "Payment Plan Saved"; -1 = not within the wait)').toBeGreaterThanOrEqual(0);
    const lines = await reopenUntil(contracts, n, t => [...t.matchAll(PLAN_LINE)].length >= DATA.sheet('Payment Plan').length + 1);
    note('plan lines shown in the Agreed Pack after', lines.secs < 0 ? `not within ${S('Plan Wait Seconds')} s` : `${lines.secs} s`);
    const text = lines.text;
    const spa = d.unit!.price;
    const re = /(\d+)\s+([A-Za-z][A-Za-z ]+?)\s+(\d{2} \w{3} \d{4})\s+([\d.]+)%\s+([\d.,]+[KMB]? USD)/g;
    const plan = [...text.matchAll(re)].map(m => ({ no: Number(m[1]), stage: m[2], due: m[3], pct: Number(m[4]), amount: parseNum(m[5]), shown: m[5] }));
    note('Agreed Pack plan', plan.map(x => `${x.no} ${x.stage} ${x.due} ${x.pct}% ${x.shown}`).join(' | '));
    expect(plan.length, 'Plan lines in the Agreed Pack').toBe(DATA.sheet('Payment Plan').length + 1);
    for (const x of plan) {
      const step = /M USD$/.test(x.shown) ? 0.01e6 : 1;
      expect.soft(Math.abs(x.amount - spa * x.pct / 100) <= step, `Stage ${x.no} amount = ${x.pct}% of SPA`).toBeTruthy();
    }
    for (const r2 of DATA.sheet('Payment Plan')) {
      const due = shortDate(relativeDate(`{today+${r2['Due In Days']}}`)!);
      expect.soft(plan.find(x => x.no === Number(r2['Stage No']))?.due, `Stage ${r2['Stage No']} due date`).toBe(due);
    }
  });

  test(...spc('SPC-027'), async ({ contracts, chain }) => {
    const n = await planSaved(contracts, chain);
    const p = await openContract(contracts, n);
    const kyc = await p.summary('BUYER KYC');
    const text = await p.text();
    note('buyer KYC', kyc);
    expect.soft(text, 'Requirements listed').toContain(DATA.message('Sign Requirements'));
    expect.soft(kyc, 'Buyer KYC not approved yet').not.toBe(S('KYC Approved Status'));
    const sign = DATA.action('Contract Actions', 'Sign').submit;
    const seen = await p.canPress(sign) ? await p.act(sign) : [];
    note('sign attempt', seen.map(x => `${x.title}: ${x.text}`).join(' | ') || 'button disabled');
    expect(await statusOf(contracts, n), 'Not signed without KYC').toBe(S('Issued Status'));
  });

  test(...spc('SPC-028'), async ({ contracts, chain }) => {
    const n = await planSaved(contracts, chain);
    const d = await acceptedDeal(chain, 0);
    const kyc = await chain.approveKyc(d);
    expect.soft(kyc, 'Buyer KYC').toBe(S('KYC Approved Status'));
    const { seen } = await contractAction(contracts, n, 'Sign', {}, { goBack: true });
    expect.soft(seen[0]?.title, 'Confirmation').toBe(DATA.message('Sign Confirm Title'));
    expect.soft(seen[0]?.text ?? '', 'Names the contract').toContain(n);
    expect(await statusOf(contracts, n), 'Still Issued after Go back').toBe(S('Issued Status'));
  });

  test(...spc('SPC-029'), async ({ contracts, chain }) => {
    const n = await planSaved(contracts, chain);
    await chain.approveKyc(await acceptedDeal(chain, 0));
    if ((await statusOf(contracts, n)) !== S('Signed Status')) {
      await withSalesLock(async () => {
        const before = await cards(contracts);
        const { seen } = await contractAction(contracts, n, 'Sign');
        expect.soft(seen.map(x => x.title), 'Pop-up').toContain(DATA.message('Signed Title'));
        const after = await cardsAfter(contracts, before, 'Sign');
        expectChanges('Sign', before, after);
      });
    } else note('sign', 'the contract was already signed earlier in this run (retry): checking the signed state only');
    const shown = await reopenUntil(contracts, n, t => t.includes(S('Agreed Pack Complete')));
    note('Agreed Pack complete after', shown.secs < 0 ? `not within ${S('Plan Wait Seconds')} s` : `${shown.secs} s`);
    const p = await openContract(contracts, n);
    const replace = await p.actionState(DATA.action('Contract Actions', 'Replace').submit);
    const text = shown.text;
    note('replace / agreed pack', `${replace} / ${text.includes(S('Agreed Pack Complete'))}`);
    expect.soft(replace, 'Replace').toContain(DATA.message('Unavailable'));
    expect.soft(text, 'Agreed Pack complete').toContain(S('Agreed Pack Complete'));
    expect(await statusOf(contracts, n), 'Status').toBe(S('Signed Status'));
  });

  test(...spc('SPC-030'), async ({ chain, page }) => {
    const d = await acceptedDeal(chain, 0);
    const r = await findUnit(page, DATA, d.unit!.code);
    note('unit row', r?.text ?? 'not listed');
    expect(r?.cells['Status'], 'Unit status').toBe(S('Unit Status After Signing'));
  });
});

test.describe('Contracts · ERP, replace & cancel', () => {
  test.describe.configure({ timeout: 1_200_000 });

  test(...spc('SPC-031'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    const first = await openContract(contracts, n);
    if ((await first.summary('ERP HANDOFF')) !== S('ERP Ready')) {
      const { seen } = await contractAction(contracts, n, 'Handoff');
      expect.soft(seen.map(x => x.title), 'Pop-up').toContain(DATA.message('Handoff Ready Title'));
    } else note('handoff', 'ERP already READY after signing (no "Move to Handoff" needed)');
    const ready = await reopenUntil(contracts, n, t => /Send to ERP/.test(t));
    note('Send to ERP shown after', ready.secs < 0 ? 'not shown' : `${ready.secs} s`);
    const p = await openContract(contracts, n);
    note('ERP', await p.summary('ERP HANDOFF'));
    expect.soft(await p.canPress(DATA.action('Contract Actions', 'Send to ERP').submit), 'Send to ERP offered').toBeTruthy();
    expect(await p.summary('ERP HANDOFF'), 'ERP handoff').toBe(S('ERP Ready'));
  });

  test(...spc('SPC-032'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    await contractAction(contracts, n, 'Send to ERP');
    const p = await openContract(contracts, n);
    const wf = await p.workflow(stages());
    const cancel = await p.actionState(DATA.action('Contract Actions', 'Cancel').submit);
    note('ERP / workflow / cancel', `${await p.summary('ERP HANDOFF')} / ${JSON.stringify(wf)} / ${cancel}`);
    expect.soft(wf[stages()[stages().length - 1]], 'Moved to ERP').toBe('DONE');
    expect.soft(cancel, 'Cancel no longer possible').toContain(DATA.message('Unavailable'));
    expect(await p.summary('ERP HANDOFF'), 'ERP handoff').toBe(S('ERP Handed Off'));
  });

  test(...spc('SPC-033'), async ({ contracts, chain }) => {
    const d = await acceptedDeal(chain, 1);
    const live = (await contractRows(contracts)).find(r => r.reservation === d.reservation && r.status === S('Draft Status'));
    const old = live?.number ?? (await newContract(contracts, d)).number;
    expect(old, 'A draft contract to replace').not.toBe('');
    const replace = DATA.action('Contract Actions', 'Replace');
    const values = Object.fromEntries(Object.entries(replace.fields).map(([k, v]) => [k, fill(v, { list: d.unit!.price })]));
    const price = Number(Object.values(values).find(v => /^\d+$/.test(v)));
    await withSalesLock(async () => {
      const before = await cards(contracts);
      const { seen } = await contractAction(contracts, old, 'Replace', values);
      expect.soft(seen.map(x => x.title), 'Pop-up').toContain(DATA.message('Replaced Title'));
      runValue.set('contracts-second', seen.map(x => x.text.match(CON)?.[0]).find(Boolean) ?? '');
      const after = await cardsAfter(contracts, before, 'Replace Draft');
      expectChanges('Replace Draft', before, after);
    });
    const rows = (await contractRows(contracts)).filter(r => r.reservation === d.reservation);
    note('contracts of the deal', rows.map(r => `${r.number} ${r.status} ${r.row.cells['Value']}`).join(' | '));
    expect.soft(rows.find(r => r.number === old)?.status, 'Old contract').toBe(S('Superseded Status'));
    const fresh = rows.find(r => r.number === runValue.get<string>('contracts-second'));
    expect(fresh?.status, 'New contract').toBe(S('Draft Status'));
    expect.soft(fresh!.value, 'New value').toBeCloseTo(price, -4);
  });

  test(...spc('SPC-034'), async ({ contracts, chain }) => {
    const d = await acceptedDeal(chain, 1);
    const n = runValue.get<string>('contracts-second') || (await contractRows(contracts)).find(r => r.reservation === d.reservation && r.status === S('Draft Status'))?.number || (await newContract(contracts, d)).number;
    await withSalesLock(async () => {
      const before = await cards(contracts);
      await contractAction(contracts, n, 'Cancel');
      const after = await cardsAfter(contracts, before, 'Cancel Draft');
      expectChanges('Cancel Draft', before, after);
    });
    expect(await statusOf(contracts, n), 'Status').toBe(S('Cancelled Status'));
  });

  test(...spc('SPC-006'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    const d = await acceptedDeal(chain, 0);
    await contracts.open();
    for (const text of [n, d.buyer.name, d.unit!.code]) {
      await contracts.search(S('Search Placeholder'), text);
      const rows = await contracts.rows();
      note(`search "${text}"`, rows.map(r => r.lines[0]).join(', '));
      expect.soft(rows.some(r => r.lines[0] === n), `"${text}" finds the contract`).toBeTruthy();
      expect.soft(rows.filter(r => !r.text.toLowerCase().includes(text.toLowerCase())).map(r => r.lines[0]), `Every row matches "${text}"`).toEqual([]);
    }
  });
});

// ── Register tools & contract records (SPC-035 … SPC-041) ────────────────────
const firstPart = (cell: string) => (cell ?? '').split(' | ')[0].trim();
const sortKey = (kind: string, cell: string): number | string => {
  const v = firstPart(cell);
  if (kind === 'number') return /\d/.test(v) ? parseNum(v) : 0;
  if (kind === 'date') { const t = Date.parse(v.replace(',', '')); return Number.isNaN(t) ? 0 : t; }
  return v.toLowerCase();
};
/** Pairs of neighbouring rows that break the order (empty = sorted). */
function outOfOrder(values: (number | string)[], dir: 'ascending' | 'descending', shown: string[]): string[] {
  const bad: string[] = [];
  for (let i = 1; i < values.length; i++) {
    const [a, b] = [values[i - 1], values[i]];
    const cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
    if (dir === 'ascending' ? cmp > 0 : cmp < 0) bad.push(`row ${i} "${shown[i - 1]}" before row ${i + 1} "${shown[i]}"`);
  }
  return bad;
}

test.describe('Contracts · Register tools & records', () => {
  test.describe.configure({ timeout: 900_000 });
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test(...spc('SPC-035'), async ({ contracts }) => {
    await contracts.open();
    const sortable = await contracts.sortableColumns();
    note('sortable columns', sortable.join(', '));
    for (const c of DATA.sheet('Sort Columns')) {
      expect.soft(sortable, `"${c['Column']}" can be sorted`).toContain(c['Column']);
      if (!sortable.includes(c['Column'])) continue;
      for (const dir of ['ascending', 'descending'] as const) {
        const reached = await contracts.sortBy(c['Column'], dir);
        const shown = (await contracts.rows()).map(r => firstPart(r.cells[c['Column']]));
        const bad = outOfOrder(shown.map(v => sortKey(c['Kind'], v)), dir, shown);
        note(`sort ${c['Column']} ${dir}`, `${reached}: ${shown.join(' · ')}`);
        expect.soft(reached, `${c['Column']} header shows ${dir}`).toBe(dir);
        expect.soft(bad, `Rows sorted by ${c['Column']} (${dir}, ${c['Kind']})`).toEqual([]);
      }
    }
  });

  test(...spc('SPC-036'), async ({ contracts }) => {
    await contracts.open();
    const size = Number(S('Page Size'));
    const total = await contracts.pagerTotal();
    const pages = Math.max(1, Math.ceil(total / size));
    note('pager', `${await contracts.pagerText()} (expected ${pages} page(s) of ${size})`);
    expect.soft(await contracts.pagerText(), 'Pager names page 1 of all pages').toContain(`Page 1 of ${pages}`);
    expect.soft((await contracts.pagerButtons()).previous, 'Previous disabled on page 1').toBeFalsy();
    const seen: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const rows = (await contracts.rows()).map(r => r.lines[0]);
      note(`page ${p}`, `${await contracts.pagerText()}: ${rows.length} rows`);
      expect.soft(rows.length, `Rows on page ${p}`).toBe(p < pages ? size : total - size * (pages - 1));
      seen.push(...rows);
      if (p < pages) await contracts.nextPage();
    }
    expect.soft((await contracts.pagerButtons()).next, 'Next disabled on the last page').toBeFalsy();
    expect.soft(seen.filter((n, i) => seen.indexOf(n) !== i), 'No contract on two pages').toEqual([]);
    expect.soft(seen.length, 'Pages together hold every contract').toBe(total);
    if (pages > 1) {
      await contracts.previousPage();
      expect(await contracts.pagerText(), 'Previous goes back one page').toContain(`Page ${pages - 1} of ${pages}`);
    }
  });

  test(...spc('SPC-037'), async ({ contracts }) => {
    const rows = await contractRows(contracts);
    const shown = await cards(contracts);
    const f = await contracts.cardFormula(S('Total Card'));
    note('Total formula / tooltip', `${f.text} / ${f.title}`);
    const parts = Object.fromEntries([...f.text.matchAll(/([^+()]+?)\s*\((\d+)\)/g)].map(m => [m[1].trim(), Number(m[2])]));
    expect(Object.keys(parts).length, 'Formula line under Total').toBeGreaterThan(0);
    const sum = Object.values(parts).reduce((a, x) => a + x, 0);
    expect.soft(sum, 'Parts add up to the Total card').toBe(shown[S('Total Card')]);
    for (const b of DATA.sheet('Total Breakdown')) {
      const statuses = b['Statuses'].split(',').map(s => s.trim());
      const inRegister = rows.filter(r => statuses.includes(r.status)).length;
      note(`part ${b['Part']}`, `formula ${parts[b['Part']]} · register (${statuses.join(' + ')}) ${inRegister}${b['Card'] ? ` · card ${shown[b['Card']]}` : ''}`);
      expect.soft(parts[b['Part']], `"${b['Part']}" = contracts with status ${statuses.join(' / ')}`).toBe(inRegister);
      if (b['Card']) expect.soft(parts[b['Part']], `"${b['Part']}" = ${b['Card']} card`).toBe(shown[b['Card']]);
    }
  });

  test(...spc('SPC-038'), async ({ contracts, chain, page }) => {
    const n = await mainContract(contracts, chain);
    const p = await openContract(contracts, n);
    const link = await p.copyLink();
    note('copied link', link);
    expect(link, 'A link was copied').toMatch(/^https?:\/\//);
    await page.goto(link);
    const again = new RecordPanel(page);
    await again.waitOpen(n);
    expect((await again.header()).number, 'Opens the same contract').toBe(n);
  });

  for (const id of ['SPC-039', 'SPC-040']) {
    const doc = DATA.sheet('Contract Documents').find(r => r['Case ID'] === id)!;
    test(...spc(id), async ({ contracts, chain }) => {
      const n = await mainContract(contracts, chain);
      const file = doc['File'].split('/').pop()!;
      const p = await openContract(contracts, n);
      const beforeLines = await p.block(S('Documents Heading'));
      const before = beforeLines.join(' ');
      expect.soft(before, 'Documents shows the allowed files').toContain(S('Document Rule Text'));
      const { seen, lines } = await p.uploadDocument({ type: doc['Document Type'], description: doc['Description'], file: doc['File'] }, S('Documents Heading'), S('Upload Button'));
      // a message may also be written inside the Documents block instead of a pop-up
      const inline = lines.filter(l => !beforeLines.includes(l) && !l.includes(file));
      note('test data', `${n} · ${doc['Document Type']} · ${doc['File']}`);
      note('upload pop-ups / new text in Documents', `${seen.map(x => `${x.title}: ${x.text}`).join(' | ') || 'none'} / ${inline.join(' | ') || 'none'}`);
      // re-open: the list must come from the saved contract, not from the form
      const listed = (await (await openContract(contracts, n)).block(S('Documents Heading'))).join(' ');
      note('Documents after re-opening', listed.slice(0, 500));
      if (doc['Expected'] === 'Accepted') {
        expect.soft(lines.join(' '), 'Listed straight after Upload').toContain(file);
        expect.soft(listed, 'No longer empty').not.toContain(S('No Documents Text'));
        expect.soft(listed, 'Type shown').toContain(doc['Document Type']);
        expect(listed, 'Document kept on the contract').toContain(file);
      } else {
        expect.soft(seen.length + inline.length, `A message tells the user that ${file} is refused (only ${S('Document Rule Text')}); nothing was shown`).toBeGreaterThan(0);
        expect(listed, `${file} is not listed`).not.toContain(file);
      }
    });
  }

  test(...spc('SPC-041'), async ({ contracts, chain }) => {
    const n = await mainContract(contracts, chain);
    const current = await statusOf(contracts, n);
    const p = await openContract(contracts, n);
    await p.root.getByRole('button', { name: 'Refresh', exact: true }).last().click().catch(() => {});
    await contracts.page.waitForTimeout(1500);
    const h = (await p.block(S('History Heading'))).join(' ');
    note('history', h.slice(0, 1500));
    const field = S('History Status Field').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const moves = [...h.matchAll(new RegExp(`${field} ([A-Za-z][A-Za-z ]*?) → ${S('History Changed Words')} ([A-Za-z]+)`, 'g'))].map(m => `${m[1]} → ${m[2]}`);
    note('status changes', `${moves.join(' | ') || 'none'} (register: ${current})`);
    expect.soft(h, 'Creation entry').toContain(S('History Created Word'));
    const stamps = [...h.matchAll(new RegExp(`${S('History User')} · \\d{1,2} \\w{3} \\d{4}, \\d{2}:\\d{2}`, 'g'))].length;
    expect.soft(stamps, 'Every entry names the user and the time').toBeGreaterThanOrEqual(moves.length + 1);
    const order = [S('Draft Status'), S('Issued Status'), S('Signed Status')];
    const reached = order.indexOf(current);
    for (let i = 1; i <= reached; i++) expect.soft(moves, `${order[i - 1]} → ${order[i]} recorded`).toContain(`${order[i - 1]} → ${order[i]}`);
    // a contract still in Draft has no status change yet; otherwise the newest change (listed first) ends in the register status
    if (reached > 0) expect(moves[0]?.split(' → ')[1], 'Latest status change = status in the register').toBe(current);
    else expect(moves, `${current} contract: no status change recorded yet`).toEqual([]);
  });
});
