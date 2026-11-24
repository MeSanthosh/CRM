/** Checks shared by the tab specs: tiles = API, narrative sentences quote the tiles. */
import { expect } from '../auth';
import type { DashboardsPage } from './DashboardsPage';
import { sheet, note, expectShows, shown } from './shared';

/** Every tile of the tab (Tiles sheet) shows its API value, rounded only as displayed. */
export async function tilesMatchApi(dash: DashboardsPage, tab: string) {
  const rows = sheet('Tiles').filter(t => t['Tab'] === tab);
  const seen: string[] = [];
  for (const t of rows) {
    const tile = await dash.tile(t['Label']);
    const api = dash.source(t['Source']);
    seen.push(`${t['Label']}: "${tile?.value ?? '—'}" / API ${api}`);
    expect.soft(tile, `${t['Label']} is shown`).toBeTruthy();
    if (!tile) continue;
    expect.soft(typeof api === 'number', `${t['Label']}: API value ${t['Source']} found`).toBeTruthy();
    expectShows(tile.value, Number(api), `${tab} › ${t['Label']} = API ${t['Source']}`, t['Kind'] === 'percent' ? 0.05 : 0);
    if (t['Kind'] === 'money') expect.soft(/\$|USD/.test(tile.value), `${t['Label']}: shows its currency ("${tile.value}")`).toBeTruthy();
    if (t['Kind'] === 'percent') expect.soft(tile.value.trim().endsWith('%'), `${t['Label']}: shows % ("${tile.value}")`).toBeTruthy();
    if (t['Kind'] === 'count') expect.soft(Number.isInteger(shown(tile.value).value), `${t['Label']}: whole number ("${tile.value}")`).toBeTruthy();
  }
  note('tiles', seen.join(' | '));
}

/** Each narrative template of the tab is found in the page with the tiles' values filled in. */
export async function narrativesQuoteTiles(dash: DashboardsPage, tab: string) {
  const text = (await dash.lines()).join(' ');
  for (const r of sheet('Narratives').filter(x => x['Tab'] === tab)) {
    let want = r['Sentence Contains'];
    for (const label of want.match(/\{[^}]+\}/g) ?? []) want = want.replace(label, (await dash.tileValue(label.slice(1, -1))) || label);
    note('sentence', want);
    expect.soft(text, `Sentence quotes the tiles: "${want}"`).toContain(want);
  }
}
