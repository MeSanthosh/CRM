import { test, expect, note } from './fixtures';
import { preferenceCase } from './shared';

test.describe('Preferences', () => {
  test(...preferenceCase('PREF-001'), async ({ preferences }) => {
    await preferences.open('General');
    await expect(preferences.page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
    const tabs = await preferences.page.locator('main button.crm-tab-button').allTextContents();
    note('preferences sections', tabs.map(tab => tab.trim()));
    expect(tabs.map(tab => tab.trim())).toEqual(['General', 'Notifications', 'Security', 'Operations & ETL']);
    await expect(preferences.page.getByText('Workspace configuration', { exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-002'), async ({ preferences }) => {
    await preferences.open('General');
    await preferences.page.getByRole('button', { name: 'Application defaults', exact: true }).click();
    const selects = preferences.page.locator('main select');
    await expect(preferences.page.getByRole('heading', { name: 'Application defaults', exact: true })).toBeVisible();
    await expect(selects, 'Application defaults controls').toHaveCount(3);
    const landingPages = await selects.nth(0).locator('option').allTextContents();
    const themes = await selects.nth(1).locator('option').allTextContents();
    const pageSizes = await selects.nth(2).locator('option').allTextContents();
    note('application defaults choices', { landingPages, themes, pageSizes });
    expect(landingPages).toContain('My Smart Workspace');
    expect(landingPages).toContain('Dashboard');
    expect(themes).toContain('Light (Standard)');
    expect(pageSizes.some(option => /\d+ rows/.test(option))).toBeTruthy();
    await expect(preferences.page.getByRole('button', { name: 'Save application defaults', exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-003'), async ({ preferences }) => {
    await preferences.open('General');
    await preferences.page.getByRole('button', { name: 'Time & locale', exact: true }).click();
    const selects = preferences.page.locator('main select');
    await expect(preferences.page.getByRole('heading', { name: 'Time & locale', exact: true })).toBeVisible();
    await expect(selects, 'Time and locale settings').toHaveCount(4);
    const choices = await Promise.all([0, 1, 2, 3].map(index => selects.nth(index).locator('option').allTextContents()));
    note('time and locale choice counts', choices.map(options => options.length));
    for (const options of choices) expect(options.length, 'Each time and locale setting has options').toBeGreaterThan(1);
    await expect(preferences.page.getByRole('button', { name: 'Save time & locale', exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-004'), async ({ preferences }) => {
    await preferences.open('Notifications');
    await preferences.page.getByRole('button', { name: 'Email (SMTP)', exact: true }).click();
    await expect(preferences.page.getByRole('heading', { name: 'Email (SMTP)', exact: true })).toBeVisible();
    await expect(preferences.page.getByPlaceholder('e.g. smtp.office365.com or smtp.gmail.com')).toBeVisible();
    await expect(preferences.page.getByPlaceholder('587')).toBeVisible();
    await expect(preferences.page.getByPlaceholder('••••••••')).toHaveAttribute('type', 'password');
    await expect(preferences.page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(preferences.page.getByRole('button', { name: 'Send test email', exact: true })).toBeVisible();
    await expect(preferences.page.getByRole('button', { name: 'Save SMTP settings', exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-005'), async ({ preferences }) => {
    await preferences.open('Notifications');
    await preferences.page.getByRole('button', { name: 'Notification channel', exact: true }).click();
    await expect(preferences.page.getByRole('heading', { name: 'Notification Channels', exact: true })).toBeVisible();
    const checkboxes = preferences.page.locator('main input[type="checkbox"]');
    expect(await checkboxes.count(), 'Notification channel controls are available').toBeGreaterThan(0);
    await expect(preferences.page.getByRole('button', { name: 'Save Notification Channels', exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-006'), async ({ preferences }) => {
    await preferences.open('Security');
    await expect(preferences.page.getByRole('heading', { name: 'Security & Authentication Policies', exact: true })).toBeVisible();
    for (const caption of ['Session Timeout (Minutes)', 'Max Failed Login Attempts', 'Interval Time For Next Login After Max Failed Attempts (Minutes)']) {
      const field = preferences.setting(caption);
      await expect(field, `${caption} is a numeric setting`).toHaveAttribute('type', 'number');
      expect(await field.inputValue(), `${caption} has a positive integer value`).toMatch(/^[1-9]\d*$/);
    }
    await expect(preferences.page.locator('main input[type="checkbox"]').first(), 'MFA enforcement is unavailable').toBeDisabled();
    await expect(preferences.page.getByRole('button', { name: 'Save Security Policies', exact: true })).toBeVisible();
  });

  test(...preferenceCase('PREF-007'), async ({ preferences }) => {
    await preferences.open('Operations & ETL');
    await expect(preferences.page.getByRole('heading', { name: 'Analytical Data Movement (Operations & ETL)', exact: true })).toBeVisible();
    await expect(preferences.page.getByRole('heading', { name: '1. Incremental ETL', exact: true })).toBeVisible();
    await expect(preferences.page.getByRole('heading', { name: '2. Full ETL (Day-1 Inception)', exact: true })).toBeVisible();
    await expect(preferences.page.getByRole('heading', { name: 'ETL Execution Audit Log', exact: true })).toBeVisible();
    const headers = await preferences.page.locator('main table').first().locator('thead th').allTextContents();
    note('ETL audit log columns', headers);
    expect(headers.map(header => header.trim())).toContain('Status');
    await expect(preferences.page.getByRole('button', { name: 'Run Incremental ETL', exact: true })).toBeVisible();
    await expect(preferences.page.getByRole('button', { name: 'Run Full ETL (Rebuild Snapshots)', exact: true })).toBeVisible();
  });
});
