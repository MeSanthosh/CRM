/**
 * Construction Updates · backend checks (CU-026…CU-030), called with the browser's own login (CrmApi).
 * The two refused creates (CU-028, CU-029) send invalid data on purpose; if the backend wrongly accepts one,
 * the test fails and names the record it created.
 *
 * Run this file:  npx playwright test tests/construction-updates/api.spec.ts
 * Run one case:   npx playwright test -g "CU-028"
 */
import { test, expect, note, updates, projects } from './fixtures';
import { cu } from './catalog';

const NO_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Construction Updates · API', () => {
  // `api` is listed so it exists before the page loads: it takes its token from the page's own requests
  test.beforeEach(async ({ cup, api }) => { await cup.open(); await api.ready(); });

  // ── CU-026 · Construction updates cannot be read without logging in
  // Run:    npx playwright test -g "CU-026"
  test(...cu('CU-026'), async ({ api }) => {
    const r = await api.call('GET', '/construction-updates?limit=1', undefined, { auth: 'none' });
    note('response', { status: r.status, code: r.body?.code });
    expect.soft(r.status, 'HTTP status').toBe(401);
    expect.soft(r.body?.code, 'Error code').toBe('AUTH_TOKEN_REQUIRED');
    expect.soft(JSON.stringify(r.body), 'No update data returned').not.toContain('"items"');
  });

  // ── CU-027 · An unknown update returns "not found"
  // Run:    npx playwright test -g "CU-027"
  // Test data: 00000000-0000-0000-0000-000000000000
  test(...cu('CU-027'), async ({ api }) => {
    const r = await api.get(`/construction-updates/${NO_ID}`);
    note('response', { status: r.status, code: r.body?.code });
    expect.soft(r.status, 'HTTP status').toBe(404);
    expect.soft(r.body?.code, 'Error code').toBe('CONSTRUCTION_UPDATE_NOT_FOUND');
  });

  // ── CU-028 · The backend refuses an update without title or description
  // Run:    npx playwright test -g "CU-028"
  // Test data: title "", description ""
  test(...cu('CU-028'), async ({ api }) => {
    const [project] = await projects(api);
    test.skip(!project, 'No project can have construction updates');
    const r = await api.call('POST', '/construction-updates', { projectId: project.id, title: '', description: '' });
    note('response', { status: r.status, code: r.body?.code, fields: r.body?.issues?.map((i: any) => i.path?.join('.')) });
    expect(r.body?.id, `Backend created update ${r.body?.id} from an empty title / description`).toBeUndefined();
    expect.soft(r.status, 'HTTP status').toBe(400);
    expect.soft(r.body?.code, 'Error code').toBe('VALIDATION_ERROR');
    expect.soft((r.body?.issues ?? []).map((i: any) => i.path?.[0]).sort(), 'Fields named').toEqual(['description', 'title']);
  });

  // ── CU-029 · The backend refuses an unknown project
  // Run:    npx playwright test -g "CU-029"
  // Test data: projectId 00000000-0000-0000-0000-000000000000
  test(...cu('CU-029'), async ({ api }) => {
    const r = await api.call('POST', '/construction-updates', { projectId: NO_ID, title: 'Automated test - unknown project', description: 'Must be refused' });
    note('response', { status: r.status, code: r.body?.code });
    expect(r.body?.id, `Backend created update ${r.body?.id} for a project that does not exist`).toBeUndefined();
    expect.soft(r.status, 'HTTP status').toBe(404);
    expect.soft(r.body?.code, 'Error code').toBe('PROJECT_NOT_FOUND');
  });

  // ── CU-030 · The status filter and project list come from the backend correctly
  // Run:    npx playwright test -g "CU-030"
  // Checks: ?status=X returns only X (and all of them); projects = the screen's project filter
  test(...cu('CU-030'), async ({ api, cup }) => {
    const all = (await updates(api)).items;
    const counts: Record<string, number> = {};
    for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      const items = (await updates(api, { status })).items;
      counts[status] = items.length;
      expect.soft(items.filter(u => u.status !== status).map(u => u.title), `?status=${status}: other statuses`).toEqual([]);
      expect.soft(items.length, `?status=${status}: every ${status} update`).toBe(all.filter(u => u.status === status).length);
    }
    note('by status', counts);
    const list = await projects(api);
    expect.soft(await cup.optionLabels(cup.projectFilter), 'Project filter = backend projects').toEqual(['All projects', ...list.map(p => p.name)]);
    expect.soft(all.filter(u => !list.some(p => p.id === u.projectId)).map(u => u.title), 'Updates whose project is not in the list').toEqual([]);
  });
});
