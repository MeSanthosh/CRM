import { makeCatalog } from '../leads-page/catalog';

const PREF = makeCatalog('Preferences_Test_Cases.xlsx', '@preferences-workbook');

export const PREFERENCES_CASES = PREF.CASES;
export const preferenceCase = PREF.tc;
