/**
 * Business Rules saves (ADM-054 … ADM-056): wrong values must not publish; Save Draft and Publish keep a change on 7
 * engines. WRITES TO QA: every value is read first and the original is published again in `finally`.
 * Login & OTP, Communication Channels, Personal Data Protection, When Lead Becomes Customer and Unit Pricing Rules are
 * never saved here. Runs in order on one worker. Run: npx playwright test tests/admin-governance/rules-save.spec.ts --workers=1
 */
import { test, expect, note, adm, admRow, S, sheet, WAIT } from './shared';
import { press, shownMessage, BusinessRulesPage } from '../pages/AdminPages';
import { watchWrites } from '../pages/PricingMatrixPage';

type Writes = ReturnType<typeof watchWrites>;
const ok = (w: { status: number }[]) => w.some(x => x.status >= 200 && x.status < 300);
const split = (s: string) => s.split('|').map(x => x.trim());

/** Presses Save Draft / Publish and returns the requests it sent, and the message shown. */
async function act(rules: BusinessRulesPage, writes: Writes, button: string, wait = WAIT()) {
  const from = writes.length;
  // the app disables Publish itself for some wrong values: nothing can be sent
  if (await rules.button(button).isDisabled()) return { sent: [] as typeof writes, message: '', disabled: true };
  // the app reuses a toast that is still on screen (Save Draft → Publish): let the last one go away first
  await rules.page.locator('.crm-app-toast').first().waitFor({ state: 'detached', timeout: 12_000 }).catch(() => {});
  // the toast can come and go while press() waits for the network: record every toast / pop-up that appears
  await rules.page.evaluate(() => {
    const w = window as any;
    w.__shown = [];
    w.__shownObs?.disconnect();
    w.__shownObs = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes as any) if (n.nodeType === 1) { const hit = n.matches?.('.crm-app-toast, .crm-notice-dialog, [role=alert]') ? n : n.querySelector?.('.crm-app-toast, .crm-notice-dialog, [role=alert]'); if (hit) w.__shown.push(hit); } });
    w.__shownObs.observe(document.body, { childList: true, subtree: true });
  });
  await press(rules.button(button));
  const until = Date.now() + wait;
  // the toast text is filled in after the toast is added: read the recorded toasts now
  let message = ((await rules.page.evaluate(() => ((window as any).__shown ?? []).map((e: HTMLElement) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()))) as string[]).filter(Boolean).join(' | ');
  while (Date.now() < until && !message) {
    await rules.page.waitForTimeout(250);
    message = await shownMessage(rules.page);
  }
  // the message can come a moment after the response, and goes away by itself: stop as soon as it is read
  await rules.page.waitForLoadState('networkidle').catch(() => {});
  return { sent: writes.slice(from), message, disabled: false };
}
/** Puts the original values back and publishes them; checks they are live again. */
async function restore(rules: BusinessRulesPage, writes: Writes, engine: string, fields: string[], originals: string[]) {
  await rules.open(engine);
  for (const [i, f] of fields.entries()) await rules.write(f, originals[i]);
  const r = await act(rules, writes, S('Publish Button'));
  note('put back', `${engine}: ${r.sent.map(x => `${x.method} ${x.status}`).join(', ')} ${r.message}`);
  await rules.open(engine);
  for (const [i, f] of fields.entries()) expect(await rules.read(f), `${engine}: ${f} back to its original value`).toBe(originals[i]);
  const v = await rules.version(S('Version Word'));
  expect.soft(v.text, `${engine} published again`).toContain(S('Published Status'));
  expect.soft(v.text, `${engine}: no unpublished changes left`).not.toContain(S('Unpublished Text'));
}

test.describe('Admin & Governance · Business Rules saves (restored)', () => {
  test.describe.configure({ mode: 'default', timeout: 300_000 });

  sheet('Rule Invalid Values').forEach((c, n) => {
    test(...admRow('ADM-054', n + 1, `${c['Engine']}: ${c['What it checks']}`, c['Expected Message Contains'] ? `Not published; message contains "${c['Expected Message Contains']}"` : 'Publish is refused with a message and the published value is unchanged.', `Rule Invalid Values row ${n + 1}`), async ({ rules, page }) => {
      const writes = watchWrites(page);
      await rules.open(c['Engine']);
      const original = await rules.read(c['Field']);
      const v0 = await rules.version(S('Version Word'));
      let accepted = false;
      try {
        const typed = await rules.change(c['Field'], c['Change']);
        const shown = await rules.read(c['Field']);
        note('typed / field shows', `${typed} / ${shown} (was ${original})`);
        if (shown !== typed) { expect.soft(shown, 'The field does not take the value').not.toBe(typed); return; }
        const r = await act(rules, writes, S('Publish Button'), 8_000);
        accepted = ok(r.sent);
        note('publish', `${r.disabled ? 'Publish is disabled' : r.sent.map(x => `${x.method} ${x.url} ${x.status}`).join(', ') || 'nothing sent'} · "${r.message}"`);
        expect.soft(accepted, `${c['What it checks']}: Publish is refused`).toBeFalsy();
        if (!r.disabled) expect.soft(r.message, 'A message says what is wrong').not.toBe('');
        if (c['Expected Message Contains']) expect.soft(r.message, 'Message').toContain(c['Expected Message Contains']);
      } finally {
        if (accepted) await restore(rules, writes, c['Engine'], [c['Field']], [original]);
        else {
          await rules.open(c['Engine']);
          expect.soft(await rules.read(c['Field']), 'The published value is unchanged').toBe(original);
          expect.soft((await rules.version(S('Version Word'))).number, 'The version is unchanged').toBe(v0.number);
        }
      }
    });
  });

  sheet('Rule Saves').forEach((c, n) => {
    test(...admRow('ADM-055', n + 1, `${c['Engine']}: ${c['What it changes']}`, 'Save Draft keeps the change as a draft, Publish makes it live, and the original value is published again.', `Rule Saves row ${n + 1}`), async ({ rules, page }) => {
      const writes = watchWrites(page);
      const fields = split(c['Fields']), changes = split(c['Changes']);
      await rules.open(c['Engine']);
      const originals: string[] = [];
      for (const f of fields) originals.push(await rules.read(f));
      const v0 = await rules.version(S('Version Word'));
      note('original', `${originals.join(' | ')} · ${v0.text}`);
      try {
        const typed: string[] = [];
        for (const [i, f] of fields.entries()) typed.push(await rules.change(f, changes[i]));
        const d = await act(rules, writes, S('Save Draft Button'));
        note('save draft', `${d.sent.map(x => `${x.method} ${x.status}`).join(', ')} · "${d.message}"`);
        expect.soft(ok(d.sent), 'Draft saved').toBeTruthy();
        await rules.open(c['Engine']);
        const v1 = await rules.version(S('Version Word'));
        note('after draft', v1.text);
        expect.soft(v1.number, 'Version number goes up').toBeGreaterThan(v0.number);
        expect.soft(v1.text, 'Shows DRAFT').toContain(S('Draft Status'));
        expect.soft(v1.text, 'Shows unpublished changes').toContain(S('Unpublished Text'));
        for (const [i, f] of fields.entries()) expect.soft(await rules.read(f), `${f}: the draft is kept`).toBe(typed[i]);
        const p = await act(rules, writes, S('Publish Button'));
        note('publish', `${p.sent.map(x => `${x.method} ${x.status}`).join(', ')} · "${p.message}"`);
        expect.soft(ok(p.sent), 'Published').toBeTruthy();
        await rules.open(c['Engine']);
        const v2 = await rules.version(S('Version Word'));
        note('after publish', v2.text);
        expect.soft(v2.text, 'Shows PUBLISHED').toContain(S('Published Status'));
        expect.soft(v2.text, 'No unpublished changes').not.toContain(S('Unpublished Text'));
        for (const [i, f] of fields.entries()) expect.soft(await rules.read(f), `${f}: the published value is kept`).toBe(typed[i]);
      } finally {
        await restore(rules, writes, c['Engine'], fields, originals);
      }
    });
  });

  test(...adm('ADM-056'), async ({ rules, page }) => {
    const writes = watchWrites(page);
    const c = sheet('Rule Saves').find(x => x['Engine'] === 'UNIT_HOLD')!;
    await rules.open(c['Engine']);
    const original = await rules.read(c['Fields']);
    try {
      await rules.change(c['Fields'], c['Changes']);
      const d = await act(rules, writes, S('Save Draft Button'));
      const dm = d.message;
      note('Save Draft message', dm || 'none');
      expect.soft(ok(d.sent), 'Draft saved').toBeTruthy();
      expect.soft(dm, 'Save Draft tells the user the result').not.toBe('');
      await rules.write(c['Fields'], original);
      const p = await act(rules, writes, S('Publish Button'));
      const pm = p.message;
      note('Publish message', pm || 'none');
      expect.soft(ok(p.sent), 'Published').toBeTruthy();
      expect.soft(pm, 'Publish tells the user the result').not.toBe('');
    } finally {
      await restore(rules, writes, c['Engine'], [c['Fields']], [original]);
    }
  });
});
