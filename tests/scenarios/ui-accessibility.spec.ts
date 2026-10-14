/**
 * Workbook areas: Browser and Responsive Testing (RA-112…118), Accessibility and UI Validation (RA-119…126).
 * The accessibility checks are automated approximations of WCAG 2.1 AA (names, labels, focus, contrast);
 * they don't replace a screen-reader pass.
 */
import { test, expect, Page, firefox, webkit, BrowserType } from '../auth';
import { open, waitForKpi } from '../helpers';
import { ROUTES, HUB_SNAPSHOT, XP, at } from '../locators';
import { scenario, manual, note, openReport, ERROR_TEXT } from './support';

const R = ROUTES.reports;
const SIZES = { desktop: { width: 1440, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } };
const PAGES = [ROUTES.hub, R.sales, ROUTES.leads];

/** Pixels the page is wider than the window (horizontal scroll). */
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** KPI cards that overlap each other or whose value is cut off. */
const layoutProblems = (page: Page) => page.evaluate(() => {
  const cards = [...document.querySelectorAll('main article.crm-card, main .crm-module-hub-kpi, main .crm-exec-kpi-card')]
    .map(e => ({ e, r: e.getBoundingClientRect(), label: (e.querySelector('h3, span') as HTMLElement | null)?.innerText.trim() ?? '' }))
    .filter(c => c.r.width > 0);
  const out: string[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i].r, b = cards[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(`"${cards[i].label}" overlaps "${cards[j].label}"`);
    }
    const v = cards[i].e.querySelector('strong, .crm-kpi') as HTMLElement | null;
    if (v && v.scrollWidth > v.clientWidth + 1) out.push(`"${cards[i].label}" value is cut off ("${v.innerText}")`);
  }
  return out;
});

async function atSize(page: Page, size: keyof typeof SIZES, check: (path: string) => Promise<void>) {
  await page.setViewportSize(SIZES[size]);
  for (const path of PAGES) {
    await open(page, path);
    await check(path);
  }
}

async function noOverflow(page: Page, size: keyof typeof SIZES) {
  await atSize(page, size, async path => {
    expect.soft(await overflow(page), `${path} at ${size}: horizontal overflow (px)`).toBeLessThanOrEqual(1);
    expect.soft(await layoutProblems(page), `${path} at ${size}: KPI layout`).toEqual([]);
  });
}

/** WCAG contrast ratio problems for visible text in <main>. */
const contrastProblems = (page: Page) => page.evaluate(() => {
  const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /** Solid background behind an element, or null when it sits on an image/gradient (can't be measured). */
  const bg = (el: Element | null): number[] | null => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgb(s.backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const seen = new Set<string>();
  const out: string[] = [];
  const els = [...document.querySelectorAll('main *')].filter(e => {
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
    const r = e.getBoundingClientRect();
    return own && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  });
  for (const e of els) {
    const s = getComputedStyle(e);
    const fg = rgb(s.color).slice(0, 3);
    const b = bg(e);
    if (!b) continue;
    const [l1, l2] = [lum(fg), lum(b)].sort((x, y) => y - x);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    const key = `${s.color}|${b.join(',')}`;
    if (ratio < need && !seen.has(key)) {
      seen.add(key);
      out.push(`${ratio.toFixed(2)}:1 (needs ${need}) "${(e as HTMLElement).innerText.trim().slice(0, 30)}" ${s.color} on rgb(${b.join(', ')})`);
    }
  }
  return out;
});

test.describe('Scenarios · Browser and Responsive Testing', () => {
  test(...scenario('RA-112', 'In Chromium the hub, Sales Reports and Leads pages load with all their data'), async ({ page, browserName }) => {
    expect(browserName).toBe('chromium');
    await open(page, ROUTES.hub);
    for (const l of HUB_SNAPSHOT) await waitForKpi(page, l);
    await openReport(page, R.sales);
    await waitForKpi(page, 'Open opportunities');
    await open(page, ROUTES.leads);
    await expect(at(page, XP.leadsTable)).toBeVisible();
  });

  test(...scenario('RA-113', 'In Firefox and WebKit (Safari engine) the hub loads and shows all 8 snapshot values'), async ({ baseURL, storageState }) => {
    const tried: string[] = [];
    for (const [name, type] of [['firefox', firefox], ['webkit', webkit]] as [string, BrowserType][]) {
      let browser;
      try {
        browser = await type.launch();
      } catch {
        tried.push(`${name}: not installed (run "npx playwright install ${name}")`);
        continue;
      }
      const ctx = await browser.newContext({ baseURL, storageState });
      const page = await ctx.newPage();
      await open(page, ROUTES.hub);
      for (const l of HUB_SNAPSHOT) await waitForKpi(page, l);
      tried.push(`${name}: OK`);
      await browser.close();
    }
    note('browsers', tried.join(' | '));
    test.skip(tried.every(t => t.includes('not installed')), 'Firefox and WebKit are not installed');
  });

  test(...scenario('RA-114', 'At 1440×900 the hub, Sales Reports and Leads have no horizontal scroll and no overlapping or cut-off KPI cards'), async ({ page }) => { await noOverflow(page, 'desktop'); });

  test(...scenario('RA-115', 'At tablet size (768×1024) the pages have no horizontal scroll and no overlapping or cut-off KPI cards'), async ({ page }) => { await noOverflow(page, 'tablet'); });

  test(...scenario('RA-116', 'At phone size (390×844) the menu collapses behind a Menu button and pages have no horizontal scroll'), async ({ page }) => {
    await noOverflow(page, 'mobile');
    await expect.soft(page.locator('button.crm-mobile-nav-toggle'), 'Menu button').toBeVisible();
  });

  test(...scenario('RA-117', 'On tablet and phone, the period filter, tabs, Reset filters and Export stay visible and usable; wide tables scroll inside their panel'), async ({ page }) => {
    for (const size of ['tablet', 'mobile'] as const) {
      await page.setViewportSize(SIZES[size]);
      await open(page, R.sales);
      for (const [name, loc] of [
        ['Period filter', at(page, XP.reportPeriod)], ['Inventory tab', at(page, XP.reportTab('Inventory'))],
        ['Reset filters', at(page, XP.reportResetFilters)], ['Export', at(page, XP.reportPanelExport('Open Opportunities'))],
      ] as const) {
        await loc.scrollIntoViewIfNeeded();
        await expect.soft(loc, `${name} visible at ${size}`).toBeVisible();
        // Reset filters is disabled until a filter changes, by design
        if (name !== 'Reset filters') await expect.soft(loc, `${name} enabled at ${size}`).toBeEnabled();
        const box = await loc.boundingBox();
        expect.soft((box?.x ?? 0) + (box?.width ?? 0), `${name} inside the screen at ${size}`).toBeLessThanOrEqual(SIZES[size].width + 1);
      }
      const unscrollable = await page.evaluate(() => [...document.querySelectorAll('main table')].filter(t => {
        if (t.getBoundingClientRect().width <= window.innerWidth) return false;
        for (let e = t.parentElement; e && e.tagName !== 'MAIN'; e = e.parentElement) {
          if (/(auto|scroll)/.test(getComputedStyle(e).overflowX)) return false;
        }
        return true;
      }).map(t => t.closest('section')?.querySelector('h3')?.textContent ?? 'table'));
      expect.soft(unscrollable, `Wide tables without their own scroll at ${size}`).toEqual([]);
    }
  });

  test(...scenario('RA-118', 'At desktop, tablet and phone sizes no KPI card overlaps another and no value is cut off'), async ({ page }) => {
    for (const size of Object.keys(SIZES) as (keyof typeof SIZES)[]) {
      await page.setViewportSize(SIZES[size]);
      for (const path of [ROUTES.hub, ROUTES.dashboard, R.sales, R.collections]) {
        await open(page, path);
        expect.soft(await layoutProblems(page), `${path} at ${size}`).toEqual([]);
      }
    }
  });
});

test.describe('Scenarios · Accessibility and UI Validation', () => {
  test(...scenario('RA-119', 'Using only the Tab key you reach the period filter, the report tabs and Export, and the focused control is always visibly highlighted'), async ({ page }) => {
    await open(page, R.sales);
    const reached = new Set<string>();
    const invisible = new Set<string>();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || e === document.body) return null;
        const s = getComputedStyle(e);
        const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        const name = e.getAttribute('aria-label') || e.innerText?.trim().slice(0, 30) || e.tagName;
        return { id: `${e.tagName.toLowerCase()} "${name}"`, cls: e.className, tag: e.tagName, visible };
      });
      if (!f) continue;
      if (f.tag === 'SELECT' && /crm-input/.test(f.cls)) reached.add('select');
      if (/crm-tab-button/.test(f.cls)) reached.add('tab');
      if (/crm-export-button/.test(f.cls)) reached.add('export');
      if (!f.visible) invisible.add(f.id);
    }
    expect.soft([...reached].sort(), 'Controls reached with Tab').toEqual(['export', 'select', 'tab']);
    expect.soft([...invisible], 'Focused controls without a visible focus indicator').toEqual([]);
  });

  test(...scenario('RA-120', 'Every filter, dropdown and input on the report and Leads pages has a label a screen reader can announce'), async ({ page }) => {
    const missing: string[] = [];
    for (const path of [R.sales, R.leads, ROUTES.leads]) {
      await open(page, path);
      missing.push(...(await page.evaluate(p => [...document.querySelectorAll('main select, main input:not([type=hidden])')].filter(e => {
        const el = e as HTMLInputElement;
        return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.length || el.getAttribute('title'));
      }).map(e => `${p}: <${e.tagName.toLowerCase()}> first option/placeholder "${(e as HTMLSelectElement).options?.[0]?.text ?? (e as HTMLInputElement).placeholder}"`), path)));
    }
    expect.soft(missing, 'Controls without a label').toEqual([]);
  });

  test(...scenario('RA-121', 'Every visible button and link has an accessible name (text, aria-label or title)'), async ({ page }) => {
    const missing: string[] = [];
    for (const path of [ROUTES.hub, R.sales, ROUTES.leads]) {
      await open(page, path);
      missing.push(...(await page.evaluate(p => [...document.querySelectorAll('button, a[href]')].filter(e => {
        const el = e as HTMLElement;
        if (el.getBoundingClientRect().width === 0) return false;
        const svgTitle = el.querySelector('svg title')?.textContent;
        const imgAlt = el.querySelector('img')?.getAttribute('alt');
        return !(el.innerText.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || svgTitle || imgAlt);
      }).map(e => `${p}: <${e.tagName.toLowerCase()} class="${e.className}">`), path)));
    }
    expect.soft([...new Set(missing)], 'Buttons/links without a name').toEqual([]);
  });

  test(...scenario('RA-122', 'Text on the hub, Sales Reports, Collections and Leads meets WCAG AA contrast (4.5:1, or 3:1 for large text)'), async ({ page }) => {
    const problems: string[] = [];
    for (const path of [ROUTES.hub, R.sales, R.collections, ROUTES.leads]) {
      await open(page, path);
      problems.push(...(await contrastProblems(page)).map(p => `${path}: ${p}`));
    }
    expect.soft(problems, 'Low-contrast text').toEqual([]);
  });

  test(...scenario('RA-123', 'Pages have main and navigation landmarks and a top heading; tables have column headers; images have alt text; decorative icons are hidden from screen readers'), async ({ page }) => {
    const issues: string[] = [];
    for (const path of [ROUTES.hub, R.sales, ROUTES.leads]) {
      await open(page, path);
      issues.push(...(await page.evaluate(p => {
        const out: string[] = [];
        if (!document.querySelector('main, [role=main]')) out.push('no <main> landmark');
        if (!document.querySelector('nav, [role=navigation]')) out.push('no navigation landmark');
        if (!document.querySelector('h1')) out.push('no <h1> heading');
        document.querySelectorAll('main table').forEach((t, i) => { if (!t.querySelector('th')) out.push(`table ${i + 1} has no header cells`); });
        document.querySelectorAll('img:not([alt])').forEach(img => out.push(`image without alt: ${(img as HTMLImageElement).src.slice(-40)}`));
        const icons = [...document.querySelectorAll('svg')].filter(s => s.getAttribute('aria-hidden') !== 'true' && !s.querySelector('title') && !s.getAttribute('aria-label'));
        if (icons.length) out.push(`${icons.length} icons not hidden from screen readers (no aria-hidden / title)`);
        return out.map(o => `${p}: ${o}`);
      }, path)));
    }
    expect.soft(issues, 'Screen-reader issues').toEqual([]);
  });

  test(...scenario('RA-124', 'When a report fails to load, the error message is visible on screen, readable (contrast ≥ 4.5:1) and announced (role="alert" or aria-live)'), async ({ page }) => {
    await page.route('**/api/v1/reports/business/sales**', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Internal Server Error"}' }));
    await page.goto(R.sales);
    await page.waitForLoadState('networkidle').catch(() => {});
    const msg = page.locator('main').getByText(ERROR_TEXT).first();
    await expect(msg, 'Error message').toBeVisible({ timeout: 20_000 });
    await msg.scrollIntoViewIfNeeded();
    const info = await msg.evaluate(e => ({
      live: !!e.closest('[role=alert], [aria-live]'),
      text: (e as HTMLElement).innerText.trim(),
    }));
    note('error message', info.text);
    expect.soft(info.live, 'Announced to screen readers (role=alert / aria-live)').toBeTruthy();
    expect.soft((await contrastProblems(page)).filter(p => p.includes(info.text.slice(0, 20))), 'Error text contrast').toEqual([]);
  });

  test(...scenario('RA-125', 'KPI cards in a row share the same top edge and height, and every KPI value / label uses the same font size on a page'), async ({ page }) => {
    const issues: string[] = [];
    for (const path of [R.sales, R.inventory, R.collections]) {
      await open(page, path);
      issues.push(...(await page.evaluate(p => {
        const cards = [...document.querySelectorAll('main article.crm-card')].filter(c => c.querySelector('.crm-kpi'));
        const out: string[] = [];
        const rows = new Map<number, DOMRect[]>();
        cards.forEach(c => { const r = c.getBoundingClientRect(); const k = Math.round(r.top); rows.set(k, [...(rows.get(k) ?? []), r]); });
        rows.forEach((rs, top) => { if (new Set(rs.map(r => Math.round(r.height))).size > 1) out.push(`row at ${top}px has cards of different heights`); });
        const size = (sel: string) => new Set(cards.map(c => getComputedStyle(c.querySelector(sel)!).fontSize));
        if (size('.crm-kpi').size > 1) out.push(`KPI values use font sizes ${[...size('.crm-kpi')].join(', ')}`);
        if (size('h3').size > 1) out.push(`KPI labels use font sizes ${[...size('h3')].join(', ')}`);
        return out.map(o => `${p}: ${o}`);
      }, path)));
    }
    expect.soft(issues, 'Alignment / typography').toEqual([]);
  });

  test(...manual('RA-126', 'needs the approved UI design (Figma or screenshots) to compare against'));
});
