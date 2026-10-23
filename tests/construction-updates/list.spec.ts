/**
 * Construction Updates · page, list, filters and search (CU-001…CU-015). Read-only: nothing on QA is changed.
 * The screen is compared with what the backend has saved (GET /construction-updates), never with fixed figures.
 *
 * Run this file:  npx playwright test tests/construction-updates/list.spec.ts
 * Run one case:   npx playwright test -g "CU-005"
 */
import { test, expect, note, updates, projects, periodShown, Update } from './fixtures';
import { cu } from './catalog';
import { ROUTES } from '../locators';

const STATUSES = { Draft: 'DRAFT', Published: 'PUBLISHED', Archived: 'ARCHIVED' } as const;
const titles = (u: Update[]) => u.map(x => x.title);
/** Rows the screen's search keeps: title or project name contains the text, ignoring case. */
const matches = (u: Update[], text: string) => u.filter(x => `${x.title} ${x.projectName}`.toLowerCase().includes(text.toLowerCase()));
/** The longest word of a title (a search term that is likely to be specific). */
const wordOf = (title: string) => title.split(/[^A-Za-z0-9]+/).sort((a, b) => b.length - a.length)[0];

test.describe('Construction Updates · Page', () => {
  // ── CU-001 · Construction Updates opens from the side menu
  // Run:    npx playwright test -g "CU-001"
  // Checks: URL /construction-updates; eyebrow, heading, intro; Hide tips and New Update buttons
  test(...cu('CU-001'), async ({ cup, page }) => {
    await page.goto(ROUTES.dashboard);
    await page.getByRole('link', { name: 'Construction Updates', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.constructionUpdates}(\\?.*)?$`));
    await expect(cup.heading()).toBeVisible();
    await expect.soft(cup.eyebrow, 'Eyebrow').toHaveText(/project engagement/i);
    await expect.soft(cup.intro, 'Intro').toHaveText('Publish progress updates with photos for customers linked to the project.');
    await expect.soft(cup.headerButton('Hide tips'), 'Hide tips button').toBeVisible();
    await expect.soft(cup.headerButton('New Update'), 'New Update button').toBeVisible();
  });

  // ── CU-002 · Page loads without errors
  // Run:    npx playwright test -g "CU-002"
  // Checks: list and detail panel shown; no JavaScript errors, failed API calls, NaN or undefined
  test(...cu('CU-002'), async ({ cup }) => {
    cup.watchErrors();
    await cup.open();
    await expect.soft(cup.searchBox, 'Updates list').toBeVisible();
    await expect.soft(cup.emptyStateHeading, 'Detail panel').toHaveText('Select or create an update');
    await cup.expectNoBrokenValues();
    cup.expectNoErrors();
  });

  // ── CU-003 · Help panel explains how to use the screen
  // Run:    npx playwright test -g "CU-003"
  // Checks: "How to use Construction Updates", its 4 steps and the Tip
  test(...cu('CU-003'), async ({ cup, page }) => {
    await cup.open();
    await expect(page.getByRole('heading', { name: 'How to use Construction Updates', exact: true })).toBeVisible();
    const steps = (await cup.helpSteps.allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
    note('steps', steps);
    expect.soft(steps, 'Four steps').toEqual([
      'Click New Update, choose the project, write the story, and save as a draft.',
      'Add photos (stored in S3). Captions are optional.',
      'Click Publish when ready — only published + portal-visible updates appear for customers on that project.',
      'Use Unpublish to pull an update back to draft if wording or photos need correction.',
    ]);
    await expect.soft(cup.helpTip, 'Tip').toHaveText('Customers only see updates for projects where they have a reservation or contract unit.');
  });

  // ── CU-004 · Hide tips / Show tips toggles the help panel
  // Run:    npx playwright test -g "CU-004"
  // Checks: Hide tips removes the panel and becomes "Show tips"; Show tips brings it back
  test(...cu('CU-004'), async ({ cup }) => {
    await cup.open();
    await expect(cup.help).toBeVisible();
    await cup.headerButton('Hide tips').click();
    await expect.soft(cup.help, 'Help panel hidden').toHaveCount(0);
    await expect.soft(cup.headerButton('Show tips'), 'Button now reads Show tips').toBeVisible();
    await cup.headerButton('Show tips').click();
    await expect.soft(cup.help, 'Help panel back').toBeVisible();
    await expect.soft(cup.headerButton('Hide tips'), 'Button reads Hide tips again').toBeVisible();
  });
});

test.describe('Construction Updates · List', () => {
  // ── CU-005 · Updates (N) equals the rows shown and the saved updates
  // Run:    npx playwright test -g "CU-005"
  // Checks: header count = rows in the table = updates saved in the backend
  test(...cu('CU-005'), async ({ cup, api }) => {
    await cup.open();
    const shown = await cup.count();
    const rows = await cup.rows();
    const saved = await updates(api);
    note('count', { header: shown, rows: rows.length, saved: saved.totalCount });
    expect.soft(shown, '"Updates (N)" = rows in the table').toBe(rows.length);
    expect.soft(shown, '"Updates (N)" = updates saved').toBe(saved.totalCount);
  });

  // ── CU-006 · Each row shows the update's title, project, period and status
  // Run:    npx playwright test -g "CU-006"
  // Checks: columns; every row = its saved update ("—" for no period); status is a known value
  test(...cu('CU-006'), async ({ cup, api }) => {
    await cup.open();
    expect.soft(await cup.headers(), 'Columns').toEqual(['Title', 'Project', 'Period', 'Status']);
    const rows = await cup.rows();
    const saved = (await updates(api)).items;
    expect.soft(rows, 'Rows = saved updates').toEqual(saved.map(u => ({ title: u.title, project: u.projectName, period: periodShown(u), status: u.status })));
    expect.soft(rows.filter(r => !Object.values(STATUSES).includes(r.status as never)), 'Rows with an unknown status').toEqual([]);
    note('periods', [...new Set(rows.map(r => r.period))]);
  });

  // ── CU-007 · Newest update is listed first
  // Run:    npx playwright test -g "CU-007"
  // Checks: rows in descending order of creation date
  test(...cu('CU-007'), async ({ cup, api }) => {
    await cup.open();
    const saved = (await updates(api)).items;
    const newestFirst = [...saved].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(titles(saved.length > 1 ? newestFirst : saved), 'Rows sorted newest first').toEqual((await cup.rows()).map(r => r.title));
  });
});

test.describe('Construction Updates · Filters & search', () => {
  // ── CU-008 · Status filter offers every status
  // Run:    npx playwright test -g "CU-008"
  // Checks: All statuses, Draft, Published, Archived; All statuses selected
  test(...cu('CU-008'), async ({ cup }) => {
    await cup.open();
    expect(await cup.optionLabels(cup.statusFilter)).toEqual(['All statuses', 'Draft', 'Published', 'Archived']);
    await expect.soft(cup.statusFilter, 'Default').toHaveValue('');
  });

  // ── CU-009 · Status filter shows only updates with that status
  // Run:    npx playwright test -g "CU-009"
  // Checks: per status: only that status, count = saved updates with it; All statuses restores the list
  test(...cu('CU-009'), async ({ cup, api }) => {
    await cup.open();
    const saved = (await updates(api)).items;
    const seen: Record<string, number> = {};
    for (const [label, status] of Object.entries(STATUSES)) {
      await cup.filterStatus(label);
      const rows = await cup.rows();
      const expected = saved.filter(u => u.status === status);
      seen[label] = rows.length;
      expect.soft(rows.filter(r => r.status !== status).map(r => r.title), `${label}: rows with another status`).toEqual([]);
      expect.soft(rows.map(r => r.title), `${label}: rows = saved ${status} updates`).toEqual(titles(expected));
      expect.soft(await cup.count(), `${label}: "Updates (N)"`).toBe(expected.length);
      if (!expected.length) await expect.soft(cup.emptyRow, `${label}: empty-list row`).toBeVisible();
    }
    note('by status', seen);
    await cup.filterStatus('All statuses');
    expect.soft((await cup.rows()).length, 'All statuses: full list').toBe(saved.length);
  });

  // ── CU-010 · Project filter lists the projects and filters by project
  // Run:    npx playwright test -g "CU-010"
  // Checks: options = All projects + backend projects; each project shows only its updates; All projects restores
  test(...cu('CU-010'), async ({ cup, api }) => {
    await cup.open();
    const list = await projects(api);
    const saved = (await updates(api)).items;
    expect.soft(await cup.optionLabels(cup.projectFilter), 'Options').toEqual(['All projects', ...list.map(p => p.name)]);
    for (const p of list) {
      await cup.filterProject(p.name);
      const rows = await cup.rows();
      expect.soft(rows.filter(r => r.project !== p.name).map(r => r.title), `${p.name}: rows of another project`).toEqual([]);
      expect.soft(rows.map(r => r.title), `${p.name}: rows = its saved updates`).toEqual(titles(saved.filter(u => u.projectId === p.id)));
    }
    await cup.filterProject('All projects');
    expect.soft((await cup.rows()).length, 'All projects: full list').toBe(saved.length);
  });

  // ── CU-011 · Search finds updates by part of the title, ignoring case
  // Run:    npx playwright test -g "CU-011"
  // Test data: the longest word of the first row's title, upper-cased
  test(...cu('CU-011'), async ({ cup, api }) => {
    await cup.open();
    const saved = (await updates(api)).items;
    test.skip(!saved.length, 'No construction update saved yet');
    const term = wordOf(saved[0].title).toUpperCase();
    note('search', term);
    await cup.search(term);
    const rows = await cup.rows();
    expect.soft(rows.map(r => r.title), `Rows matching "${term}"`).toEqual(titles(matches(saved, term)));
    expect.soft(rows.map(r => r.title), 'The update the term came from').toContain(saved[0].title);
    expect.soft(await cup.count(), '"Updates (N)"').toBe(rows.length);
  });

  // ── CU-012 · Search finds updates by project name
  // Run:    npx playwright test -g "CU-012"
  // Test data: first word of the first row's project, lower-cased
  test(...cu('CU-012'), async ({ cup, api }) => {
    await cup.open();
    const saved = (await updates(api)).items;
    test.skip(!saved.length, 'No construction update saved yet');
    const term = saved[0].projectName.split(/\s+/)[0].toLowerCase();
    note('search', term);
    await cup.search(term);
    const rows = await cup.rows();
    expect.soft(rows.map(r => r.title), `Rows matching "${term}"`).toEqual(titles(matches(saved, term)));
    expect.soft(rows.map(r => r.title), `Every update of ${saved[0].projectName}`).toEqual(expect.arrayContaining(titles(saved.filter(u => u.projectId === saved[0].projectId))));
  });

  // ── CU-013 · Search with no match shows an empty list
  // Run:    npx playwright test -g "CU-013"
  // Test data: zz-no-such-update-zz
  test(...cu('CU-013'), async ({ cup }) => {
    await cup.open();
    await cup.search('zz-no-such-update-zz');
    expect.soft(await cup.rows(), 'No rows').toEqual([]);
    expect.soft(await cup.count(), '"Updates (0)"').toBe(0);
    await expect.soft(cup.emptyRow, 'Empty-list row').toBeVisible();
    note('empty message', await cup.emptyRow.innerText());
    await cup.expectNoBrokenValues();
  });

  // ── CU-014 · Clearing the search restores the list
  // Run:    npx playwright test -g "CU-014"
  // Checks: × empties the box and every update is listed again
  test(...cu('CU-014'), async ({ cup }) => {
    await cup.open();
    const all = await cup.rows();
    await cup.search('zz-no-such-update-zz');
    expect(await cup.rows()).toEqual([]);
    await cup.clearSearch();
    await expect.soft(cup.searchBox, 'Search box empty').toHaveValue('');
    expect.soft(await cup.rows(), 'Full list again').toEqual(all);
  });

  // ── CU-015 · Search, status and project filters work together
  // Run:    npx playwright test -g "CU-015"
  // Test data: Draft + the first draft's project + the longest word of its title
  test(...cu('CU-015'), async ({ cup, api }) => {
    await cup.open();
    const saved = (await updates(api)).items;
    const draft = saved.find(u => u.status === 'DRAFT');
    test.skip(!draft, 'No draft saved');
    const term = wordOf(draft!.title);
    note('filters', { status: 'Draft', project: draft!.projectName, search: term });
    await cup.filterStatus('Draft');
    await cup.filterProject(draft!.projectName);
    await cup.search(term);
    const expected = matches(saved.filter(u => u.status === 'DRAFT' && u.projectId === draft!.projectId), term);
    expect((await cup.rows()).map(r => r.title), 'Rows matching all three').toEqual(titles(expected));
  });
});
