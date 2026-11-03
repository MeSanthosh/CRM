/**
 * Construction Updates · saves on live QA data (CU-031…CU-039) — runs in order in one worker.
 *
 * Updates cannot be deleted (no Delete control, no DELETE route), so the suite keeps ONE test draft,
 * "Automated test update - do not publish": CU-031 creates it the first time and later runs reuse it.
 * Its portal visibility is left OFF, so publishing it never reaches the customer portal or messages a buyer.
 * Every test undoes its own change in a finally block through the API: photos it uploaded are removed and a
 * published draft is unpublished, so a failing step leaves nothing behind.
 * Test cases that need other accounts or would message real buyers (CU-040…CU-042) are listed as Skipped.
 *
 * Run this file:  npx playwright test tests/construction-updates/lifecycle.spec.ts
 * Run one case:   npx playwright test -g "CU-034"
 */
import { test, expect, note, update, testDraft, needDraft, testFile, thisMonth, Update, TEST_TITLE, TEST_FILE } from './fixtures';
import { cu, cuSkipped } from './catalog';
import { CrmApi } from '../opportunities/api';

test.describe.configure({ mode: 'default' });

const DESCRIPTION = 'Created by the automated test suite. Do not publish.';
const stamp = () => new Date().toISOString().slice(11, 19);

/** Removes every photo on the test draft whose file name starts with "automated-". */
async function removeTestPhotos(api: CrmApi, id: string) {
  for (const p of ((await update(api, id)).photos ?? []).filter(x => TEST_FILE.test(x.fileName))) {
    const r = await api.call('DELETE', `/construction-updates/${id}/photos/${p.id}`);
    note('cleanup', `removed photo ${p.fileName}: ${r.status}`);
  }
}

/** Puts the test draft back to DRAFT when a step left it published. */
async function unpublish(api: CrmApi, id: string) {
  if ((await update(api, id)).status !== 'PUBLISHED') return;
  const r = await api.call('POST', `/construction-updates/${id}/publish`, { publish: false });
  note('cleanup', `unpublished: ${r.status}`);
}

/** Saves the draft's fields through the API (the app's own PATCH body). */
async function patch(api: CrmApi, d: Update, change: Partial<Pick<Update, 'title' | 'description' | 'periodLabel' | 'isVisibleToCustomers'>>) {
  const body = { title: d.title, description: d.description, periodLabel: d.periodLabel, isVisibleToCustomers: d.isVisibleToCustomers, ...change };
  const r = await api.call('PATCH', `/construction-updates/${d.id}`, body);
  expect(r.status, 'PATCH /construction-updates/<id>').toBe(200);
}

test.describe('Construction Updates · Lifecycle (live QA data)', () => {
  // ── CU-031 · Save a new draft
  // Run:    npx playwright test -g "CU-031"
  // Test data: Title "Automated test update - do not publish", Period <current month>, portal visibility off
  // Creates the test draft only when it does not exist yet; otherwise records "reused" and checks the saved draft.
  test(...cu('CU-031'), async ({ cup, api }) => {
    await cup.open();
    const existing = await testDraft(api);
    if (existing) {
      note('test draft', `reused ${existing.id} (created ${existing.createdAt}); updates cannot be deleted, so it is created only once`);
      expect.soft((await cup.rows()).filter(r => r.title === TEST_TITLE), 'Test draft listed once').toHaveLength(1);
      expect.soft(existing.status, 'Saved as a draft').toBe('DRAFT');
      return;
    }
    const before = await cup.count();
    await cup.newUpdate();
    const project = (await cup.optionLabels(cup.projectSelect))[1];
    await cup.fill({ projectLabel: project, period: thisMonth(), title: TEST_TITLE, description: DESCRIPTION, portalVisible: false });
    const res = await cup.save();
    note('create', { status: res.status() });
    expect(res.status(), 'POST /construction-updates').toBe(201);
    const created: Update = await res.json();
    await expect.soft(cup.success, 'Success message').toHaveText('Draft saved. Add photos if needed, then Publish for the customer portal.');
    await expect.soft(cup.detailHeading, 'Panel switches to edit').toHaveText('Edit update');
    await expect.soft(cup.detailSubtitle, 'Subtitle').toHaveText(`${created.projectName} · DRAFT`);
    await expect.poll(() => cup.count(), { message: '"Updates (N)" + 1' }).toBe(before + 1);
    expect.soft((await cup.rows())[0], 'First row').toEqual({ title: TEST_TITLE, project: created.projectName, period: thisMonth(), status: 'DRAFT' });
    const saved = await update(api, created.id);
    expect.soft({ title: saved.title, description: saved.description, periodLabel: saved.periodLabel, isVisibleToCustomers: saved.isVisibleToCustomers, status: saved.status }, 'Saved values')
      .toEqual({ title: TEST_TITLE, description: DESCRIPTION, periodLabel: thisMonth(), isVisibleToCustomers: false, status: 'DRAFT' });
  });

  // ── CU-032 · Edit a draft and save the changes
  // Run:    npx playwright test -g "CU-032"
  // Test data: Period "<current month> (automated <time>)", Description with the run time
  test(...cu('CU-032'), async ({ cup, api, page }) => {
    await cup.open();
    const d = await needDraft(api);
    const period = `${thisMonth()} (automated ${stamp()})`;
    const description = `${DESCRIPTION} Last edited ${new Date().toISOString()}`;
    note('values', { period, description });
    await cup.openRow(TEST_TITLE);
    await cup.fill({ period, description });
    const res = await cup.save();
    expect(res.status(), 'PATCH /construction-updates/<id>').toBe(200);
    await expect.soft(cup.success, 'Success message').toHaveText('Changes saved.');
    await expect.poll(async () => (await cup.rows()).find(r => r.title === TEST_TITLE)?.period, { message: 'List shows the new period' }).toBe(period);
    await page.reload();
    await cup.open();
    await cup.openRow(TEST_TITLE);
    const form = await cup.form();
    expect.soft({ period: form.period, description: form.description }, 'Saved values after reload').toEqual({ period, description });
    const saved = await update(api, d.id);
    expect.soft(saved.updatedAt > d.updatedAt, 'updatedAt moved on').toBeTruthy();
  });

  // ── CU-033 · The portal visibility setting is saved
  // Run:    npx playwright test -g "CU-033"
  // Ticks the box and saves, then unticks and saves (the draft is left NOT visible to customers).
  test(...cu('CU-033'), async ({ cup, api, page }) => {
    await cup.open();
    const d = await needDraft(api);
    try {
      for (const visible of [true, false]) {
        await cup.openRow(TEST_TITLE);
        await cup.fill({ portalVisible: visible });
        expect((await cup.save()).status(), `Save with portal visibility ${visible ? 'on' : 'off'}`).toBe(200);
        await expect(cup.success).toHaveText('Changes saved.');
        await page.reload();
        await cup.open();
        await cup.openRow(TEST_TITLE);
        expect.soft(await cup.portalCheckbox.isChecked(), `Checkbox after reload (${visible ? 'ticked' : 'unticked'})`).toBe(visible);
        expect.soft((await update(api, d.id)).isVisibleToCustomers, `Saved visibility (${visible})`).toBe(visible);
      }
    } finally {
      const now = await update(api, d.id);
      if (now.isVisibleToCustomers) { await patch(api, now, { isVisibleToCustomers: false }); note('cleanup', 'portal visibility set back to off'); }
    }
  });

  // ── CU-034 · Add a photo with a caption
  // Run:    npx playwright test -g "CU-034"
  // Test data: automated-photo.png (1×1 PNG), caption "Automated caption <time>"
  test(...cu('CU-034'), async ({ cup, api }) => {
    await cup.open();
    const d = await needDraft(api);
    const caption = `Automated caption ${stamp()}`;
    try {
      await cup.openRow(TEST_TITLE);
      const res = await cup.uploadPhoto(testFile('automated-photo.png'), caption);
      note('upload', { status: res.status() });
      expect(res.status(), 'POST /construction-updates/<id>/photos').toBe(201);
      await expect.soft(cup.success, 'Success message').toHaveText('Photo uploaded.');
      await expect(cup.photoCard(caption), 'Photo card with the caption').toBeVisible();
      await expect.soft(cup.photoCard(caption).getByRole('button', { name: 'Remove' }), 'Remove link').toBeVisible();
      await expect.poll(async () => (await cup.photos()).find(p => p.text === caption)?.loaded, { message: 'Image loads', timeout: 15_000 }).toBe(true);
      await expect.soft(cup.captionInput, 'Caption box empty again').toHaveValue('');
      const photo = ((await update(api, d.id)).photos ?? []).find(p => p.caption === caption);
      expect.soft(photo && { fileName: photo.fileName, contentType: photo.contentType, visibility: photo.visibility }, 'Saved photo')
        .toEqual({ fileName: 'automated-photo.png', contentType: 'image/png', visibility: 'CUSTOMER' });
    } finally {
      await removeTestPhotos(api, d.id);
    }
  });

  // ── CU-035 · A photo without a caption shows its file name
  // Run:    npx playwright test -g "CU-035"
  // Test data: automated-nocaption.png
  test(...cu('CU-035'), async ({ cup, api }) => {
    await cup.open();
    const d = await needDraft(api);
    try {
      await cup.openRow(TEST_TITLE);
      expect((await cup.uploadPhoto(testFile('automated-nocaption.png'))).status(), 'Upload').toBe(201);
      await expect(cup.photoCard('automated-nocaption.png'), 'Card shows the file name').toBeVisible();
    } finally {
      await removeTestPhotos(api, d.id);
    }
  });

  // ── CU-036 · Remove a photo
  // Run:    npx playwright test -g "CU-036"
  // Uploads automated-remove.png (caption "Remove me <time>"), then removes it with its Remove link.
  test(...cu('CU-036'), async ({ cup, api }) => {
    await cup.open();
    const d = await needDraft(api);
    const caption = `Remove me ${stamp()}`;
    try {
      await cup.openRow(TEST_TITLE);
      expect((await cup.uploadPhoto(testFile('automated-remove.png'), caption)).status(), 'Upload').toBe(201);
      await expect(cup.photoCard(caption)).toBeVisible();
      await cup.removePhoto(caption);
      await expect.soft(cup.success, 'Success message').toHaveText('Photo removed.');
      await expect.soft(cup.photoCard(caption), 'Card gone').toHaveCount(0);
      await expect.poll(async () => ((await update(api, d.id)).photos ?? []).some(p => p.caption === caption), { message: 'Photo no longer saved' }).toBe(false);
      if (!((await update(api, d.id)).photos ?? []).length) await expect.soft(cup.noPhotos, '"No photos yet."').toBeVisible();
    } finally {
      await removeTestPhotos(api, d.id);
    }
  });

  // ── CU-037 · A file that is not an image is refused
  // Run:    npx playwright test -g "CU-037"
  // Test data: automated-not-an-image.txt
  test(...cu('CU-037'), async ({ cup, api }) => {
    await cup.open();
    const d = await needDraft(api);
    try {
      await cup.openRow(TEST_TITLE);
      await expect.soft(cup.fileInput, 'Picker offers images only').toHaveAttribute('accept', 'image/*');
      const res = await cup.uploadPhoto(testFile('automated-not-an-image.txt'));
      note('upload', { status: res.status(), body: (await res.text()).slice(0, 200) });
      expect.soft(res.status(), 'Backend refuses the file').toBeGreaterThanOrEqual(400);
      await expect.soft(cup.error, 'Error message shown').toBeVisible();
      expect.soft(((await update(api, d.id)).photos ?? []).map(p => p.fileName), 'No photo added').not.toContain('automated-not-an-image.txt');
    } finally {
      await removeTestPhotos(api, d.id);
    }
  });

  // ── CU-038 · Publish a draft
  // Run:    npx playwright test -g "CU-038"
  // Portal visibility is forced off first, so nothing reaches customers; the draft is unpublished again afterwards.
  test(...cu('CU-038'), async ({ cup, api }) => {
    await cup.open();
    let d = await needDraft(api);
    try {
      if (d.isVisibleToCustomers) { await patch(api, d, { isVisibleToCustomers: false }); d = await update(api, d.id); }
      expect(d.isVisibleToCustomers, 'Portal visibility off before publishing').toBe(false);
      await cup.openRow(TEST_TITLE);
      const res = await cup.togglePublish('Publish');
      const body = await res.text();
      note('publish', { status: res.status(), body: body.slice(0, 300) });
      expect(res.status(), `POST /construction-updates/<id>/publish → ${body.slice(0, 200)}`).toBe(200);
      await expect.soft(cup.success, 'Success message').toHaveText(/^Published/);
      await expect.soft(cup.detailSubtitle, 'Subtitle').toHaveText(`${d.projectName} · PUBLISHED`);
      await expect.soft(cup.publishButton('Unpublish'), 'Unpublish button').toBeVisible();
      await expect.poll(async () => (await cup.rows()).find(r => r.title === TEST_TITLE)?.status, { message: 'List shows PUBLISHED' }).toBe('PUBLISHED');
      await cup.filterStatus('Published');
      expect.soft((await cup.rows()).map(r => r.title), 'Listed under Published').toContain(TEST_TITLE);
      expect.soft((await update(api, d.id)).publishedAt, 'Publish date saved').toBeTruthy();
    } finally {
      await unpublish(api, d.id);
    }
  });

  // ── CU-039 · Unpublish returns the update to draft
  // Run:    npx playwright test -g "CU-039"
  // Publishes the test draft through the API first (portal visibility off), then unpublishes it on the screen.
  test(...cu('CU-039'), async ({ cup, api, page }) => {
    await cup.open();
    let d = await needDraft(api);
    try {
      if (d.isVisibleToCustomers) { await patch(api, d, { isVisibleToCustomers: false }); d = await update(api, d.id); }
      if (d.status !== 'PUBLISHED') {
        const r = await api.call('POST', `/construction-updates/${d.id}/publish`, { publish: true });
        test.skip(r.status !== 200, `Not run: the test draft cannot be published (POST /publish returned ${r.status} ${r.body?.code ?? ''}), see CU-038. Unpublish was not checked.`);
      }
      await page.reload();
      await cup.open();
      await cup.openRow(TEST_TITLE);
      const res = await cup.togglePublish('Unpublish');
      note('unpublish', { status: res.status() });
      expect(res.status(), 'POST /construction-updates/<id>/publish (false)').toBe(200);
      await expect.soft(cup.success, 'Success message').toHaveText('Unpublished — back to draft.');
      await expect.soft(cup.detailSubtitle, 'Subtitle').toHaveText(`${d.projectName} · DRAFT`);
      await expect.soft(cup.publishButton('Publish'), 'Publish button back').toBeVisible();
      await expect.poll(async () => (await cup.rows()).find(r => r.title === TEST_TITLE)?.status, { message: 'List shows DRAFT' }).toBe('DRAFT');
    } finally {
      await unpublish(api, d.id);
    }
  });
});

test.describe('Construction Updates · Manual', () => {
  // ── CU-040 · Customers see only published, portal-visible updates of their own projects
  // Run:    npx playwright test -g "CU-040"   (reported as Skipped)
  test(...cuSkipped('CU-040', 'Manual: needs customer portal logins for buyers of different projects, and an update that can be published to the portal.'));

  // ── CU-041 · Users without create / update permission cannot change updates
  // Run:    npx playwright test -g "CU-041"   (reported as Skipped)
  test(...cuSkipped('CU-041', 'Manual: needs a user whose role has view-only Construction Updates permission; the suite logs in as CRM Administrator only.'));

  // ── CU-042 · Publishing a portal-visible update messages the project's buyers
  // Run:    npx playwright test -g "CU-042"   (reported as Skipped)
  test(...cuSkipped('CU-042', 'Manual: publishing a portal-visible update sends Construction Milestone messages to real buyers on QA; run it only on a project whose buyers may receive test messages.'));
});

