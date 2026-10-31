/** Lead details & Copy link (LDP-001 … LDP-007) and Workflow Status (LDP-011 … LDP-014). */
import { test, expect, note, ldp, freshLead, workerLead, digits } from './shared';
import { setting, workflow, workflowStages, checklistValues, statusChanges, message } from './test-data';
import { createLead } from '../leads-page/shared';
import { newLead, setting as leadsSetting } from '../leads-page/test-data';

const newLeadStatus = () => leadsSetting('New Lead Status');
import { LeadDetail } from '../pages/LeadDetail';
import { download, parseNum } from '../helpers';
import { XP, at } from '../locators';

test.describe('Lead Detail · Details and Copy link', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-001'), async ({ leads }) => {
    const { lead, leadNo, detail } = await workerLead(leads);
    expect.soft(await detail.leadNo(), 'Lead No. in the header').toBe(leadNo);
    expect(await detail.headerName(), 'Name in the header').toBe(lead.name);
  });

  test(...ldp('LDP-002'), async ({ leads }) => {
    const { lead, detail } = await workerLead(leads);
    const me = await leads.signedInUser();
    const shown = Object.fromEntries(await Promise.all(['Prospect Type', 'Title', 'Phone', 'Email', 'Source', 'Assigned', 'Budget'].map(async c => [c, await detail.value(c)])));
    note('summary', JSON.stringify(shown));
    expect.soft(shown['Prospect Type'], 'PROSPECT TYPE').toBe(setting('Individual Prospect Type'));
    expect.soft(shown['Title'], 'TITLE').toBe(lead.values['Title']);
    expect.soft(digits(shown['Phone']), 'PHONE').toBe(digits(lead.mobile));
    expect.soft(shown['Email'], 'EMAIL').toBe(lead.email);
    expect.soft(shown['Source'], 'SOURCE').toBe(lead.values['Lead Source']);
    expect.soft(shown['Assigned'], '"Assigned to" under the name').toBe(me);
    expect.soft(await detail.statusChip(), 'Status pill').toBe(newLeadStatus());
    expect(shown['Budget'], 'BUDGET').toBe(setting('Empty Budget'));
  });

  test(...ldp('LDP-003'), async ({ leads }) => {
    const lead = newLead('Individual');
    const { form, result } = await createLead(leads, lead, { all: true });
    expect(result.saved, `Lead saved (${result.notice?.text ?? 'no pop-up'})`).toBeTruthy();
    await form.closeNotice();
    const leadNo = await form.detail().leadNo();
    const detail = await leads.openLead(leadNo);
    const budget = await detail.value('Budget'), timeline = await detail.value('Timeline');
    note('budget / timeline', `${budget} / ${timeline}`);
    expect.soft(parseNum(budget), `BUDGET ${budget} = ${lead.values['Budget']}`).toBeCloseTo(Number(lead.values['Budget']), -3);
    expect(timeline, 'TIMELINE').toBe(lead.values['Timeline']);
  });

  test(...ldp('LDP-004'), async ({ leads }) => {
    const { lead, leadNo, detail } = await workerLead(leads);
    const panel = { name: await detail.headerName(), phone: await detail.value('Phone'), email: await detail.value('Email'), source: await detail.value('Source'),
      status: await detail.statusChip(), assigned: await detail.value('Assigned') };
    await detail.close();
    const row = (await leads.find(leadNo))[0];
    const file = await download(leads.page, at(leads.page, XP.leadsExport));
    const x = file.rows.find(r => String(r['Lead No']) === leadNo) ?? {};
    note('panel / list / export', `${JSON.stringify(panel)} | ${JSON.stringify(row)} | ${JSON.stringify(x)}`);
    expect(row, 'Lead listed').toBeTruthy();
    expect(file.rows.length, 'Export of the search holds one row').toBe(1);
    for (const [what, a, b, c] of [
      ['Name', panel.name, row.name, x['Name']], ['Lead No.', leadNo, row.leadNo, x['Lead No']],
      ['Mobile', digits(panel.phone), digits(row.phone), digits(String(x['Mobile'] ?? ''))], ['Email', panel.email, row.email, x['Email']],
      ['Source', panel.source, row.source, x['Source']], ['Status', panel.status, row.status, x['Status']], ['Owner', panel.assigned, row.assigned, x['Assigned To']],
    ] as [string, unknown, unknown, unknown][]) {
      expect.soft(String(b), `${what}: list = panel`).toBe(String(a));
      expect.soft(String(c), `${what}: export = panel`).toBe(String(a));
    }
    expect.soft(String(x['Score']), 'Score: export = list').toBe(row.score);
    expect(lead.email, 'The lead created by the test').toBe(panel.email);
  });

  test(...ldp('LDP-005'), async ({ leads, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    const { detail } = await workerLead(leads);
    const link = await detail.copyLink();
    note('copied', link);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${esc(setting('Copy Link Pattern')).replace(esc('{base}'), esc(baseURL!)).replace(esc('{id}'), '[0-9a-f-]{36}')}$`);
    expect(link, 'Copied link').toMatch(pattern);
  });

  test(...ldp('LDP-006'), async ({ leads, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    const { lead, leadNo, detail } = await workerLead(leads);
    const link = await detail.copyLink();
    await leads.page.goto('about:blank');
    await leads.page.goto(link);
    const opened = new LeadDetail(leads.page);
    await opened.waitOpen();
    expect.soft(await opened.leadNo(), 'Lead No. opened by the link').toBe(leadNo);
    expect(await opened.headerName(), 'Name opened by the link').toBe(lead.name);
  });

  test(...ldp('LDP-008'), async ({ leads }) => {
    const lead = newLead('Individual');
    const { form, result } = await createLead(leads, lead, { all: true });
    expect(result.saved, `Lead saved (${result.notice?.text ?? 'no pop-up'})`).toBeTruthy();
    await form.closeNotice();
    const detail = await leads.openLead(await form.detail().leadNo());
    const text = await detail.extraDetails();
    note('additional details', text.replace(/\n+/g, ' | '));
    expect.soft(text, 'Units Interested shown').toMatch(/Units Interested:\s*\d+/);
    expect(text, 'Timeline shown').toContain(lead.values['Timeline']);
  });

  test(...ldp('LDP-007'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    await detail.close();
    await expect(at(leads.page, XP.leadsTable), 'Leads list shown').toBeVisible();
  });
});

test.describe('Lead Detail · Workflow Status', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-011'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const want = workflow('After Create');
    const got = await detail.workflow(workflowStages());
    note('workflow', JSON.stringify(got));
    for (const s of workflowStages()) expect.soft(got[s], s).toBe(want[s]);
  });

  test(...ldp('LDP-012'), async ({ leads }) => {
    const { detail } = await workerLead(leads);
    const want = workflow('After Create');
    const got = await detail.workflow(workflowStages());
    note('workflow', JSON.stringify(got));
    expect.soft(got.Now, 'Now box').toBe(want.Now);
    expect.soft(got.Next, 'Next box').toBe(want.Next);
    expect(got['Next Actions'], 'Next action cards').toBe(want['Next Actions']);
  });

  test(...ldp('LDP-013'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    const n = await detail.qualify(checklistValues());
    note('pop-up', n?.text ?? 'none');
    const again = await leads.openLead(leadNo);
    const want = workflow('After Qualify');
    const got = await again.workflow(workflowStages());
    note('workflow', JSON.stringify(got));
    for (const k of [...workflowStages(), 'Now', 'Next', 'Next Actions']) expect.soft(got[k], k).toBe(want[k]);
  });

  test(...ldp('LDP-014'), async ({ leads }) => {
    const { detail } = await freshLead(leads);
    const step = statusChanges()[0];
    const n = await detail.changeStatus(step.status, step.reason);
    note('pop-up', n?.text ?? 'none');
    expect.soft(n?.text ?? '', 'Status changed').toContain(message('Status Changed Body', { status: step.status }));
    expect(await detail.statusChip(), 'Status pill straight after the change').toBe(step.status);
  });
});
