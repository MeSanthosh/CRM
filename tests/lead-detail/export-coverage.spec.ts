/** Leads Export (LDP-111, LDP-112) and the coverage check of Testcase/Lead_Detail_Test_Cases.xlsx. */
import fs from 'fs';
import path from 'path';
import { test, expect, note, ldp, freshLead, digits, LEAD_DETAIL_CASES, TAG } from './shared';
import { setting, exportColumns } from './test-data';
import { withLeadsLock } from '../leads-page/shared';
import { download, ymd } from '../helpers';
import { XP, at } from '../locators';

test.describe('Lead Detail · Export', () => {
  test.describe.configure({ timeout: 600_000 });

  test(...ldp('LDP-111'), async ({ leads }) => {
    await withLeadsLock(async () => {
      await leads.openRoute();
      const listed = await leads.listed();
      const file = await download(leads.page, at(leads.page, XP.leadsExport));
      const now = new Date();
      const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60_000);
      const names = [ymd(now), ymd(utc)].map(d => setting('Leads Export File').replace('{date}', d));
      note('file / rows / listed', `${file.name} / ${file.rows.length} / ${listed}`);
      expect.soft(names, 'File name').toContain(file.name);
      for (const c of exportColumns('Leads')) expect.soft(file.header, `Column "${c}"`).toContain(c);
      expect(file.rows.length, 'One row per lead listed').toBe(listed);
    });
  });

  test(...ldp('LDP-112'), async ({ leads }) => {
    const { leadNo, detail } = await freshLead(leads);
    const panel = { name: await detail.headerName(), phone: await detail.value('Phone'), email: await detail.value('Email'),
      source: await detail.value('Source'), status: await detail.statusChip(), assigned: await detail.value('Assigned') };
    await leads.openRoute();
    await leads.search(leadNo);
    const file = await download(leads.page, at(leads.page, XP.leadsExport));
    note('panel / export', `${JSON.stringify(panel)} | ${JSON.stringify(file.rows)}`);
    expect(file.rows.map(r => String(r['Lead No'])), 'Only the searched lead').toEqual([leadNo]);
    const x = file.rows[0];
    expect.soft(String(x['Name']), 'Name').toBe(panel.name);
    expect.soft(digits(String(x['Mobile'])), 'Mobile').toBe(digits(panel.phone));
    expect.soft(String(x['Email']), 'Email').toBe(panel.email);
    expect.soft(String(x['Source']), 'Source').toBe(panel.source);
    expect.soft(String(x['Status']), 'Status').toBe(panel.status);
    expect(String(x['Assigned To']), 'Assigned To').toBe(panel.assigned);
  });
});

test('LDP-COV-01 Every Lead Detail test case is automated', { tag: [TAG], annotation: { type: 'expected', description: 'Each TC ID on the Test Cases sheet of Lead_Detail_Test_Cases.xlsx has a test in tests/lead-detail' } }, async () => {
  const code = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts')).map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  // tasks-meetings.spec.ts builds IDs as base + 1 … 9 for Task (90) and Meeting (100)
  const built = new Set<string>();
  for (const m of code.matchAll(/declare\('(?:Task|Meeting)', (\d+)\)/g)) for (let i = 1; i <= 9; i++) built.add(`LDP-${String(Number(m[1]) + i).padStart(3, '0')}`);
  const missing = Object.keys(LEAD_DETAIL_CASES).filter(id => !code.includes(`'${id}'`) && !built.has(id));
  expect(missing, 'Test cases without automation').toEqual([]);
});
