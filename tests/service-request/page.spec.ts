/** Service Requests workbook — Page: navigation, header, help panel, empty detail panel (SR-001 … SR-008). */
import { test, expect } from '../pages/fixtures';
import { open } from '../helpers';
import { ROUTES, SR_TEXT, SR_XP, XP, at } from '../locators';
import { sr } from './catalog';

test.describe('Service Requests · Page', () => {
  test(...sr('SR-001'), async ({ page, serviceRequests: srp }) => {
    await open(page, ROUTES.dashboard);
    const link = at(page, XP.navLink(ROUTES.serviceRequests));
    // the nav opens on "Frequent", which lists only pinned modules
    if (!(await link.isVisible())) await at(page, XP.navMode('All Modules')).click();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.serviceRequests}$`));
    await expect(srp.heading()).toBeVisible();
    await expect.soft(link, 'Navigation link is marked active').toHaveClass(/\bactive\b/);
  });

  test(...sr('SR-002'), async ({ serviceRequests: srp }) => {
    srp.watchErrors();
    await srp.open();
    await expect(srp.queueHeading).toBeVisible();
    await expect(srp.emptyState).toBeVisible();
    await srp.expectNoBrokenValues();
    srp.expectNoErrors();
  });

  test(...sr('SR-003'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await expect.soft(srp.x(SR_XP.eyebrow), 'Eyebrow')
      .toHaveText(new RegExp(`^${SR_TEXT.eyebrow}$`, 'i'));
    await expect.soft(srp.heading(), 'Heading').toBeVisible();
    await expect.soft(srp.x(SR_XP.subtitle), 'Description')
      .toHaveText(SR_TEXT.subtitle);
  });

  test(...sr('SR-004'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await expect.soft(srp.tipsButton, '"Hide tips"').toHaveText('Hide tips');
    await expect.soft(srp.tipsButton).toBeEnabled();
    await expect.soft(srp.newRequestButton, '"New Request"').toBeVisible();
    await expect.soft(srp.newRequestButton).toBeEnabled();
    await expect.soft(srp.newRequestButton, 'New Request is the primary button').toHaveClass(/crm-primary-button/);
  });

  test(...sr('SR-005'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const panel = srp.helpPanel;
    await expect(panel.locator('h3')).toHaveText(SR_TEXT.helpTitle);
    const steps = panel.locator('ol > li');
    await expect(steps).toHaveCount(4);
    const expectedSteps = [
      ['Customer Portal', 'New Request'],
      ['Status', 'Priority', 'Assigned to'],
      ['Reply in the conversation', 'visible appear for the customer on the portal'],
      ['Attach photos/files', 'requires S3 configuration'],
    ];
    for (const [i, parts] of expectedSteps.entries()) for (const p of parts) await expect.soft(steps.nth(i), `Step ${i + 1}`).toContainText(p);
    const note = panel.locator('aside');
    await expect.soft(note.locator('strong'), 'Side note title').toHaveText(new RegExp(`^${SR_TEXT.helpNote}$`, 'i'));
    await expect.soft(note, 'Side note text').toContainText('Each request is a tracked ticket with status history.');
  });

  test(...sr('SR-006'), async ({ serviceRequests: srp }) => {
    await srp.open();
    const count = await srp.queueCount();
    await srp.tipsButton.click();
    await expect(srp.helpPanel).toBeHidden();
    await expect(srp.tipsButton).toHaveText('Show tips');
    await srp.tipsButton.click();
    await expect(srp.helpPanel).toBeVisible();
    await expect(srp.tipsButton).toHaveText('Hide tips');
    expect.soft(await srp.queueCount(), 'Queue unaffected').toBe(count);
  });

  test(...sr('SR-007'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await srp.tipsButton.click();
    await expect(srp.helpPanel).toBeHidden();
    await srp.open();
    await expect(srp.helpPanel).toBeVisible();
    await expect(srp.tipsButton).toHaveText('Hide tips');
  });

  test(...sr('SR-008'), async ({ serviceRequests: srp }) => {
    await srp.open();
    await expect(srp.emptyState.locator('h3')).toHaveText(SR_TEXT.emptyTitle);
    await expect.soft(srp.emptyState.locator('p')).toHaveText(SR_TEXT.emptyText);
    await expect.soft(srp.emptyState.getByRole('button', { name: 'New Request' })).toBeVisible();
  });
});
