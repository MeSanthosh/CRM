/**
 * Calls the CRM backend the way the app does: same base URL and Bearer token, taken from the app's
 * own requests (the token lives in the browser session, not in a file). Used for checks the UI cannot
 * make: record fields, stage history, and that the backend itself refuses forbidden operations.
 */
import { Page, APIRequestContext, expect } from '@playwright/test';
import { ROUTES } from '../locators';

export type ApiResult = { status: number; body: any };

export class CrmApi {
  base = '';
  private headers: Record<string, string> = {};

  constructor(readonly page: Page) {
    page.on('request', r => {
      const m = r.url().match(/^(https?:\/\/[^/]+\/api\/v1)\//);
      const auth = r.headers()['authorization'];
      if (m && auth) {
        this.base = m[1];
        this.headers = { authorization: auth };
        for (const h of ['x-client-app', 'x-client-platform']) if (r.headers()[h]) this.headers[h] = r.headers()[h];
      }
    });
  }

  /** Makes sure a base URL and token were seen (opens /opportunities if the page has not called the API yet). */
  async ready() {
    if (!this.base) {
      await this.page.goto(ROUTES.opportunities);
      await expect.poll(() => this.base, { message: 'app made an authenticated API call' }).not.toBe('');
    }
    return this;
  }

  private get http(): APIRequestContext { return this.page.request; }

  async call(method: string, path: string, body?: unknown, opts: { auth?: 'session' | 'none' | 'invalid' } = {}): Promise<ApiResult> {
    await this.ready();
    const auth = opts.auth ?? 'session';
    const headers: Record<string, string> = { ...this.headers, 'content-type': 'application/json' };
    if (auth === 'none') delete headers.authorization;
    if (auth === 'invalid') headers.authorization = 'Bearer invalid.token.value';
    const res = await this.http.fetch(`${this.base}${path}`, { method, headers, data: body === undefined ? undefined : JSON.stringify(body), failOnStatusCode: false });
    const text = await res.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status(), body: parsed };
  }

  get(path: string) { return this.call('GET', path); }

  async opportunity(id: string) {
    const r = await this.get(`/opportunities/${id}`);
    expect(r.status, `GET /opportunities/${id}`).toBe(200);
    return r.body;
  }

  /** Opportunities whose number, customer or lead matches `search` (first 100). */
  async searchOpportunities(search: string): Promise<any[]> {
    const r = await this.get(`/opportunities?search=${encodeURIComponent(search)}&limit=100&offset=0`);
    expect(r.status, 'GET /opportunities?search=…').toBe(200);
    return r.body.items ?? r.body;
  }

  /** Reference data family, e.g. OPPORTUNITY/STAGE → [{ id, level2Code, level2Name }]. */
  async reference(family: string): Promise<{ id: string; level2Code: string; level2Name: string }[]> {
    const r = await this.get(`/reference-data/families/${family}`);
    expect(r.status, `GET /reference-data/families/${family}`).toBe(200);
    return r.body.items ?? r.body;
  }
}
