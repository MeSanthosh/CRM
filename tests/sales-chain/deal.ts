/**
 * Builds the deal chain the Proposals and Contracts suites need, step by step and only as far as asked:
 *   buyer lead → qualified → opportunity → site visit → visit completed → Reservation Ready
 *   → reservation on a NEW unit of the test project → reservation approved
 *   → proposal → submitted → approved → accepted → (KYC approved on the customer)
 * Every value comes from the suite's TestData file (Buyers, Deal Steps, Deal Unit, Deal Settings) plus the
 * Leads page / Lead Detail data for the lead and its qualification.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadDetail } from '../pages/LeadDetail';
import { ModulePage, ModalForm, RecordPanel, CustomerKyc } from '../pages/SalesPages';
import { createAndGetLeadNo } from '../leads-page/shared';
import { newLead, LeadData } from '../leads-page/test-data';
import { checklistValues, message as leadDetailMessage } from '../lead-detail/test-data';
import { ModuleData, fill } from './data';
import { createUnit, CreatedUnit, withSalesLock } from './inventory';

export type Buyer = { dataId: string; first: string; last: string; name: string; mobile: string; email: string };
export type Deal = {
  buyer: Buyer; leadNo: string; opportunity: string; stage: string;
  unit?: CreatedUnit; reservation?: string; proposal?: string; contract?: string;
};

/** Notes a value in the Excel report ("observed values" / "data used"). */
export type Note = (type: string, description: string) => void;

const NO = (prefix: string) => new RegExp(`\\b${prefix}-[A-Z0-9]+(?:-[A-Z0-9]+)*\\b`);

export class DealChain {
  constructor(readonly page: Page, readonly data: ModuleData, readonly note: Note = () => {}) {}

  private route(name: string) {
    return this.data.setting(name);
  }
  /** Field label → field name of a deal form (Deal Form Fields sheet). */
  names(form: 'Unit' | 'Reservation' | 'Proposal'): Record<string, string> {
    return this.data.formFields(form);
  }

  /** A lead for a buyer of the Buyers sheet: the Leads page data with the buyer's name and fictional contact details. */
  buyerLead(index = 0): { lead: LeadData; buyer: Buyer } {
    const rows = this.data.sheet('Buyers');
    const row = rows[index % rows.length];
    const first = row['First Name'], last = row['Last Name'];
    const ctx = { first, last };
    const lead = newLead('Individual');
    const values = { ...lead.values, Title: row['Title'], 'First Name': first, 'Last Name': last, Mobile: fill(row['Mobile'], ctx), Email: fill(row['Email'], ctx), 'Lead Source': row['Lead Source'] };
    const buyer: Buyer = { dataId: row['Data ID'], first, last, name: `${first} ${last}`, mobile: values.Mobile, email: values.Email };
    return { lead: { ...lead, values, first, last, name: buyer.name, contact: buyer.name, mobile: buyer.mobile, email: buyer.email }, buyer };
  }

  /** Lead → qualified → converted; returns the deal at the first opportunity stage. */
  async opportunity(index = 0): Promise<Deal> {
    const leads = new LeadsPage(this.page);
    // the fictional mobile range has 1,000 numbers: when the app says the number already belongs to a
    // customer ("Existing Customer"), try again with another number instead of linking to that customer
    let made: { lead: LeadData; buyer: Buyer; leadNo: string } | undefined;
    for (let attempt = 1; !made; attempt++) {
      const { lead, buyer } = this.buyerLead(index);
      try {
        made = { lead, buyer, leadNo: await createAndGetLeadNo(leads, lead) };
      } catch (e) {
        if (attempt >= 5) throw e;
        this.note('lead retry', `${buyer.mobile}: ${String(e).split('\n')[0].slice(0, 200)}`);
        await this.page.goto(this.page.url());
      }
    }
    const { buyer, leadNo } = made;
    const detail = new LeadDetail(this.page);
    await detail.waitOpen();
    await detail.qualify(checklistValues());
    const d = await leads.openLead(leadNo);
    await d.convert(leadDetailMessage('Convert Button'));
    const opps = new ModulePage(this.page, this.route('Opportunities Route'));
    await opps.open();
    const row = (await opps.rows()).find(r => r.text.includes(leadNo));
    const opportunity = row?.text.match(NO('OPP'))?.[0] ?? '';
    expect(opportunity, `Opportunity created from ${leadNo}`).not.toBe('');
    this.note('deal buyer', `${buyer.name} · ${buyer.mobile} · ${buyer.email} · lead ${leadNo} · opportunity ${opportunity}`);
    return { buyer, leadNo, opportunity, stage: 'Qualified' };
  }

  private async oppPanel(deal: Deal) {
    const opps = new ModulePage(this.page, this.route('Opportunities Route'));
    await opps.open();
    return opps.openRecord(deal.opportunity);
  }

  /** Runs one step of the Deal Steps sheet on the opportunity / reservation panel. */
  private async step(panel: RecordPanel, step: string) {
    const s = this.data.action('Deal Steps', step, 'Step');
    const seen = await panel.act(s.submit, s.fields);
    const bad = seen.find(n => n.kind === 'error');
    expect(bad, `${step}: ${bad?.text ?? ''}`).toBeUndefined();
    return seen;
  }

  /** Site visit → visit completed → Reservation Ready. */
  async toReservationReady(deal: Deal): Promise<Deal> {
    const panel = await this.oppPanel(deal);
    for (const step of ['Site Visit', 'Complete Visit', 'Reservation Ready']) await this.step(panel, step);
    await expect.poll(() => panel.status(), { timeout: 20_000 }).toBe(this.route('Reservation Ready Stage'));
    await panel.close();
    return { ...deal, stage: this.route('Reservation Ready Stage') };
  }

  /** New unit in the test project (Deal Unit sheet). */
  async unit(): Promise<CreatedUnit> {
    // {seq} is 3 random digits: on "Unit Not Saved" (code taken) try again with another code
    let made = await withSalesLock(() => createUnit(this.page, this.data, this.data.sheet('Deal Unit')[0], { names: this.names('Unit') }));
    for (let i = 0; i < 3 && !made.result.closed; i++) made = await withSalesLock(() => createUnit(this.page, this.data, this.data.sheet('Deal Unit')[0], { names: this.names('Unit') }));
    const { unit, result } = made;
    expect(result.closed, `Unit ${unit.code} created (${result.notice?.text ?? 'no message'})`).toBeTruthy();
    this.note('deal unit', `${unit.code} · ${unit.name} · ${unit.price}`);
    return unit;
  }

  /** Reservation of a new test unit for the opportunity, then approved. */
  async reserve(deal: Deal, opts: { approve?: boolean } = {}): Promise<Deal> {
    const unit = deal.unit ?? (await this.unit());
    const page = new ModulePage(this.page, this.route('Reservations Route'));
    await page.open();
    const form = new ModalForm(this.page);
    const s = this.data.action('Deal Steps', 'Reservation', 'Step');
    await form.open(this.route('New Reservation Button'));
    const f = this.names('Reservation');
    await form.set(f['Opportunity'], `~${deal.opportunity}`);
    await form.root.getByRole('button', { name: this.route('Choose Unit Button') }).click();
    const { UnitPicker } = await import('../pages/SalesPages');
    await new UnitPicker(this.page).choose(unit.code);
    // deposit = unit price × Deposit Percent (the form does not always fill it in; an empty deposit is saved as 0)
    const deposit = Math.round(unit.price * Number(this.route('Deposit Percent')) / 100);
    await this.page.waitForTimeout(800);
    if (!(await form.value(f['Deposit']).catch(() => ''))) await form.set(f['Deposit'], String(deposit));
    this.note('reservation deposit', `${await form.value(f['Deposit'])} (expected ${deposit})`);
    for (const [label, value] of Object.entries(s.fields)) await form.set(f[label], value);
    const r = await withSalesLock(() => form.submit(s.submit));
    expect(r.notices.find(n => n.kind === 'error'), `Reservation created (${r.notice?.text ?? 'no message'})`).toBeUndefined();
    await page.open();
    const reservation = (await page.rows()).find(x => x.text.includes(deal.opportunity))?.text.match(NO('RSV'))?.[0] ?? '';
    expect(reservation, `Reservation of ${deal.opportunity}`).not.toBe('');
    let out: Deal = { ...deal, unit, reservation, stage: 'Reserved' };
    if (opts.approve !== false) {
      const panel = await page.openRecord(reservation);
      await this.step(panel, 'Approve Reservation');
      await expect.poll(() => panel.status(), { timeout: 20_000 }).toBe(this.route('Reservation Approved Status'));
      await panel.close();
      out = { ...out, stage: 'Reservation Approved' };
    }
    this.note('deal reservation', `${reservation} · unit ${unit.code}`);
    return out;
  }

  /** Full chain up to an approved reservation (buyer `index` of the Buyers sheet). */
  async reservedDeal(index = 0): Promise<Deal> {
    return this.reserve(await this.toReservationReady(await this.opportunity(index)));
  }

  /** New Proposal with the values the form fills in from the reservation; returns its number. */
  async proposal(deal: Deal, proposalsRoute: string): Promise<Deal> {
    const page = new ModulePage(this.page, proposalsRoute);
    await page.open();
    const form = new ModalForm(this.page);
    await form.open(this.route('New Proposal Button'));
    const f = this.names('Proposal');
    await form.set(f['Opportunity'], `~${deal.opportunity}`);
    await expect.poll(() => form.value(f['Proposed Price']), { timeout: 15_000 }).not.toBe('');
    const r = await withSalesLock(() => form.submit(this.route('Create Proposal Button')));
    expect(r.notices.find(n => n.kind === 'error'), `Proposal created (${r.notice?.text ?? 'no message'})`).toBeUndefined();
    await page.open();
    const proposal = (await page.rows()).find(x => x.text.includes(deal.opportunity))?.text.match(NO('PRO'))?.[0] ?? '';
    expect(proposal, `Proposal of ${deal.opportunity}`).not.toBe('');
    this.note('deal proposal', proposal);
    return { ...deal, proposal };
  }

  /** Submit → Approve → Accept with the values of a step sheet ("Proposal Steps" / "Proposal Actions"). */
  async acceptProposal(deal: Deal, proposalsRoute: string, sheet: string): Promise<Deal> {
    const page = new ModulePage(this.page, proposalsRoute);
    for (const a of ['Submit', 'Approve', 'Accept']) {
      await page.open();
      const panel = await page.openRecord(deal.proposal!);
      const s = this.data.action(sheet, a);
      await panel.act(s.submit, s.fields);
      await panel.close();
    }
    return { ...deal, stage: 'Proposal Accepted' };
  }

  /** Uploads the KYC document of the data on the buyer (customer) and verifies it. */
  async approveKyc(deal: Deal) {
    const kyc = new CustomerKyc(this.page, this.route('Customers Route'));
    await kyc.open(deal.buyer.email);
    const doc = Object.fromEntries(this.data.sheet('KYC Document').map(r => [r['Field'], r['Value']]));
    if (!/approved/i.test(await kyc.status())) {
      await kyc.upload({ type: doc['Type'], number: fill(doc['Number']), expiry: doc['Expiry'], file: this.data.file(doc['File']) });
      await kyc.verify();
    }
    const status = await kyc.status();
    await kyc.close();
    this.note('buyer KYC', `${deal.buyer.name}: ${status}`);
    return status;
  }
}
