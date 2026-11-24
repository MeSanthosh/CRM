/**
 * Rule integration, Lead engines (ADM-101 … ADM-109): each combination publishes a rule, tests the Leads / Lead Detail
 * page that applies it, and publishes the original rule again (BusinessRulesPage.withRule, also when a check fails).
 * WRITES TO QA: rules change for a moment for every QA user, and leads are created.
 * Run: npx playwright test tests/admin-governance/integration-leads.spec.ts --workers=1
 */
import { test as base, expect, note, adm, admRow, S, sheet } from './shared';
import { LeadsPage } from '../pages/LeadsPage';
import { LeadForm } from '../pages/LeadForm';
import { LeadDetail } from '../pages/LeadDetail';
import { newLead, basicValues, LeadData } from '../leads-page/test-data';
import { createAndGetLeadNo } from '../leads-page/shared';
import { checklistValues, setting as ldSetting, message as ldMessage } from '../lead-detail/test-data';

const test = base.extend<{ leads: LeadsPage }>({ leads: async ({ page }, use) => { page.setDefaultTimeout(30_000); await use(new LeadsPage(page)); } });
const PUBLISH = () => S('Publish Button');
const QUALIFIED = () => ldSetting('Status After Qualify');
const on = (s: string) => String(s === 'On');
const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

/** Letters only (the app refuses digits in names), different on every call. */
function word() {
  const a = 'abcdefghijklmnopqrstuvwxyz';
  let s = a[Math.floor(Math.random() * 26)].toUpperCase();
  for (let i = 0; i < 9; i++) s += a[Math.floor(Math.random() * 26)];
  return s;
}
/** A new lead whose names exist nowhere else, so only the matches a test intends can happen. */
function uniqueLead(): LeadData {
  const l = newLead('Individual');
  const first = word(), last = word();
  return { ...l, name: `${first} ${last}`, values: { ...l.values, 'First Name': first, 'Last Name': last } };
}
/** Tries to create a lead with these values; returns whether it was saved and what the app said. */
async function attempt(page: LeadsPage['page'], values: Record<string, string>, extra: Record<string, string> = {}) {
  const f = new LeadForm(page, 'Individual');
  await f.open();
  const raised = await f.fill({ ...values, ...extra });
  const r = await f.submit();
  const said = [...raised.map(n => n.text), r.notice?.text ?? ''].filter(Boolean).join(' | ');
  await f.closeNotice();
  return { saved: r.saved, said };
}
async function openLead(leads: LeadsPage, no: string) { const d = await leads.openLead(no); await d.waitOpen(); return d; }

let existing: Promise<{ lead: LeadData; no: string }> | undefined;
const existingLead = (leads: LeadsPage) => existing ??= (async () => { const lead = uniqueLead(); return { lead, no: await createAndGetLeadNo(leads, lead) }; })();
let scored: Promise<string> | undefined;
const scoredLead = (leads: LeadsPage) => scored ??= createAndGetLeadNo(leads, uniqueLead());

test.describe('Admin & Governance · Rule integration · Leads', () => {
  test.describe.configure({ mode: 'default', timeout: 420_000 });

  sheet('Duplicate Rules').forEach((c, n) => {
    const min = c['Minimum Fields'];
    const mode = `${c['Match Mode']}${min ? ` (${min})` : ''}`;
    const what = `${mode}; first name ${c['First Name Check']}, last name ${c['Last Name Check']}`;
    test(...admRow('ADM-101', n + 1, what, 'Each variant is blocked or saved exactly as this rule says; same mobile or email is always blocked.', `Duplicate Rules row ${n + 1}`), async ({ rules, leads, page }) => {
      const { lead, no } = await existingLead(leads);
      const changes: [string, string][] = [['label:Match Mode', c['Match Mode']], ...(min ? [['number:0', min] as [string, string]] : []),
        ['rowcheck:First name', on(c['First Name Check'])], ['rowcheck:Last name', on(c['Last Name Check'])]];
      await rules.withRule('LEAD_DUPLICATE', PUBLISH(), changes, async () => {
        for (const v of sheet('Duplicate Variants')) {
          const same = split(v['Same As Existing Lead']);
          const fresh = uniqueLead();
          const values = basicValues(fresh);
          for (const k of same) values[k] = lead.values[k];
          const enabled = [...(c['First Name Check'] === 'On' ? ['First Name'] : []), ...(c['Last Name Check'] === 'On' ? ['Last Name'] : []), 'Mobile', 'Email'];
          const matched = same.filter(k => enabled.includes(k)).length;
          const always = same.includes('Mobile') || same.includes('Email');
          const blocked = always || (c['Match Mode'].startsWith('All') ? matched === enabled.length : c['Match Mode'].startsWith('Any') ? matched >= 1 : matched >= Number(min));
          const r = await attempt(page, values);
          note(v['Variant'], `${r.saved ? 'saved' : 'refused'} · ${r.said}`);
          expect.soft(r.saved, `${what} · ${v['Variant']}: ${blocked ? 'blocked' : 'saved'}`).toBe(!blocked);
          // mobile and email belong to one lead only; a name can also match leads saved by earlier combinations (the app names the newest)
          if (blocked && always) expect.soft(r.said, `${v['Variant']}: the message names the existing lead`).toContain(no);
          else if (blocked) expect.soft(r.said, `${v['Variant']}: the message names an existing lead`).toMatch(/Existing lead: LD-[A-Z0-9-]+/);
        }
      });
    });
  });

  const criteria = () => sheet('Scoring Criteria').map(c => c['Criterion']);

  criteria().forEach((name, i) => {
    const next = criteria()[(i + 1) % criteria().length];
    test(...admRow('ADM-102', i + 1, `${name} −2, ${next} +2`, 'Every item shows the published maximum and the breakdown adds up.', `Scoring Criteria row ${i + 1}`), async ({ rules, leads }) => {
      const no = await scoredLead(leads);
      await rules.open('LEAD_SCORING');
      const a = Number(await rules.read(`rownum:${name}:0`)), b = Number(await rules.read(`rownum:${next}:0`));
      const want: Record<string, number> = {};
      for (const c of criteria()) want[c] = Number(await rules.read(`rownum:${c}:0`));
      want[name] = a - 2; want[next] = b + 2;
      await rules.withRule('LEAD_SCORING', PUBLISH(), [[`rownum:${name}:0`, String(a - 2)], [`rownum:${next}:0`, String(b + 2)]], async () => {
        const d = await openLead(leads, no);
        await d.recalculate();
        const br = await d.scoreBreakdown();
        note('breakdown', JSON.stringify(br));
        for (const c of criteria()) expect.soft(br.items.find(x => x.name === c)?.max, `${c}: maximum on the lead = the published maximum`).toBe(want[c]);
        for (const x of br.items) expect.soft(x.points, `${x.name}: points within the maximum`).toBeLessThanOrEqual(x.max);
        expect.soft(br.items.reduce((s, x) => s + x.points, 0), 'The breakdown adds up to the computed score').toBe(br.computed);
        await d.close();
      });
    });
  });

  criteria().forEach((name, i) => {
    const next = criteria()[(i + 1) % criteria().length];
    test(...admRow('ADM-103', i + 1, `${name} disabled`, `${name} is not counted; ${next} shows its new maximum.`, `Scoring Criteria row ${i + 1}`), async ({ rules, leads }) => {
      const no = await scoredLead(leads);
      await rules.open('LEAD_SCORING');
      const a = Number(await rules.read(`rownum:${name}:0`)), b = Number(await rules.read(`rownum:${next}:0`));
      await rules.withRule('LEAD_SCORING', PUBLISH(), [[`rowcheck:${name}`, 'false'], [`rownum:${next}:0`, String(a + b)]], async () => {
        const d = await openLead(leads, no);
        await d.recalculate();
        const br = await d.scoreBreakdown();
        note('breakdown', JSON.stringify(br));
        const item = br.items.find(x => x.name === name);
        expect.soft(item?.points ?? 0, `${name} scores nothing while disabled`).toBe(0);
        expect.soft(br.items.find(x => x.name === next)?.max, `${next}: new maximum`).toBe(a + b);
        expect.soft(br.items.reduce((s, x) => s + x.points, 0), 'The breakdown adds up to the computed score').toBe(br.computed);
        await d.close();
      });
    });
  });

  // the score a lead gets when the checklist is filled: measured once, with no minimum in force
  let measured: Promise<number> | undefined;
  const checklistScore = (leads: LeadsPage, rules: Parameters<Parameters<typeof test>[2]>[0]['rules']) => measured ??= rules.withRule('LEAD_QUALIFICATION', PUBLISH(), [['label:Auto-qualify minimum score', '0']], async () => {
    const no = await createAndGetLeadNo(leads, uniqueLead());
    const d = await openLead(leads, no);
    await d.qualify(checklistValues());
    const again = await openLead(leads, no);
    const top = (await again.historyEntries('Status History'))[0]?.text ?? '';
    await again.close();
    return Number(top.match(/(\d+)\s*$/)?.[1] ?? NaN);
  });

  sheet('Qualification Cases').forEach((c, n) => {
    test(...admRow('ADM-104', n + 1, c['Case'], c['Expected'] === 'qualify' ? 'Qualified with no warning.' : c['Expected'] === 'warn' ? 'The published warning; Cancel keeps the lead; Qualify Anyway qualifies it.' : 'Not qualified; a message says so.', `Qualification Cases row ${n + 1}`), async ({ rules, leads }) => {
      const score = ['exact', 'above'].includes(c['Minimum Score']) ? await checklistScore(leads, rules) : 0;
      expect(Number.isFinite(score), 'The checklist score could be measured').toBeTruthy();
      const min = { top: 100, zero: 0, exact: score, above: score + 1 }[c['Minimum Score']]!;
      note('minimum score / score of the checklist', `${min} / ${score || 'not needed'}`);
      const no = await createAndGetLeadNo(leads, uniqueLead());
      await rules.withRule('LEAD_QUALIFICATION', PUBLISH(), [['label:Auto-qualify minimum score', String(min)], ['check:Allow manual qualify', on(c['Allow Manual'])], ['label:Warning message', S('Warning Text')]], async () => {
        const d = await openLead(leads, no);
        for (const [k, v] of checklistValues()) await d.set(k, v);
        const shown = await d.press('Qualify lead', true);
        note('pop-up', `${shown?.title} · ${shown?.text} · ${shown?.buttons}`);
        const warned = shown?.title === S('Qualify Warning Title');
        if (c['Expected'] === 'qualify') {
          expect.soft(warned, 'No warning').toBeFalsy();
          expect.soft(shown?.title, 'Qualified').toBe(ldMessage('Qualified Title'));
          if (shown) await d.notice.close();
        } else if (c['Expected'] === 'warn') {
          expect(warned, 'The warning pop-up appears').toBeTruthy();
          expect.soft(shown?.text ?? '', 'The published warning text').toContain(S('Warning Text'));
          await d.notice.close(S('Qualify Cancel Button'));
          expect.soft(await d.statusChip(), 'Cancel: not qualified').not.toBe(QUALIFIED());
          await (await d.press('Qualify lead', true));
          await d.notice.close(S('Qualify Anyway Button'));
          const done = await d.notice.wait(30_000);
          if (done) await d.notice.close();
        } else {
          expect.soft(shown, 'A message explains why').toBeTruthy();
          expect.soft(shown?.buttons ?? [], 'No way to qualify anyway').not.toContain(S('Qualify Anyway Button'));
          expect.soft(shown?.title, 'Not qualified').not.toBe(ldMessage('Qualified Title'));
          if (shown) await d.notice.close();
        }
        const after = await openLead(leads, no);
        const status = await after.statusChip();
        note('status after', status);
        expect.soft(status === QUALIFIED(), `Lead ${c['Expected'] === 'refuse' ? 'is not' : 'is'} qualified`).toBe(c['Expected'] !== 'refuse');
        await after.close();
      });
    });
  });

  /** Bands that put score `c` in the wanted band and still cover 0–100 with no gaps. */
  function bandsFor(band: string, c: number): [string, string][] {
    const off = { HOT: 0, WARM: 1, COLD: 2, NURTURE: 3 }[band]!;
    const hotMin = c + off, warm = hotMin - 1, cold = warm - 1;
    return [['rownum:HOT:0', String(hotMin)], ['rownum:HOT:1', '100'], ['rownum:WARM:0', String(warm)], ['rownum:WARM:1', String(warm)],
      ['rownum:COLD:0', String(cold)], ['rownum:COLD:1', String(cold)], ['rownum:NURTURE:0', '0'], ['rownum:NURTURE:1', String(cold - 1)]];
  }

  sheet('Band Cases').forEach((c, n) => {
    test(...admRow('ADM-105', n + 1, `Score in ${c['Band']}, auto-apply ${c['Auto Apply']}`, `Suggested rating ${c['Suggested Rating']}; Current rating ${c['Auto Apply'] === 'On' ? 'takes it' : 'does not change'}.`, `Band Cases row ${n + 1}`), async ({ rules, leads }) => {
      const no = await createAndGetLeadNo(leads, uniqueLead());
      const d0 = await openLead(leads, no);
      await d0.recalculate();
      const score = (await d0.scoreBreakdown()).computed;
      await d0.close();
      test.skip(score < 3, `Score ${score} leaves no room for the lower bands`);
      await rules.withRule('LEAD_CLASSIFICATION', PUBLISH(), [...bandsFor(c['Band'], score), ['check:Auto-apply suggested rating', on(c['Auto Apply'])]], async () => {
        const d = await openLead(leads, no);
        await d.recalculate();
        const br = await d.scoreBreakdown();
        note('score / suggested / current', `${br.computed} / ${br.suggested} / ${br.current}`);
        expect.soft(br.suggested, 'Suggested rating = the band that holds the score').toBe(c['Suggested Rating']);
        if (c['Auto Apply'] === 'On') {
          expect.soft(br.current, 'Current rating takes the suggestion').toContain(c['Suggested Rating']);
          expect.soft(await d.selected('Rating'), 'Rating dropdown').toContain(c['Suggested Rating']);
        } else expect.soft(br.current, 'Current rating stays').toBe(S('Empty Rating'));
        await d.close();
      });
    });
  });

  test(...adm('ADM-106'), async ({ rules, leads, page }) => {
    const no = await createAndGetLeadNo(leads, uniqueLead());
    const d0 = await openLead(leads, no);
    await d0.recalculate();
    const before = await d0.scoreBreakdown();
    await d0.close();
    const band = before.suggested.toUpperCase();
    await rules.withRule('LEAD_CLASSIFICATION', PUBLISH(), [[`rowtext:${band}`, S('Band Label Text')]], async () => {
      const d = await openLead(leads, no);
      await d.recalculate();
      const text = await page.locator('section.crm-lead-detail-modal').innerText();
      const line = text.split('\n').find(l => /Suggested rating/.test(l)) ?? '';
      note('suggested rating line', line);
      expect(text, 'The lead shows the published label').toContain(S('Band Label Text'));
      await d.close();
    });
  });

  // ── Date of Birth ──
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function ageDate(years: number, days = 0) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setFullYear(d.getFullYear() - years); d.setDate(d.getDate() + days); return d; }
  const dateOf = (kind: string, min: number, max: number): Date | undefined => ({
    min: ageDate(min), under: min > 0 ? ageDate(min, 1) : undefined, max: ageDate(max + 1, 1), over: ageDate(max + 1), future: ageDate(0, 1),
  } as Record<string, Date | undefined>)[kind];

  sheet('DOB Rules').forEach((c, n) => {
    test(...admRow('ADM-107', n + 1, `minimum ${c['Minimum Age']}, maximum ${c['Maximum Age']}`, 'Dates inside the published ages are saved; dates outside them and future dates are refused.', `DOB Rules row ${n + 1}`), async ({ rules, leads, page }) => {
      void leads;
      const [min, max] = [Number(c['Minimum Age']), Number(c['Maximum Age'])];
      await rules.withRule('DATE_OF_BIRTH', PUBLISH(), [['label:Minimum age', String(min)], ['label:Maximum age', String(max)]], async () => {
        for (const v of sheet('DOB Values')) {
          const date = dateOf(v['Date Kind'], min, max);
          if (!date) { note(v['Value'], 'not applicable to this rule'); continue; }
          const r = await attempt(page, basicValues(uniqueLead()), { 'Date of Birth': iso(date) });
          note(v['Value'], `${iso(date)} · ${r.saved ? 'saved' : 'refused'} · ${r.said}`);
          expect.soft(r.saved, `${v['Value']} (${iso(date)}): ${v['Accepted'] === 'Yes' ? 'saved' : 'refused'}`).toBe(v['Accepted'] === 'Yes');
          if (v['Accepted'] !== 'Yes') expect.soft(r.said, `${v['Value']}: a message says why`).not.toBe('');
        }
      });
    });
  });

  test(...adm('ADM-108'), async ({ rules, leads, page }) => {
    const r = sheet('DOB Rules').find(x => x['Minimum Age'] === '30')!;
    const lead = uniqueLead();
    const made = await attempt(page, basicValues(lead), { 'Date of Birth': iso(ageDate(Number(r['Minimum Age']) + 5)) });
    expect(made.saved, `Lead saved with a valid date of birth (${made.said})`).toBeTruthy();
    await rules.withRule('DATE_OF_BIRTH', PUBLISH(), [['label:Minimum age', r['Minimum Age']], ['label:Maximum age', r['Maximum Age']]], async () => {
      await leads.openRoute();
      const rows = await leads.find(lead.values['Email']);
      expect(rows.length, 'The lead is listed').toBe(1);
      const f = await leads.editLead(rows[0].leadNo, 'Individual');
      await f.set('Date of Birth', iso(ageDate(Number(r['Minimum Age']), 1)));
      const raised = await f.notice.dismiss(500);
      await page.getByRole('button', { name: /^(Save|Update)/ }).last().click();
      const n = raised ?? await f.notice.wait(30_000);
      note('pop-up', `${n?.title} · ${n?.text}`);
      expect.soft(n, 'A message says why').toBeTruthy();
      expect.soft(n?.title ?? '', 'The date is not saved').not.toMatch(/Updated|Saved/i);
      if (await f.notice.visible()) await f.notice.close();
      await page.goto('/leads');
    });
  });

  test(...adm('ADM-109'), async ({ rules, leads, page }) => {
    const r = sheet('DOB Rules').find(x => x['Minimum Age'] === '30')!;
    const lead = uniqueLead();
    const dob = iso(ageDate(Number(r['Minimum Age']) - 5));
    const made = await attempt(page, basicValues(lead), { 'Date of Birth': dob });
    expect(made.saved, `Lead saved with its date of birth (${made.said})`).toBeTruthy();
    await leads.openRoute();
    const rows = await leads.find(lead.values['Email']);
    expect(rows.length, 'The lead is listed').toBe(1);
    await rules.withRule('DATE_OF_BIRTH', PUBLISH(), [['label:Minimum age', r['Minimum Age']], ['label:Maximum age', r['Maximum Age']]], async () => {
      // what the backend holds: the panel does not always show the date, so a blank field proves nothing
      const stored: string[] = [];
      page.on('response', async x => {
        if (x.request().method() !== 'GET' || !/\/api\/.*leads/.test(x.url())) return;
        const m = (await x.text().catch(() => '')).match(/"dateOfBirth":"([^"]+)"/);
        if (m) stored.push(m[1]);
      });
      const d = await openLead(leads, rows[0].leadNo);
      await expect.poll(() => stored.join(' '), { message: 'The backend holds the date of birth typed', timeout: 20_000 }).toContain(dob);
      note('date of birth typed / shown on the lead / held by the backend', `${dob} / ${await d.value('Date of Birth').catch(() => 'not shown')} / ${stored[0]}`);
      for (const [k, v] of checklistValues()) await d.set(k, v);
      const n = await d.press('Qualify lead', true);
      note('pop-up', `${n?.title} · ${n?.text}`);
      if (n) await d.notice.close(n.buttons[n.buttons.length - 1]);
      const after = await openLead(leads, rows[0].leadNo);
      const status = await after.statusChip();
      note('status after', status);
      expect.soft(status, 'Not qualified with a date of birth outside the rule').not.toBe(QUALIFIED());
      expect.soft(n?.text ?? '', 'The message names the date of birth').toMatch(/birth|age/i);
      await after.close();
    });
  });
});
