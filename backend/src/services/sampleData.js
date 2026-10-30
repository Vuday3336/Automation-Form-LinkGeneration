// Fictional data only. These names are invented and belong to no real person.

const DEPARTMENTS = ['Radiology', 'Cardiology', 'Emergency', 'Pediatrics', 'Pharmacy', 'Laboratory'];
const TYPES = ['Equipment Request', 'Supply Order', 'Maintenance Issue', 'Bed Transfer', 'Staffing Request'];
const PATIENTS = ['Test Patient Alpha', 'Test Patient Bravo', 'Test Patient Charlie', 'Test Patient Delta'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Builds a payload in exactly the shape Google Apps Script sends (see google-apps-script/Code.gs).
export function buildSamplePayload({
  sourceResponseId,
  hospital = 'Demo City General Hospital',
  department = pick(DEPARTMENTS),
  submissionType = pick(TYPES),
  patientName = pick(PATIENTS),
  submittedAt = new Date(),
  priority = pick(['Low', 'Medium', 'High']),
} = {}) {
  return {
    source: 'google_form',
    sourceResponseId,
    formId: 'demo-form',
    formTitle: 'Hospital Operations Request (Demo)',
    submittedAt: new Date(submittedAt).toISOString(),
    respondentEmail: null,
    answers: [
      { question: 'Hospital Name', answer: hospital, type: 'LIST' },
      { question: 'Department', answer: department, type: 'LIST' },
      { question: 'Submission Type', answer: submissionType, type: 'MULTIPLE_CHOICE' },
      { question: 'Patient Name', answer: patientName, type: 'TEXT' },
      { question: 'Priority', answer: priority, type: 'MULTIPLE_CHOICE' },
      { question: 'Request Details', answer: `Dummy ${submissionType.toLowerCase()} for ${department}. Test data only.`, type: 'PARAGRAPH_TEXT' },
      { question: 'Items Needed', answer: ['Item A', 'Item B'], type: 'CHECKBOX' },
    ],
  };
}

const DAY = 24 * 60 * 60 * 1000;

// A fixed set of demo submissions spread over the last 12 days, with mixed statuses,
// so the dashboard charts have something to show. Stable IDs make seeding repeatable.
export const DEMO_SUBMISSIONS = [
  { id: 'demo-001', hospital: 'Demo City General Hospital', department: 'Radiology', submissionType: 'Equipment Request', daysAgo: 11, status: 'Completed' },
  { id: 'demo-002', hospital: 'Demo City General Hospital', department: 'Emergency', submissionType: 'Supply Order', daysAgo: 9, status: 'Approved' },
  { id: 'demo-003', hospital: 'Sample Valley Medical Center', department: 'Cardiology', submissionType: 'Maintenance Issue', daysAgo: 8, status: 'Rejected' },
  { id: 'demo-004', hospital: 'Test River Children Hospital', department: 'Pediatrics', submissionType: 'Bed Transfer', daysAgo: 6, status: 'Under Review' },
  { id: 'demo-005', hospital: 'Demo City General Hospital', department: 'Pharmacy', submissionType: 'Supply Order', daysAgo: 5, status: 'Approved' },
  { id: 'demo-006', hospital: 'Sample Valley Medical Center', department: 'Laboratory', submissionType: 'Equipment Request', daysAgo: 4, status: 'Pending' },
  { id: 'demo-007', hospital: 'Demo City General Hospital', department: 'Radiology', submissionType: 'Staffing Request', daysAgo: 3, status: 'Under Review' },
  { id: 'demo-008', hospital: 'Test River Children Hospital', department: 'Emergency', submissionType: 'Maintenance Issue', daysAgo: 2, status: 'Pending' },
  { id: 'demo-009', hospital: 'Demo City General Hospital', department: 'Cardiology', submissionType: 'Equipment Request', daysAgo: 1, status: 'Pending' },
  { id: 'demo-010', hospital: 'Unknown Clinic (Demo)', department: 'Emergency', submissionType: 'Supply Order', daysAgo: 0, status: 'Pending' },
].map((s, i) => ({
  ...s,
  payload: buildSamplePayload({
    sourceResponseId: s.id,
    hospital: s.hospital,
    department: s.department,
    submissionType: s.submissionType,
    patientName: PATIENTS[i % PATIENTS.length],
    priority: ['Low', 'Medium', 'High'][i % 3],
    submittedAt: new Date(Date.now() - s.daysAgo * DAY - (i % 5) * 60 * 60 * 1000),
  }),
}));
