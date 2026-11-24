/**
 * Hold helpers shared by the hold tests (AVS-028 Stack Plan tile, AVS-031 drill-down list): our own opportunity, the
 * counts before / after, filling the Hold form and releasing a hold (unit window or the Holds tab).
 */
import { expect, S, DATA, HF, list } from './shared';
import { dataBook } from '../leads-page/test-data';
import { XP, at } from '../locators';
import type { Locator } from '@playwright/test';
import type { AvailabilityPage } from '../pages/AvailabilityPage';

export const STACK = () => DATA.sheet('Page Views')[1]['View'];

/** Names of our own test leads (individual and corporate): holds are placed only for their opportunities. */
export function ownNames(): string[] {
  const book = dataBook(HF('Own Opportunity Names').split('/').pop()!, '');
  return [
    ...book.sheet('Individual Leads').map(r => `${r['First Name']} ${r['Last Name']}`.trim()),
    ...book.sheet('Corporate Leads').map(r => r['Legal Entity / Company Name']),
  ].filter(Boolean);
}
/** Counts used before / after: status chips and the summary line. */
export async function counts(av: AvailabilityPage) {
  await av.open();
  const sum = await av.summary(S('Summary Units Word'));
  await av.view(STACK());
  const chips = await av.statusChips();
  return { sum, chips };
}
/** The Hold form (opened by a Hold button). */
export const holdForm = (av: AvailabilityPage) => at(av.page, XP.avsHoldForm(HF('Submit Button')));
/**
 * Fills the Hold form for our own opportunity (the opportunity list loads a moment after the form opens).
 * Returns the opportunity chosen, or '' (form cancelled) when none of ours is open.
 */
export async function fillHold(form: Locator, duration: string): Promise<string> {
  await expect(form, 'Hold form').toBeVisible();
  await expect.poll(() => form.locator('select').nth(0).locator('option').count(), { message: 'Opportunities load', timeout: 15_000 }).toBeGreaterThan(1);
  const opps = (await form.locator('select').nth(0).locator('option').allTextContents()).map(o => o.trim());
  const mine = ownNames();
  const opp = opps.find(o => mine.some(m => o.includes(` ${m} `) || o.includes(`· ${m} ·`) || o.endsWith(` ${m}`)));
  if (!opp) { await form.getByRole('button', { name: HF('Cancel Button'), exact: true }).click(); return ''; }
  await form.locator('select').nth(0).selectOption({ label: opp });
  await form.locator('select').nth(1).selectOption({ label: duration });
  await form.locator('input:not([type]), input[type=text], textarea').first().fill(HF('Reason Text'));
  return opp;
}
/** Ends a hold early: a release button in the unit window, or on the unit's row of the Holds tab. */
export async function release(av: AvailabilityPage, code: string, project?: string): Promise<string> {
  const names = list(HF('Release Buttons'));
  await av.open();
  if (project) await av.choose(S('Project Label'), project); // the page opens on the first project
  await av.view(STACK());
  await av.openTile(code);
  for (const n of names) {
    const b = av.unitButton(n);
    if (await b.isVisible().catch(() => false)) { await b.click(); return `unit window "${n}"`; }
  }
  await av.unitButton(S('Close Button')).click().catch(() => {});
  await av.press(at(av.page, XP.pageTab(HF('Holds Tab'))).first(), HF('Holds Tab'));
  await av.page.waitForTimeout(1500);
  for (const sel of await av.main.locator('select').all()) {
    const opts = (await sel.locator('option').allTextContents()).map(o => o.trim());
    const want = opts.find(o => o === HF('Holds Scope All'));
    if (want) await sel.selectOption({ label: want });
  }
  await av.page.waitForTimeout(1500);
  const row = av.main.locator('table tbody tr', { hasText: code }).first();
  for (const n of names) {
    const b = row.getByRole('button', { name: n, exact: true });
    // the reminder cards can lie on top of the button: press() then clicks it with a DOM event
    if (await b.isVisible().catch(() => false)) { await av.press(b, `${n} on the Holds tab`); return `Holds tab "${n}"`; }
  }
  return '';
}
/** Answers "Release this unit?" with its Release button; returns the pop-up text. */
export async function confirmRelease(av: AvailabilityPage): Promise<string> {
  const n = at(av.page, XP.notice).last();
  if (!(await n.isVisible({ timeout: 5000 }).catch(() => false))) return '';
  const text = (await n.innerText()).replace(/\s+/g, ' ').trim();
  await n.getByRole('button', { name: HF('Release Confirm Button'), exact: true }).click();
  await av.page.waitForLoadState('networkidle').catch(() => {});
  await av.page.waitForTimeout(2000);
  return text;
}
