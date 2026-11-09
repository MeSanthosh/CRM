/**
 * Source records behind the executive reports, read the way the CRM screens read them: GET calls to the app's own
 * API with the logged-in session (Inventory → /inventory/units, SPA Contracts → /contracts, an opportunity's detail,
 * Marketing → campaign overview, RPT-03 → the governance report). Read-only: nothing here sends anything but GET.
 */
import { Page, Request, expect } from '@playwright/test';
import { ROUTES } from '../locators';

export type Unit = { unitCode: string; basePrice: number; projectCode?: string; unitType: string; netArea: number; productCode?: string };
/** A contract with the salesperson and broker of its opportunity (the contract itself carries neither). */
export type Contract = {
  contractNo: string; unitCode?: string; status: string; value: number; signedDay: string; contractDay: string; projectCode?: string;
  ownerUserId: string | null; ownerName: string | null; brokerId: string | null; brokerName: string | null;
};
export type Campaign = { campaignCode: string; name: string; budget: number };
export type Product = {
  productCode: string; name: string; unitType: string; ratePerSqm: number; currency: string;
  subType: string; bedrooms: number; netArea: number; units: number;
};
/** A reservation with the salesperson of its opportunity. */
export type Reservation = { reservationNo: string; status: string; day: string; unitCode?: string; ownerUserId: string | null };

const API = '/api/v1';
const PAGE_SIZE = 100;
const day = (iso?: string | null) => (iso ?? '').slice(0, 10);

export class CrmData {
  private auth?: string;
  private base?: string;
  private cache = new Map<string, unknown>();

  constructor(readonly page: Page) {
    // keep the newest bearer token the app sends (it refreshes every 15 minutes)
    page.on('request', (r: Request) => {
      const h = r.headers().authorization;
      if (h && r.url().includes(`${API}/`)) { this.auth = h; this.base = r.url().split(API)[0] + API; }
    });
  }

  /** GET an API path as the logged-in user (opens the app first if it has not called the API yet). */
  async get<T>(path: string): Promise<T> {
    if (!this.auth) {
      await this.page.goto(ROUTES.dashboard);
      await expect.poll(() => !!this.auth, { message: 'The app called its API with the session token', timeout: 30_000 }).toBe(true);
    }
    const r = await this.page.request.get(this.base + path, { headers: { authorization: this.auth! } });
    expect(r.ok(), `GET ${path} → HTTP ${r.status()}`).toBeTruthy();
    return r.json() as Promise<T>;
  }

  private async all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const body = await this.get<{ items?: T[] } | T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=${PAGE_SIZE}&offset=${offset}`);
      const page = Array.isArray(body) ? body : body.items ?? [];
      items.push(...page);
      if (page.length < PAGE_SIZE) return items;
    }
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) this.cache.set(key, load());
    return this.cache.get(key) as Promise<T>;
  }

  /** Every inventory unit with its base price (Inventory module). */
  units(): Promise<Unit[]> {
    return this.memo('units', async () => (await this.all<any>('/inventory/units?sortBy=createdAt&sortDir=desc'))
      .map(u => ({
      unitCode: u.unitCode, basePrice: Number(u.basePrice) || 0, projectCode: u.project?.projectCode,
      unitType: u.unitType?.name ?? '', netArea: Number(u.netArea) || 0, productCode: u.product?.code,
    })));
  }

  /** Inventory products (unit types) with their target rate per sqm. */
  products(): Promise<Product[]> {
    return this.memo('products', async () => (await this.all<any>('/inventory/products')).map(p => ({
      productCode: p.productCode, name: p.productName, unitType: p.unitType?.name ?? p.unitType ?? '',
      ratePerSqm: Number(p.targetRatePerSqm) || 0, currency: p.targetRateCurrency ?? '',
      subType: p.unitSubType?.name ?? '', bedrooms: Number(p.bedroomCount) || 0,
      netArea: Number(p.unitStats?.minNetArea) || 0, units: Number(p.unitStats?.units) || 0,
    })));
  }

  /** An opportunity's detail (salesperson, broker), read once per id. */
  opportunity(id: string): Promise<any> {
    return this.memo(`opp:${id}`, () => this.get<any>(`/opportunities/${id}`));
  }

  /** Every reservation (Reservations module) with its status, date, unit and its opportunity's salesperson. */
  reservations(): Promise<Reservation[]> {
    return this.memo('reservations', async () => Promise.all((await this.all<any>('/reservations')).map(async r => ({
      reservationNo: r.reservationNo, status: r.reservationStatus?.code ?? r.status, day: day(r.reservationDate), unitCode: r.unit?.unitCode,
      ownerUserId: r.opportunity?.id ? (await this.opportunity(r.opportunity.id))?.assignedToUser?.id ?? null : null,
    }))));
  }

  /** Every SPA contract (SPA / Sales Contracts module) with its opportunity's salesperson and broker. */
  contracts(): Promise<Contract[]> {
    return this.memo('contracts', async () => {
      const list = await this.all<any>('/contracts?sortBy=createdAt&sortDir=desc');
      return Promise.all(list.map(async c => {
        const opp = c.opportunity?.id ? await this.opportunity(c.opportunity.id) : undefined;
        const rsv = c.reservation?.id ? await this.get<any>(`/reservations/${c.reservation.id}`) : undefined;
        const broker = opp?.broker?.id ? opp.broker : rsv?.broker?.id ? rsv.broker : undefined;
        return {
          contractNo: c.contractNo, unitCode: c.unit?.unitCode, status: c.contractStatus?.code ?? c.status, value: Number(c.contractValue) || 0,
          signedDay: day(c.signedAt), contractDay: day(c.contractDate), projectCode: c.project?.projectCode,
          ownerUserId: opp?.assignedToUser?.id ?? null, ownerName: opp?.assignedToUser?.name ?? null,
          brokerId: broker?.id ?? null, brokerName: broker?.name ?? null,
        };
      }));
    });
  }

  /** Marketing campaigns with their budgets (Marketing Campaigns module). */
  campaigns(): Promise<Campaign[]> {
    return this.memo('campaigns', async () => {
      const body = await this.get<any>('/leads/lookup/campaign-overview');
      const list: any[] = Array.isArray(body) ? body : body.items ?? [];
      return list.map(c => ({ campaignCode: c.campaignCode, name: c.name, budget: Number(c.budgetAmount ?? c.budget) || 0 }));
    });
  }

  /** Rows of one table of a governance report (e.g. RPT-03 Control & Assumptions). */
  governanceTable(key: string): Promise<Record<string, string>[]> {
    return this.memo(`gov:${key}`, async () => {
      const body = await this.get<any>('/reports/business/governance?period=this_month');
      const table = body.tables?.find((t: { key: string }) => t.key === key);
      expect(table, `Governance table ${key}`).toBeTruthy();
      return table.rows;
    });
  }
}
