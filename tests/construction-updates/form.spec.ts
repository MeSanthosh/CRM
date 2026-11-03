/**
 * Construction Updates · detail panel and form validation (CU-016…CU-025). Nothing is saved: every test checks
 * that no create / update request was sent (writesOf), so a validation gap shows up as a failure, not as QA data.
 *
 * Run this file:  npx playwright test tests/construction-updates/form.spec.ts
 * Run one case:   npx playwright test -g "CU-022"
 */
import { test, expect, note, updates, update, projects, writesOf } from './fixtures';
import { cu } from './catalog';

test.describe('Construction Updates · Detail panel', () => {
  // ── CU-016 · Detail panel asks to select or create an update
  // Run:    npx playwright test -g "CU-016"
  // Checks: "Select or create an update", its hint and a New Update button
  test(...cu('CU-016'), async ({ cup }) => {
    await cup.open();
    await expect.soft(cup.emptyStateHeading).toHaveText('Select or create an update');
    await expect.soft(cup.emptyStateText).toHaveText('Choose a row on the left to edit, publish, and manage photos — or start with New Update.');
    await expect.soft(cup.emptyStateNew).toHaveText('New Update');
  });

  // ── CU-017 · Clicking a row opens the update for editing
  // Run:    npx playwright test -g "CU-017"
  // Checks: row highlighted; "Edit update", "<Project> · <STATUS>"; fields = saved values; Project locked; Save Changes
  test(...cu('CU-017'), async ({ cup, api, page }) => {
    const writes = writesOf(page);
    await cup.open();
    const first = (await updates(api)).items[0];
    test.skip(!first, 'No construction update saved yet');
    const saved = await update(api, first.id);
    await cup.openRow(saved.title);
    await expect.soft(cup.selectedRow, 'Row highlighted').toContainText(saved.title);
    await expect.soft(cup.detailSubtitle, 'Subtitle').toHaveText(`${saved.projectName} · ${saved.status}`);
    const form = await cup.form();
    note('form', form);
    expect.soft(form, 'Form = saved update').toEqual({
      projectId: saved.projectId, projectLocked: true, period: saved.periodLabel ?? '', title: saved.title,
      description: saved.description, portalVisible: saved.isVisibleToCustomers, submit: 'Save Changes',
    });
    expect(writes, 'Nothing saved').toEqual([]);
  });

  // ── CU-018 · A draft shows Publish and the photo gallery
  // Run:    npx playwright test -g "CU-018"
  // Checks: Publish button; gallery text, caption box, Add Photo; one card per saved photo or "No photos yet."
  test(...cu('CU-018'), async ({ cup, api }) => {
    await cup.open();
    const draft = (await updates(api)).items.find(u => u.status === 'DRAFT');
    test.skip(!draft, 'No draft saved');
    const saved = await update(api, draft!.id);
    await cup.openRow(saved.title);
    await expect.soft(cup.publishButton('Publish'), 'Publish button').toBeVisible();
    await expect.soft(cup.publishButton('Unpublish'), 'No Unpublish on a draft').toHaveCount(0);
    await expect.soft(cup.galleryText, 'Gallery text').toHaveText('Images upload to S3 and show on the portal after publish.');
    await expect.soft(cup.captionInput, 'Caption box').toBeVisible();
    await expect.soft(cup.addPhoto, 'Add Photo').toHaveText(/Add Photo/);
    const photos = saved.photos ?? [];
    note('photos', photos.length);
    expect.soft((await cup.photos()).map(p => p.text), 'Photo cards = saved photos').toEqual(photos.map(p => p.caption || p.fileName));
    if (!photos.length) await expect.soft(cup.noPhotos, '"No photos yet."').toBeVisible();
  });

  // ── CU-019 · New Update opens an empty draft form
  // Run:    npx playwright test -g "CU-019"
  // Checks: "New draft"; project options "<code> — <name>"; empty fields; portal ticked; Save Draft; no Publish, no gallery
  test(...cu('CU-019'), async ({ cup, api, page }) => {
    const writes = writesOf(page);
    await cup.open();
    const list = await projects(api);
    await cup.newUpdate('header');
    await expect.soft(cup.detailSubtitle, 'Subtitle').toHaveText('Save as draft first, then publish when ready.');
    expect.soft(await cup.optionLabels(cup.projectSelect), 'Project options').toEqual(['Select project', ...list.map(p => `${p.projectCode} — ${p.name}`)]);
    expect.soft(await cup.form(), 'Empty form').toEqual({
      projectId: list.length === 1 ? list[0].id : '', projectLocked: false, period: '', title: '', description: '', portalVisible: true, submit: 'Save Draft',
    });
    await expect.soft(cup.headerActions, 'No Publish button').toHaveCount(0);
    await expect.soft(cup.gallery, 'No photo gallery').toHaveCount(0);
    expect(writes, 'Nothing saved').toEqual([]);
  });

  // ── CU-020 · New Update in the detail panel opens the same form
  // Run:    npx playwright test -g "CU-020"
  test(...cu('CU-020'), async ({ cup }) => {
    await cup.open();
    await cup.newUpdate('panel');
    await expect.soft(cup.detailSubtitle).toHaveText('Save as draft first, then publish when ready.');
    const form = await cup.form();
    expect.soft({ title: form.title, description: form.description, period: form.period, submit: form.submit }, 'Empty form')
      .toEqual({ title: '', description: '', period: '', submit: 'Save Draft' });
  });

  // ── CU-021 · Switching between a row and New Update leaves no old text
  // Run:    npx playwright test -g "CU-021"
  // Test data: Title "unsaved text"
  test(...cu('CU-021'), async ({ cup, api, page }) => {
    const writes = writesOf(page);
    await cup.open();
    const first = (await updates(api)).items[0];
    test.skip(!first, 'No construction update saved yet');
    await cup.newUpdate();
    await cup.fill({ title: 'unsaved text' });
    await cup.openRow(first.title);
    expect.soft((await cup.form()).description, 'Row\'s own description').toBe(first.description);
    await cup.newUpdate();
    expect.soft((await cup.form()).title, 'New Update again: empty title').toBe('');
    expect.soft((await cup.form()).description, 'New Update again: empty description').toBe('');
    expect(writes, 'Nothing saved').toEqual([]);
  });
});

test.describe('Construction Updates · Validation', () => {
  // ── CU-022 · Title and Description are required
  // Run:    npx playwright test -g "CU-022"
  // Checks: both errors, fields marked invalid, cursor on Title, no error on Period label, no request sent
  test(...cu('CU-022'), async ({ cup, page }) => {
    const writes = writesOf(page);
    await cup.open();
    await cup.newUpdate();
    await cup.fill({ title: '', description: '' });
    await cup.submit.click();
    await expect.soft(cup.fieldError('Title'), 'Title error').toHaveText('Title is required.');
    await expect.soft(cup.fieldError('Description'), 'Description error').toHaveText('Description is required.');
    await expect.soft(cup.titleInput, 'Title marked invalid').toHaveClass(/is-invalid/);
    await expect.soft(cup.descriptionInput, 'Description marked invalid').toHaveClass(/is-invalid/);
    await expect.soft(cup.titleInput, 'Cursor on Title').toBeFocused();
    await expect.soft(cup.fieldError('Period label'), 'Period label is optional').toHaveCount(0);
    await expect.soft(cup.detailHeading, 'Still the new draft').toHaveText('New draft');
    expect(writes, 'No save request').toEqual([]);
  });

  // ── CU-023 · A title or description of only spaces is rejected
  // Run:    npx playwright test -g "CU-023"
  // Test data: Title "   ", Description "   "
  test(...cu('CU-023'), async ({ cup, page }) => {
    const writes = writesOf(page);
    await cup.open();
    await cup.newUpdate();
    await cup.fill({ title: '   ', description: '   ' });
    await cup.submit.click();
    await expect.soft(cup.fieldError('Title'), 'Title error').toHaveText('Title is required.');
    await expect.soft(cup.fieldError('Description'), 'Description error').toHaveText('Description is required.');
    expect(writes, 'No save request').toEqual([]);
  });

  // ── CU-024 · An error clears once the field is filled
  // Run:    npx playwright test -g "CU-024"
  // Test data: Title "Validation check"
  test(...cu('CU-024'), async ({ cup, page }) => {
    const writes = writesOf(page);
    await cup.open();
    await cup.newUpdate();
    await cup.submit.click();
    await expect(cup.fieldError('Title')).toBeVisible();
    await cup.fill({ title: 'Validation check' });
    await expect.soft(cup.fieldError('Title'), 'Title error gone').toHaveCount(0);
    await expect.soft(cup.fieldError('Description'), 'Description error stays').toHaveText('Description is required.');
    expect(writes, 'No save request').toEqual([]);
  });

  // ── CU-025 · Project is required
  // Run:    npx playwright test -g "CU-025"
  // Test data: "Select project", Title / Description "Validation check"
  test(...cu('CU-025'), async ({ cup, page }) => {
    const writes = writesOf(page);
    await cup.open();
    await cup.newUpdate();
    await cup.fill({ projectLabel: 'Select project', title: 'Validation check', description: 'Validation check' });
    await cup.submit.click();
    await expect.soft(cup.fieldError('Project'), 'Project error').toHaveText(/Project is required/);
    await expect.soft(cup.fieldErrors, 'Only the project error').toHaveCount(1);
    expect(writes, 'No save request').toEqual([]);
  });
});
