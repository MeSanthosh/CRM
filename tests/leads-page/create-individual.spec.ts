/** HLUC-01 Create Individual Lead — cases LP-001 … LP-022 (Testcase/Leads_Page_Test_Cases.xlsx). */
import { declareCreateTests } from './create-lead';

declareCreateTests('Individual', {
  open: 'LP-001', markers: 'LP-002', empty: 'LP-003', eachMandatory: 'LP-004',
  formats: ['LP-005', 'LP-006', 'LP-007', 'LP-008', 'LP-009'], score: 'LP-010',
  create: 'LP-011', leadNo: 'LP-012', owner: 'LP-013', lists: 'LP-014', profile: 'LP-015',
  dupExact: 'LP-016', dupWording: 'LP-017', dupCase: 'LP-018', sameMobile: 'LP-019', sameEmail: 'LP-020', sameName: 'LP-021', close: 'LP-022',
});
