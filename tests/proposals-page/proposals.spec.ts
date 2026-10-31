/**
 * Proposals page (PRO-001 … PRO-033). The suite runs on one worker, in this order: register & counts,
 * New Proposal, then the approval workflow of one proposal created by the test (each workflow test brings
 * the proposal to the status it needs first, so one failure does not block the others).
 */
import { test, expect, pro, proRow, note, DATA, S, reservedDeal, unreservedDeal, proposalRows, cards, expectedCard, expectChanges, proposalNo, openProposal, proposalAction } from './shared';
import { ModalForm, ModulePage } from '../pages/SalesPages';
import { withSalesLock } from '../sales-chain/inventory';
import { DealChain } from '../sales-chain/deal';
import { fill, runOnce, runValue } from '../sales-chain/data';
import { parseNum } from '../helpers';
import { relativeDate } from '../leads-page/test-data';

const F = () => DATA.fieldNames();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Replace Proposal fields from the data: the reason (first field) and the new price ({list-3%}). */
function replaceFields(list: number, withReason = true) {
  const a = DATA.action('Proposal Actions', 'Replace');
  const out = Object.fromEntries(Object.entries(a.fields).map(([k, v]) => [k, fill(v, { list })]));
  if (!withReason) out[Object.keys(a.fields)[0]] = '';
  const priceField = Object.keys(a.fields).find(k => a.fields[k].includes('{list'))!;
  return { fields: out, price: Number(out[priceField]) };
}

/** New Proposal with the deal's opportunity chosen (and its values filled in by the app). */
async function formFor(page: import('@playwright/test').Page, opportunity: string) {
  const form = new ModalForm(page);
  await form.open(S('New Proposal Button'));
  await form.set(F()['Opportunity'], `~${opportunity}`);
  await expect.poll(() => form.value(F()['Proposed Price (USD)']), { timeout: 15_000 }).not.toBe('');
  return form;
}

test.describe('Proposals · Register & counts', () => {
  test.describe.configure({ timeout: 300_000 });

  test(...pro('PRO-001'), async ({ proposals }) => {
    await proposals.open();
    const title = await proposals.title();
    note('title', title);
    expect.soft(title, 'Page title').toContain(S('Page Title'));
    for (const c of DATA.cardRules()) note(`card ${c.card}`, await proposals.kpiText(c.card));
    expect.soft(await proposals.headers(), 'Register columns').toEqual(DATA.sheet('Register Columns').map(r => r['Column']));
    expect(await proposals.page.locator('main').getByRole('button', { name: S('New Proposal Button') }).count(), 'New Proposal button').toBeGreaterThan(0);
  });

  for (const [id, card] of [['PRO-002', 'Total'], ['PRO-003', 'Needs Approval'], ['PRO-004', 'Approved'], ['PRO-005', 'Proposal Value']] as const) {
    test(...pro(id), async ({ proposals }) => {
      const shown = (await cards(proposals))[card];
      const rows = await proposalRows(proposals);
      const want = expectedCard(card, rows);
      const rule = DATA.cardRules().find(c => c.card === card)!;
      note(`${card}: card / register`, `${shown} / ${want} (statuses: ${rule.statuses.join(', ') || 'all'}; register ${rows.length} rows: ${[...new Set(rows.map(r => r.status))].map(s => `${s} ${rows.filter(r => r.status === s).length}`).join(', ')})`);
      if (/sum/i.test(rule.measure)) {
        const step = 0.01e6; // values shown in millions with 2 decimals
        expect(Math.abs(shown - want), `${card} = ${rule.measure} of ${rule.statuses.join(', ')} (difference)`).toBeLessThanOrEqual(Math.max(want * Number(0.005), step * rows.length));
      } else expect(shown, `${card} = proposals with status ${rule.statuses.join(', ') || 'any'}`).toBe(want);
    });
  }
});

test.describe('Proposals · New Proposal', () => {
  test.describe.configure({ timeout: 900_000 });

  test(...pro('PRO-011'), async ({ proposals, page }) => {
    await proposals.open();
    const form = new ModalForm(page);
    await form.open(S('New Proposal Button'));
    const text = await form.text();
    note('form', text.slice(0, 300));
    expect.soft(text, 'Currency note').toContain(S('Currency Note'));
    for (const f of DATA.sheet('Form Fields')) expect.soft(await form.field(f['Field Name']).count(), `Field "${f['Field Label']}"`).toBeGreaterThan(0);
    const values = await form.root.locator('input').evaluateAll(es => es.map(e => (e as HTMLInputElement).value));
    expect.soft(values, 'Deal Currency').toContain(S('Base Currency'));
    for (const f of DATA.sheet('Form Fields').filter(x => x['Field Type'] === 'Read-only'))
      expect.soft(await form.field(f['Field Name']).evaluate(e => (e as HTMLInputElement).readOnly || (e as HTMLInputElement).disabled), `"${f['Field Label']}" is read-only`).toBeTruthy();
    await form.close();
  });

  test(...pro('PRO-013'), async ({ proposals, page }) => {
    await proposals.open();
    const form = new ModalForm(page);
    await form.open(S('New Proposal Button'));
    const r = await form.submit(S('Create Proposal Button'));
    note('pop-up', r.notice?.text ?? 'none');
    expect.soft(r.notice?.title, 'Pop-up title').toBe(DATA.message('Opportunity Required Title'));
    expect.soft(r.notice?.text ?? '', 'Pop-up text').toContain(DATA.message('Opportunity Required Body'));
    expect(r.closed, 'Nothing created (form open)').toBeFalsy();
    await form.closeNotice();
    await form.close();
  });

  test(...pro('PRO-012'), async ({ proposals, page, chain }) => {
    const d = await reservedDeal(chain);
    const other = await unreservedDeal(chain);
    await proposals.open();
    const form = new ModalForm(page);
    await form.open(S('New Proposal Button'));
    const opts = await form.options(F()['Opportunity']);
    note('opportunities offered', opts.join(' | '));
    expect.soft(opts.some(o => o.includes(d.opportunity)), `${d.opportunity} (approved reservation) offered`).toBeTruthy();
    expect(opts.some(o => o.includes(other.opportunity)), `${other.opportunity} (no reservation) not offered`).toBeFalsy();
    await form.close();
  });

  test(...pro('PRO-014'), async ({ proposals, page, chain }) => {
    const d = await reservedDeal(chain);
    await proposals.open();
    const form = await formFor(page, d.opportunity);
    const f = F();
    const unit = await form.selected(f['Unit']);
    const list = parseNum(await form.value(f['List Price (USD)']));
    const proposed = parseNum(await form.value(f['Proposed Price (USD)']));
    const discount = await form.value(f['Discount Amount (USD)']);
    const pct = await form.value(f['Discount %']);
    const dates = await form.root.locator('input[type=hidden]').evaluateAll(es => es.map(e => (e as HTMLInputElement).value).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)));
    const remarks = await form.value(f['Remarks']);
    note('form values', JSON.stringify({ unit, list, proposed, discount, pct, dates, remarks }));
    expect.soft(unit, 'Unit = the reserved unit').toContain(d.unit!.code);
    expect.soft(list, 'List Price = unit price').toBe(d.unit!.price);
    expect.soft(proposed, 'Proposed Price = List Price').toBe(list);
    expect.soft(parseNum(discount || '0'), 'Discount Amount').toBe(0);
    expect.soft(parseNum(pct || '0'), 'Discount %').toBe(0);
    expect.soft(dates, 'Valid Until = today + Validity Days').toContain(iso(relativeDate(`{today+${S('Validity Days')}}`)!));
    expect(remarks, 'Remarks').toBe(S('Remarks Template').replace('{reservation}', d.reservation!));
    await form.close();
  });

  test(...pro('PRO-015'), async ({ proposals, page, chain }) => {
    const d = await reservedDeal(chain);
    await proposals.open();
    const form = await formFor(page, d.opportunity);
    const f = F();
    const list = parseNum(await form.value(f['List Price (USD)']));
    const pct = Number(S('Discount Percent'));
    const proposed = Math.round(list * (1 - pct / 100));
    await form.set(f['Proposed Price (USD)'], String(proposed));
    await page.waitForTimeout(500);
    const amount = parseNum(await form.value(f['Discount Amount (USD)']) || '0');
    const shownPct = parseNum(await form.value(f['Discount %']) || '0');
    note('list / proposed / discount / %', `${list} / ${proposed} / ${amount} / ${shownPct}`);
    expect.soft(amount, 'Discount Amount = List − Proposed').toBeCloseTo(list - proposed, 0);
    expect(shownPct, 'Discount % = Discount ÷ List').toBeCloseTo(pct, 1);
    await form.close();
  });

  DATA.sheet('Invalid Prices').forEach((v, i) => {
    test(...proRow('PRO-016', i + 1, v['Why it is wrong'], v['Expected'], `Proposed Price "${v['Proposed Price']}"`), async ({ proposals, page, chain }) => {
      const d = await reservedDeal(chain);
      await proposals.open();
      const form = await formFor(page, d.opportunity);
      await form.set(F()['Proposed Price (USD)'], v['Proposed Price']);
      const r = await withSalesLock(() => form.submit(S('Create Proposal Button'), { wait: 8_000 }));
      note('pop-up', r.notice ? `${r.notice.title}: ${r.notice.text}` : 'none');
      if (r.closed) {
        const made = (await proposalRows(proposals)).find(x => x.opportunity === d.opportunity);
        note('saved anyway', made ? `${made.number} · ${made.status} · proposed ${made.proposed} · discount ${made.discount}` : 'not listed');
      }
      expect.soft(r.notice?.kind, 'An error message is shown').toBe('error');
      expect(r.closed, `Proposal with proposed price "${v['Proposed Price']}" is not saved`).toBeFalsy();
      await form.closeNotice();
      await form.close();
    });
  });
});

// ── Workflow ──────────────────────────────────────────────────────────────────
/** The proposal the workflow tests act on (kept for the whole run, see runValue). */
const WF = 'proposals-current';
const wfGet = () => runValue.get<string>(WF);
const wfSet = (n: string) => runValue.set(WF, n);
/**
 * A new Draft proposal on the deal's opportunity for one workflow test (it supersedes the previous one), so each
 * test starts from a known status even when an earlier test failed or Playwright retries it.
 */
async function freshProposal(proposals: ModulePage, chain: DealChain): Promise<string> {
  const d = await reservedDeal(chain);
  const made = (await withSalesLock(() => chain.proposal(d, S('Proposals Route')))).proposal!;
  wfSet(made);
  return made;
}
/** The latest workflow proposal (for tests that only read it), or a new one. */
async function workflowProposal(proposals: ModulePage, chain: DealChain): Promise<string> {
  return wfGet() ?? freshProposal(proposals, chain);
}
const statusOf = async (proposals: ModulePage, number: string) => (await proposalRows(proposals)).find(r => r.number === number)?.status ?? '';
/** A new proposal brought to a status: Draft → Submitted → Approved → Accepted (each step checked). */
async function bring(proposals: ModulePage, chain: DealChain, target: string) {
  const order = [S('Draft Status'), S('Submitted Status'), S('Approved Status'), S('Accepted Status')];
  const actions = ['Submit', 'Approve', 'Accept'];
  const number = await freshProposal(proposals, chain);
  for (let i = 0; i < order.indexOf(target); i++) {
    await proposalAction(proposals, number, actions[i]);
    expect(await statusOf(proposals, number), `Proposal ${number} reached "${order[i + 1]}" (needed before this check)`).toBe(order[i + 1]);
  }
  return number;
}

test.describe('Proposals · Workflow', () => {
  test.describe.configure({ timeout: 900_000 });
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test(...pro('PRO-017'), async ({ proposals, chain }) => {
    const d = await reservedDeal(chain);
    await withSalesLock(async () => {
      const before = await cards(proposals);
      const made = await chain.proposal(d, S('Proposals Route'));
      wfSet(made.proposal!);
      const wf = made.proposal!;
      const after = await cards(proposals);
      expectChanges('Create Proposal', before, after);
      const r = (await proposalRows(proposals)).find(x => x.number === wf);
      note('register row', r?.row.text ?? 'not listed');
      expect.soft(wf, 'Proposal number format').toMatch(proposalNo());
      expect.soft(r?.customer, 'Customer').toBe(d.buyer.name);
      expect.soft(r?.unit, 'Unit').toBe(d.unit!.code);
      expect.soft(r?.proposed, 'Proposed').toBeCloseTo(d.unit!.price, -4);
      expect(r?.status, 'Status').toBe(S('Draft Status'));
    });
  });

  test(...pro('PRO-021'), async ({ proposals, chain }) => {
    const number = await freshProposal(proposals, chain);
    const panel = await openProposal(proposals, number);
    const stages = DATA.sheet('Workflow Stages').map(r => r['Stage']);
    const wfState = await panel.workflow(stages);
    const approve = await panel.actionState(DATA.action('Proposal Actions', 'Approve').submit);
    const reject = await panel.actionState(DATA.action('Proposal Actions', 'Reject').submit);
    const history = (await panel.block(S('Approval History Heading'))).join(' ');
    note('status / workflow / approve / reject / history', `${await panel.status()} / ${JSON.stringify(wfState)} / ${approve} / ${reject} / ${history}`);
    expect.soft(await panel.status(), 'Status').toBe(S('Draft Status'));
    expect.soft(wfState[stages[0]], `${stages[0]} stage`).toBe('IN PROGRESS');
    for (const s of stages.slice(1)) expect.soft(wfState[s], `${s} stage`).toBe('UP NEXT');
    expect.soft(approve, 'Approve waits for submit').toContain(DATA.message('After Submit'));
    expect.soft(reject, 'Reject waits for submit').toContain(DATA.message('After Submit'));
    expect(history, 'Approval History is empty').toContain(S('No Approval Text'));
  });

  test(...pro('PRO-022'), async ({ proposals, chain }) => {
    const number = await freshProposal(proposals, chain);
    const panel = await openProposal(proposals, number);
    const accept = DATA.action('Proposal Actions', 'Accept').submit;
    const state = await panel.actionState(accept);
    note('Accept on a Draft', `${await panel.status()}: "${state}", button enabled = ${await panel.canPress(accept)}`);
    expect(await panel.canPress(accept) && !/AFTER|UNAVAILABLE/i.test(state), 'Accept Proposal is not usable on a Draft').toBeFalsy();
  });

  test(...pro('PRO-030'), async ({ proposals, chain }) => {
    const number = await freshProposal(proposals, chain);
    const d = await reservedDeal(chain);
    const total = (await proposalRows(proposals)).length;
    const fields = replaceFields(d.unit!.price, false).fields;
    const reasonField = Object.keys(fields)[0];
    const { panel, seen } = await proposalAction(proposals, number, 'Replace', fields);
    const asked = seen.map(n => n.text).join(' | ') || (await panel.validationMessage(reasonField));
    note('message', asked || 'none');
    expect.soft(asked ? 'a message was shown' : 'nothing was shown (no message, no highlighted field)', 'The app asks for the missing reason').toBe('a message was shown');
    expect((await proposalRows(proposals)).length, 'No new proposal').toBe(total);
  });

  test(...pro('PRO-031'), async ({ proposals, chain }) => {
    const old = await freshProposal(proposals, chain);
    const d = await reservedDeal(chain);
    await withSalesLock(async () => {
      const before = await cards(proposals);
      const { fields, price } = replaceFields(d.unit!.price);
      await proposalAction(proposals, old, 'Replace', fields);
      const after = await cards(proposals);
      expectChanges('Replace Draft', before, after);
      const rows = await proposalRows(proposals);
      const mine = rows.filter(r => r.opportunity === d.opportunity);
      note('proposals of the deal', mine.map(r => `${r.number} ${r.status} ${r.proposed}`).join(' | '));
      expect.soft(mine.find(r => r.number === old)?.status, 'Old proposal').toBe(S('Superseded Status'));
      const fresh = mine.find(r => r.number !== old && r.status === S('Draft Status'));
      expect(fresh, 'New Draft proposal').toBeTruthy();
      expect.soft(fresh!.proposed, 'New proposed price').toBeCloseTo(price, -4);
      wfSet(fresh!.number);
    });
  });

  test(...pro('PRO-023'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Draft Status'));
    await withSalesLock(async () => {
      const before = await cards(proposals);
      const { panel } = await proposalAction(proposals, number, 'Submit');
      const after = await cards(proposals);
      expectChanges('Submit', before, after);
      const p = await openProposal(proposals, number);
      const history = (await p.block(S('Approval History Heading'))).join(' ');
      note('status / history', `${await p.status()} / ${history}`);
      expect.soft(history, 'Approval History').toContain(S('Submitted Status'));
      expect(await p.status(), 'Status').toBe(S('Submitted Status'));
      void panel;
    });
  });

  test(...pro('PRO-024'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Submitted Status'));
    const reject = DATA.action('Proposal Actions', 'Reject');
    const reasonField = Object.keys(reject.fields)[0];
    const { panel, seen } = await proposalAction(proposals, number, 'Reject', { [reasonField]: '' });
    const asked = seen.map(n => n.text).join(' | ') || (await panel.validationMessage(reasonField));
    note('message', asked || 'none');
    expect.soft(asked ? 'a message was shown' : 'nothing was shown (no message, no highlighted field)', 'The app asks for the missing reason').toBe('a message was shown');
    expect(await statusOf(proposals, number), 'Still Submitted').toBe(S('Submitted Status'));
  });

  test(...pro('PRO-025'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Submitted Status'));
    const reason = DATA.action('Proposal Actions', 'Reject').fields;
    await withSalesLock(async () => {
      const before = await cards(proposals);
      await proposalAction(proposals, number, 'Reject');
      const after = await cards(proposals);
      expectChanges('Reject', before, after);
    });
    const p = await openProposal(proposals, number);
    const history = (await p.block(S('Approval History Heading'))).join(' ');
    note('status / history', `${await p.status()} / ${history}`);
    expect.soft(history, 'Reason in Approval History').toContain(Object.values(reason)[0]);
    expect(await p.status(), 'Back to Draft').toBe(S('Draft Status'));
  });

  test(...pro('PRO-026'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Submitted Status'));
    const { seen } = await proposalAction(proposals, number, 'Approve', {}, { goBack: true });
    note('confirmation', seen[0]?.text ?? 'none');
    expect.soft(seen[0]?.title, 'Confirmation').toBe(DATA.message('Approve Confirm Title'));
    expect.soft(seen[0]?.text ?? '', 'Names the proposal').toContain(number);
    expect.soft(seen[0]?.buttons ?? [], 'Go back offered').toContain(DATA.message('Go Back'));
    expect(await statusOf(proposals, number), 'Still Submitted after Go back').toBe(S('Submitted Status'));
  });

  test(...pro('PRO-027'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Submitted Status'));
    await withSalesLock(async () => {
      const before = await cards(proposals);
      await proposalAction(proposals, number, 'Approve');
      const after = await cards(proposals);
      expectChanges('Approve', before, after);
    });
    const p = await openProposal(proposals, number);
    const history = (await p.block(S('Approval History Heading'))).join(' ');
    const submitState = await p.actionState(DATA.action('Proposal Actions', 'Submit').submit);
    const approveState = await p.actionState(DATA.action('Proposal Actions', 'Approve').submit);
    note('status / history / submit / approve', `${await p.status()} / ${history} / ${submitState} / ${approveState}`);
    expect.soft(history, 'Approval History').toContain(S('Approved Status'));
    expect.soft(submitState, 'Submit').toContain(DATA.message('Already'));
    expect.soft(approveState, 'Approve').toContain(DATA.message('Already'));
    expect(await p.status(), 'Status').toBe(S('Approved Status'));
  });

  test(...pro('PRO-028'), async ({ proposals, chain }) => {
    const number = await bring(proposals, chain, S('Approved Status'));
    const d = await reservedDeal(chain);
    await proposalAction(proposals, number, 'Accept');
    const p = await openProposal(proposals, number);
    const stages = DATA.sheet('Workflow Stages').map(r => r['Stage']);
    const state = await p.workflow(stages);
    const text = await p.text();
    note('status / workflow', `${await p.status()} / ${JSON.stringify(state)}`);
    for (const s of stages) expect.soft(state[s], `${s} stage`).toBe('DONE');
    expect.soft(text, 'Move to Contract offered').toContain(DATA.message('Move To Contract'));
    expect.soft(text, 'Reservation named').toContain(d.reservation!);
    expect(await p.status(), 'Status').toBe(S('Accepted Status'));
  });

  test(...pro('PRO-029'), async ({ chain, page }) => {
    const d = await reservedDeal(chain);
    const customers = new ModulePage(page, S('Customers Route'));
    await customers.open();
    const r = (await customers.allRows()).find(x => x.text.includes(d.buyer.email));
    note('customer row', r?.text ?? 'not listed');
    expect(r?.cells['Status'], 'Buyer status').toBe(S('Customer Status After Accept'));
  });

  test(...pro('PRO-032'), async ({ proposals, chain }) => {
    const number = await workflowProposal(proposals, chain);
    const d = await reservedDeal(chain);
    const p = await openProposal(proposals, number);
    const audit = await p.block(S('Pricing Audit Heading'));
    note('Pricing Audit', audit.join(' | '));
    const i = audit.indexOf(S('List Price Source Label'));
    expect.soft(i >= 0 ? parseNum(audit[i + 1]) : NaN, 'List price source = unit price').toBeCloseTo(d.unit!.price, -4);
    expect.soft(audit.join(' '), 'Reservation named').toContain(d.reservation!);
    expect(audit.join(' '), 'Exchange rate').toContain(S('Exchange Rate Text'));
  });

  test(...pro('PRO-033'), async ({ proposals, chain, page }) => {
    const number = await workflowProposal(proposals, chain);
    const p = await openProposal(proposals, number);
    const link = await p.copyLink();
    note('copied link', link);
    await page.goto(link);
    const again = new (await import('../pages/SalesPages')).RecordPanel(page);
    await again.waitOpen(number);
    expect((await again.header()).number, 'Opens the same proposal').toBe(number);
  });

  test(...pro('PRO-006'), async ({ proposals, chain }) => {
    const number = await workflowProposal(proposals, chain);
    const d = await reservedDeal(chain);
    await proposals.open();
    for (const text of [number, d.buyer.name, d.unit!.code]) {
      await proposals.search(S('Search Placeholder'), text);
      const rows = await proposals.rows();
      note(`search "${text}"`, rows.map(r => r.lines[0]).join(', '));
      expect.soft(rows.some(r => r.lines[0] === number || r.text.includes(text)), `"${text}" finds the proposal`).toBeTruthy();
      expect.soft(rows.filter(r => !r.text.toLowerCase().includes(text.toLowerCase())).map(r => r.lines[0]), `Every row matches "${text}"`).toEqual([]);
    }
  });

  test(...pro('PRO-007'), async ({ proposals, chain }) => {
    const number = await workflowProposal(proposals, chain);
    const row = (await proposalRows(proposals)).find(r => r.number === number)!;
    const p = await openProposal(proposals, number);
    const shown = { opportunity: await p.summary('OPPORTUNITY'), unit: await p.summary('UNIT'), proposed: await p.summary('PROPOSED'), discount: await p.summary('DISCOUNT'), status: await p.status() };
    note('row / detail', `${JSON.stringify({ opportunity: row.opportunity, unit: row.unit, proposed: row.proposed, discount: row.discount, status: row.status })} / ${JSON.stringify(shown)}`);
    expect.soft(shown.opportunity, 'Opportunity').toBe(row.opportunity);
    expect.soft(shown.unit, 'Unit').toBe(row.unit);
    expect.soft(parseNum(shown.proposed), 'Proposed').toBeCloseTo(row.proposed, -4);
    expect(shown.status, 'Status').toBe(row.status);
  });
});
