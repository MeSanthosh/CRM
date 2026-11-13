import { makeCatalog } from '../leads-page/catalog';

const RDM = makeCatalog('Reference_Data_Test_Cases.xlsx', '@reference-data-workbook');

export const REFERENCE_DATA_CASES = RDM.CASES;
export const referenceCase = RDM.tc;
