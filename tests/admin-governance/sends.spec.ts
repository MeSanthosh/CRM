/**
 * Communication Channels → real test sends (ADM-061, ADM-062). Sends one email / WhatsApp to the recipients in .env
 * (TEST_EMAIL_TO, TEST_WHATSAPP_TO); a test is skipped when its recipient is missing. Recipients are not written to the
 * report. No channel setting is saved. Run: npx playwright test tests/admin-governance/sends.spec.ts --workers=1
 */
import { test, expect, note, adm, S, WAIT } from './shared';
import { press, shownMessage, BusinessRulesPage } from '../pages/AdminPages';
import { watchWrites } from '../pages/PricingMatrixPage';
import { XP, at } from '../locators';

/** Types the recipient, presses the send button and returns what the app answered. */
async function send(rules: BusinessRulesPage, label: string, button: string, to: string, writes: ReturnType<typeof watchWrites>) {
  const page = rules.page;
  await at(page, XP.admField(label)).first().fill(to);
  await page.waitForTimeout(300);
  const b = rules.button(button);
  await expect(b, `Button ${button}`).toBeVisible();
  if (await b.isDisabled()) return { disabled: true, sent: [], message: '', answer: '', panel: '' };
  const from = writes.length;
  // the server's own answer: HTTP 200 alone does not mean the message left (e.g. {"success":false,…})
  const reply = page.waitForResponse(x => /channel-setup\/test-/.test(x.url()), { timeout: WAIT() }).then(x => x.text()).catch(() => '');
  const textBefore = await page.locator('main').innerText();
  await press(b);
  const until = Date.now() + WAIT();
  let message = '';
  while (Date.now() < until) {
    await page.waitForTimeout(400);
    message = await shownMessage(page);
    if (message && writes.length > from) break;
  }
  const answer = await reply;
  await page.waitForTimeout(1500);
  const before = new Set(textBefore.split('\n').map(l => l.trim()));
  const panel = (await page.locator('main').innerText()).split('\n').map(l => l.trim()).filter(l => l && !before.has(l)).join(' | ');
  return { disabled: false, sent: writes.slice(from), message, answer, panel };
}
/** Sent only when the server says so: success true, or a sent / accepted status, with no failure word. */
const wasSent = (r: Awaited<ReturnType<typeof send>>) => {
  if (r.disabled || !r.sent.some(x => x.status >= 200 && x.status < 300)) return false;
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(r.answer); } catch { /* not JSON */ }
  const said = `${r.answer} ${r.message} ${r.panel}`;
  return (j.ok === true || j.success === true || j.sent === true || /^(sent|accepted|queued|delivered)$/i.test(String(j.status ?? ''))) && !/not connected|not configured|failed/i.test(said);
};
const report = (r: Awaited<ReturnType<typeof send>>) => (r.disabled ? 'button disabled' : `${r.sent.map(x => `${x.method} ${x.url} ${x.status}`).join(', ') || 'nothing sent'} · message "${r.message}" · on the page "${r.panel}" · answer ${r.answer.slice(0, 400)}`);

test.describe('Admin & Governance · Communication test sends', () => {
  test.describe.configure({ mode: 'default', timeout: 180_000 });

  test(...adm('ADM-061'), async ({ rules, page }) => {
    const to = process.env[S('Email Recipient Env')];
    test.skip(!to, `${S('Email Recipient Env')} is not set in .env`);
    const writes = watchWrites(page);
    await rules.open('COMMUNICATION_CHANNELS');
    const setup = (await rules.lines()).filter(l => /not connected|Setup Needed/.test(l)).join(' | ');
    const r = await send(rules, S('Email Recipient Label'), S('Email Send Button'), to!, writes);
    note('email send', `recipient from .env · ${report(r)} · channel state: ${setup}`);
    const delivered = wasSent(r);
    note('result', delivered ? 'The app reports it sent: check the inbox' : 'Not sent');
    expect(delivered || r.disabled || r.message !== '' || r.panel !== '', 'The app says it was sent, or says why not').toBeTruthy();
    expect.soft(delivered, `The test email is sent (${r.message || r.panel || r.answer.slice(0, 200) || 'button disabled'})`).toBeTruthy();
  });

  test(...adm('ADM-062'), async ({ rules, page }) => {
    const to = process.env[S('WhatsApp Recipient Env')];
    test.skip(!to, `${S('WhatsApp Recipient Env')} is not set in .env`);
    const writes = watchWrites(page);
    await rules.open('COMMUNICATION_CHANNELS');
    await press(rules.button(S('WhatsApp Preset')));
    const setup = (await rules.lines()).filter(l => /not connected|Setup Needed/.test(l)).join(' | ');
    const r = await send(rules, S('WhatsApp Recipient Label'), S('WhatsApp Send Button'), to!, writes);
    note('WhatsApp send', `recipient from .env · ${report(r)} · channel state: ${setup}`);
    const delivered = wasSent(r);
    note('result', delivered ? 'The app reports it sent: check the phone' : 'Not sent');
    expect(delivered || r.disabled || r.message !== '' || r.panel !== '', 'The app says it was sent, or says why not').toBeTruthy();
    expect.soft(delivered, `The test WhatsApp is sent (${r.message || r.panel || r.answer.slice(0, 200) || 'button disabled'})`).toBeTruthy();
  });
});
