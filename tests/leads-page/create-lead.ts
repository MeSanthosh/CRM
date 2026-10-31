/**
 * Test declarations shared by the Individual (HLUC-01) and Corporate (HLUC-02) create-lead specs.
 * Each spec passes its own case IDs; every value comes from TestData/Leads_Test_Data.xlsx.
 */
import { test, expect, note, createLead, createAndGetLeadNo, fillBasic, todayShown, withLeadsLock } from './shared';
import { lp, lpRow, caseOf } from './catalog';
import { Form, LeadData, newLead, variantOf, mandatoryFields, invalidValues, message, setting, leadNoPattern, describe as describeLead, field, actionValue } from './test-data';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadForm } from '../pages/LeadForm';

export type CreateIds = {
  open: string; markers: string; empty: string; eachMandatory: string; formats: string[]; score: string;
  create: string; leadNo: string; owner: string; lists: string; profile?: string;
  dupExact: string; dupWording: string; dupCase?: string; sameMobile: string; sameEmail: string; sameName?: string; close: string;
};

/** One lead per worker and form, created by the first test that needs it and reused by the next ones. */
const created: Partial<Record<Form, Promise<{ lead: LeadData; leadNo: string }>>> = {};
function sharedLead(leads: LeadsPage, form: Form) {
  return (created[form] ??= (async () => {
    const lead = newLead(form);
    return { lead, leadNo: await createAndGetLeadNo(leads, lead) };
  })().catch(e => { delete created[form]; throw e; }));
}

/** Submits a form that should be refused; checks the pop-up and that nothing was saved. */
async function expectRefused(form: LeadForm, expectedText: string | RegExp, what: string) {
  const r = await form.submit();
  note('pop-up', r.notice?.text ?? 'none');
  expect.soft(r.saved, `${what}: no lead may be saved (save request status ${r.status ?? 'not sent'})`).toBeFalsy();
  expect(r.notice?.text ?? 'no pop-up', `${what}: pop-up`).toEqual(typeof expectedText === 'string' ? expect.stringContaining(expectedText) : expect.stringMatching(expectedText));
  await form.closeNotice();
  return r;
}

export function declareCreateTests(form: Form, ids: CreateIds) {
  const TYPE_LABEL = setting(`${form} Type Label`);

  test.describe(`Leads page · Create ${form} Lead`, () => {
    test.describe.configure({ timeout: 600_000 }); // includes waiting for the leads lock

    test(...lp(ids.open), async ({ leads }) => {
      await leads.openRoute();
      const f = await leads.startCreate(form);
      expect.soft(leads.page.url(), 'Form address').toContain(`/leads/${f.kind}/new`);
      const heading = await f.heading();
      expect.soft(heading, 'Form heading').toMatch(new RegExp(`^Create ${form}`));
      const sections = (await f.sections()).map(s => s.toLowerCase());
      for (const s of caseOf(ids.open).expected.match(/sections (.+?), and the buttons/)![1].split(/, | and /))
        expect.soft(sections, `Section "${s}"`).toContain(s.trim().toLowerCase());
      for (const b of ['Close', 'Create Lead']) expect.soft(await f.buttonVisible(b), `Button "${b}"`).toBeTruthy();
    });

    test(...lp(ids.markers), async ({ leads }) => {
      const f = new LeadForm(leads.page, form);
      await f.open();
      const marked = await f.requiredLabels();
      note('marked required', marked.join(', '));
      for (const m of mandatoryFields(form)) expect.soft(marked, `"${m.label}" marked with *`).toContain(m.label);
      const extra = marked.filter(l => !mandatoryFields(form).some(m => m.label === l));
      expect.soft(extra, 'Fields marked * that the use case does not list as mandatory').toEqual([]);
    });

    test(...lp(ids.empty), async ({ leads }) => {
      const f = new LeadForm(leads.page, form);
      await f.open();
      const r = await f.submit();
      note('pop-up', r.notice?.text ?? 'none');
      expect.soft(r.saved, 'No lead saved').toBeFalsy();
      expect.soft(r.notice?.title, 'Pop-up title').toBe(message('Required Title'));
      const listed = (r.notice?.text ?? '').split('•').slice(1).map(s => s.replace(/\bOK\s*$/, '').trim());
      expect(listed, 'Fields listed as missing').toEqual(mandatoryFields(form).map(m => m.label));
      await f.closeNotice();
      expect(await f.buttonVisible('Create Lead'), 'Form stays open').toBeTruthy();
    });

    mandatoryFields(form).forEach((m, i) => {
      test(...lpRow(ids.eachMandatory, i + 1, `${m.label} left empty`, `"${message('Required Title')}" names only "${m.label}"; no lead is saved`, `Field: ${m.label}`), async ({ leads }) => {
        const lead = newLead(form);
        const f = new LeadForm(leads.page, form);
        await f.open();
        await fillBasic(f, lead);
        await f.clear(m.label);
        const r = await expectRefused(f, message('Required Title'), `${m.label} empty`);
        const listed = (r.notice?.text ?? '').split('•').slice(1).map(s => s.replace(/\bOK\s*$/, '').trim());
        expect(listed, 'Fields listed as missing').toEqual([m.label]);
      });
    });

    for (const caseId of ids.formats) {
      invalidValues(caseId).filter(v => v.form === form).forEach((v, i) => {
        test(...lpRow(caseId, i + 1, `${v.label} = "${v.value}"`, `Pop-up "${message('Invalid Title')}": ${v.message} No lead is saved.`, `${v.label} = ${v.value}`), async ({ leads }) => {
          const lead = newLead(form);
          const f = new LeadForm(leads.page, form);
          await f.open();
          await fillBasic(f, lead);
          await f.set(v.label, v.value);
          // email / phone are checked when the field loses focus, the rest when Create Lead is pressed
          const onLeave = await f.notice.wait(v.onBlur ? 4_000 : 800);
          if (onLeave) {
            note('pop-up on leaving the field', onLeave.text);
            await f.notice.close();
          }
          const r = await withLeadsLock(() => f.submit()); // a wrongly accepted value would save a lead
          note('pop-up on Create Lead', r.notice?.text ?? 'none');
          await f.closeNotice();
          expect.soft(r.saved, `No lead may be saved with ${v.label} = "${v.value}"`).toBeFalsy();
          expect(onLeave?.text ?? r.notice?.text ?? 'no pop-up', `Message for ${v.label}`).toContain(v.message);
        });
      });
    }

    test(...lp(ids.score), async ({ leads }) => {
      const f = new LeadForm(leads.page, form);
      await f.open();
      expect.soft(await f.isEditable('Score'), 'Score can be edited').toBeFalsy();
      expect(await f.placeholder('Score'), 'Score placeholder').toBe(message('Score Placeholder'));
    });

    test(...lp(ids.create), async ({ leads }) => {
      const lead = newLead(form);
      const { form: f, result } = await createLead(leads, lead);
      expect(result.saved, `Lead saved (pop-up: ${result.notice?.text ?? 'none'})`).toBeTruthy();
      expect.soft(result.notice?.title, 'Pop-up title').toBe(message('Created Title'));
      expect.soft(result.notice?.text ?? '', 'Pop-up text').toContain(message('Created Body', { name: lead.contact }));
      await f.closeNotice();
      const d = f.detail();
      await d.waitOpen();
      const no = await d.leadNo();
      note('lead created', `${no} · ${lead.name}`);
      expect.soft(no, 'Lead No. format').toMatch(leadNoPattern());
      const text = (await d.root.innerText()).replace(/\s+/g, ' ');
      expect.soft(text, 'Detail shows the name').toContain(lead.name);
      expect.soft(text.replace(/\s/g, ''), 'Detail shows the mobile').toContain(lead.mobile.replace(/\s/g, ''));
      expect.soft(text, 'Detail shows the email').toContain(lead.email);
      expect.soft(text, 'Detail shows the lead source').toContain(lead.values['Lead Source']);
    });

    test(...lp(ids.leadNo), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      await leads.openRoute();
      const rows = await leads.find(lead.email);
      expect(rows.map(r => r.leadNo), 'Lead found by email').toEqual([leadNo]);
      expect.soft(rows[0].leadNo, 'Lead No. format').toMatch(leadNoPattern());
      // the score is calculated just after the save
      let score = rows[0].score;
      for (let i = 0; i < 6 && !/^\d+$/.test(score); i++) {
        await leads.page.waitForTimeout(2000);
        score = (await leads.find(lead.email))[0]?.score ?? '';
      }
      note('score', score);
      expect(score, 'Score is a number').toMatch(/^\d+$/);
      expect(Number(score), 'Score 0–100').toBeLessThanOrEqual(100);
    });

    test(...lp(ids.owner), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      await leads.openRoute();
      const me = await leads.signedInUser();
      note('signed-in user', me);
      const rows = await leads.find(lead.email);
      expect.soft(rows[0]?.assigned, 'Assigned column').toBe(me);
      const d = await leads.openLead(leadNo);
      expect.soft(await d.value('Assigned'), 'ASSIGNED in Lead Detail').toBe(me);
      expect(await d.history('Owner History'), 'Owner History').toMatch(new RegExp(`${me}.*Assigned during lead creation`, 'i'));
    });

    test(...lp(ids.lists), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      for (const tab of ['All Leads', 'My Leads']) {
        await leads.openRoute(tab === 'All Leads' ? '/leads' : '/leads/my');
        const rows = await leads.find(lead.email);
        expect.soft(rows.map(r => r.leadNo), `${tab}: listed once`).toEqual([leadNo]);
        if (!rows[0]) continue;
        expect.soft(rows[0].type, `${tab}: Type`).toBe(TYPE_LABEL);
        expect.soft(rows[0].status, `${tab}: Status`).toBe(setting('New Lead Status'));
        expect.soft(todayShown(), `${tab}: Captured = today (${rows[0].captured})`).toContain(rows[0].captured);
      }
      await leads.openRoute();
      await leads.typeChip(form);
      const rows = await leads.find(lead.email);
      expect(rows.map(r => r.leadNo), `Listed under the ${form} chip`).toEqual([leadNo]);
    });

    if (ids.profile) test(...lp(ids.profile), async ({ leads }) => {
      const lead = newLead(form);
      const { form: f, result } = await createLead(leads, lead, { all: true });
      expect(result.saved, `Lead saved (pop-up: ${result.notice?.text ?? 'none'})`).toBeTruthy();
      await f.closeNotice();
      const d = f.detail();
      await d.waitOpen();
      note('lead created', await d.leadNo());
      const budget = lead.values['Budget'];
      if (budget) expect.soft(await d.value('Budget'), 'BUDGET in Lead Detail').toMatch(/\d/);
      if (lead.values['Timeline']) expect.soft(await d.value('Timeline'), 'TIMELINE in Lead Detail').toBe(lead.values['Timeline']);
    });

    test(...lp(ids.dupExact), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      await leads.openRoute();
      const before = await leads.tabCount('All Leads');
      const f = new LeadForm(leads.page, form);
      await f.open();
      await fillBasic(f, lead);
      const r = await withLeadsLock(() => expectRefused(f, message('Duplicate Title'), 'Exact duplicate'));
      expect.soft(r.notice?.text ?? '', 'Pop-up names the existing lead').toContain(leadNo);
      await leads.openRoute();
      expect.soft((await leads.find(lead.email)).length, 'Still one lead with this email').toBe(1);
      note('All Leads before / after', `${before} / ${await leads.tabCount('All Leads')}`);
    });

    test(...lp(ids.dupWording), async ({ leads }) => {
      const { lead } = await sharedLead(leads, form);
      const f = new LeadForm(leads.page, form);
      await f.open();
      await fillBasic(f, lead);
      await withLeadsLock(() => expectRefused(f, message('Duplicate Use Case Text'), 'Duplicate message wording'));
    });

    if (ids.dupCase) test(...lp(ids.dupCase), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      const shouted: LeadData = { ...lead, values: Object.fromEntries(Object.entries(lead.values).map(([k, v]) =>
        [k, k === 'Mobile' ? v.replace(/\s/g, '') : field(form, k).type === 'Text' ? v.toUpperCase() : v])) };
      note('test data', describeLead(shouted));
      const f = new LeadForm(leads.page, form);
      await f.open();
      await fillBasic(f, shouted);
      const r = await withLeadsLock(() => f.submit());
      note('pop-up', r.notice?.text ?? 'none');
      expect.soft(r.saved, 'Not saved').toBeFalsy();
      expect(r.notice?.text ?? '', 'Recognised as the existing lead').toContain(leadNo);
      await f.closeNotice();
    });

    test(...lp(ids.sameMobile), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      const other = variantOf(lead, ['mobile']);
      note('test data', describeLead(other));
      const f = new LeadForm(leads.page, form);
      await f.open();
      await fillBasic(f, other);
      const r = await withLeadsLock(() => expectRefused(f, message('Mobile Used'), 'Mobile already used'));
      expect.soft(r.notice?.text ?? '', 'Pop-up names the existing lead').toContain(leadNo);
    });

    test(...lp(ids.sameEmail), async ({ leads }) => {
      const { lead, leadNo } = await sharedLead(leads, form);
      const other = variantOf(lead, ['email']);
      note('test data', describeLead(other));
      const f = new LeadForm(leads.page, form);
      await f.open();
      await fillBasic(f, other);
      const r = await withLeadsLock(() => expectRefused(f, message('Email Used'), 'Email already used'));
      expect.soft(r.notice?.text ?? '', 'Pop-up names the existing lead').toContain(leadNo);
    });

    if (ids.sameName) test(...lp(ids.sameName), async ({ leads }) => {
      const { lead } = await sharedLead(leads, form);
      const namesake = variantOf(lead, ['name']);
      const { form: f, result } = await createLead(leads, namesake);
      expect.soft(result.notice?.title, 'Pop-up title').toBe(message('Created Title'));
      expect(result.saved, `A second "${lead.name}" with other contacts is saved (pop-up: ${result.notice?.text ?? 'none'})`).toBeTruthy();
      await f.closeNotice();
    });

    test(...lp(ids.close), async ({ leads }) => {
      const lead = newLead(form);
      await leads.openRoute();
      const f = await leads.startCreate(form);
      await fillBasic(f, lead);
      const asked = await f.close(actionValue('Close Form', 'Confirm Button'));
      note('pop-up', asked?.text ?? 'none');
      expect.soft(asked?.title, 'Discard question').toBe(message('Discard Title'));
      await expect(leads.page, 'Back on the Leads list').toHaveURL(/\/leads(\?.*)?$/);
      expect(await leads.find(lead.email), 'Nothing saved').toEqual([]);
    });
  });
}
