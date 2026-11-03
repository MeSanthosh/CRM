/** HLUC-02 Create Corporate Lead — cases LP-031 … LP-050 (Testcase/Leads_Page_Test_Cases.xlsx). */
import { declareCreateTests } from './create-lead';

declareCreateTests('Corporate', {
  open: 'LP-031', markers: 'LP-032', empty: 'LP-033', eachMandatory: 'LP-034',
  formats: ['LP-035', 'LP-036', 'LP-037', 'LP-038', 'LP-039', 'LP-040'], score: 'LP-041',
  create: 'LP-042', leadNo: 'LP-043', owner: 'LP-044', lists: 'LP-045',
  dupExact: 'LP-046', dupWording: 'LP-047', sameMobile: 'LP-048', sameEmail: 'LP-049', close: 'LP-050',
});
