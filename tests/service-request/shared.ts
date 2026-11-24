/** Helpers shared by the Service Requests specs. */
import { test } from '../pages/fixtures';
import { SR_CASES, TAG, sr } from './catalog';

/** Registers a case marked "Manual" in the workbook as Skipped, with the workbook's reason. */
export function manual(id: string) {
  const [title, details] = sr(id);
  test(title, { ...details, tag: [TAG, '@manual'] }, () => {
    test.skip(true, `Manual: ${SR_CASES[id].remarks || 'not automated'}`);
  });
}

/** Write cases create one ticket per run and change only that ticket; SKIP_SR_WRITE_TESTS=true turns them off. */
export const writesAllowed = process.env.SKIP_SR_WRITE_TESTS !== 'true';

/** Text values rendered for a missing value. */
export const isDash = (s: string) => /^[—–-]?$/.test(s.trim());

/** The longest word (4+ letters) of a text, for search tests. */
export const longestWord = (s: string) => (s.match(/[A-Za-z]{4,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
