/**
 * Figures of the other modules, read through the app's own API with the browser's session (read only): the independent
 * side of every integration check. Each list is read completely (100 per page) and cached for the test.
 */
import { expect } from '../auth';
import { CrmApi } from '../opportunities-page/api';

export class ModuleSources {
  private cache = new Map<string, any>();
  constructor(readonly api: CrmApi) {}

  async get(path: string): Promise<any> {
    if (this.cache.has(path)) return this.cache.get(path);
    const r = await this.api.get(path);
    expect(r.status, `GET ${path}`).toBe(200);
    this.cache.set(path, r.body);
    return r.body;
  }
  /** A GET that is never cached (for values a test changes). */
  async fresh(path: string): Promise<any> {
    const r = await this.api.get(path);
    expect(r.status, `GET ${path}`).toBe(200);
    return r.body;
  }
  /** Every item of a list endpoint, plus its summary. */
  async list(path: string): Promise<{ items: any[]; summary: any; total: number }> {
    const key = `list:${path}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const items: any[] = [];
    let summary: any, total = 0;
    for (let offset = 0; offset < 20_000; offset += 100) {
      const b = await this.get(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
      summary ??= b.summary;
      total = b.pagination?.total ?? (b.items ?? []).length;
      items.push(...(b.items ?? []));
      if (items.length >= total || !(b.items ?? []).length) break;
    }
    const out = { items, summary, total };
    this.cache.set(key, out);
    return out;
  }

  leads() { return this.list('/leads'); }
  opportunities() { return this.list('/opportunities'); }
  contracts() { return this.list('/contracts'); }
  reservations() { return this.list('/reservations'); }
  units() { return this.list('/inventory/units'); }
  projects() { return this.list('/inventory/projects'); }
  collections() { return this.get('/contracts/collections-summary'); }
  currencies() { return this.get('/currencies/display-context'); }
  preferences() { return this.get('/preferences/my-workspace'); }
  leadMagnet() { return this.get('/dashboard/ai/lead-magnet'); }
  /** Tasks & Calendar summary for today in the browser's time zone (as the app asks it). */
  async taskSummary(scope?: 'mine' | 'team') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const r = await this.api.get(`/activities/summary?todayStart=${start.toISOString()}&todayEnd=${end.toISOString()}${scope ? `&scope=${scope}` : ''}`);
    return { status: r.status, body: r.body };
  }
  /** Site visits of every opportunity (they live on the opportunity record, not in Tasks & Calendar). */
  async siteVisits(): Promise<{ opportunityNo: string; visitDate: string; visitType: string; status: string }[]> {
    if (this.cache.has('visits')) return this.cache.get('visits');
    const out: { opportunityNo: string; visitDate: string; visitType: string; status: string }[] = [];
    for (const o of (await this.opportunities()).items) {
      const d = await this.get(`/opportunities/${o.id}`);
      for (const v of d.siteVisits ?? []) out.push({ opportunityNo: o.opportunityNo, visitDate: v.visitDate ?? v.scheduledAt ?? v.createdAt ?? '', visitType: v.visitType?.name ?? v.visitType ?? '', status: v.status?.name ?? v.status ?? v.outcome ?? '' });
    }
    this.cache.set('visits', out);
    return out;
  }
  /** 1 USD in KES by the Currency module (ratesToBase holds the value of 1 unit in USD). */
  async usdToKes(): Promise<number> {
    const c = await this.currencies();
    return 1 / c.ratesToBase.KES;
  }
}
