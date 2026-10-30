import { ApiError } from '../utils/apiResponse.js';

// Turns a raw Google Form payload into the fields we store.
//
// Forms can have any questions, so we don't hard-code positions. Instead we recognise a few
// key questions by their title (case and trailing punctuation ignored). Every answer is kept
// in formData; the patient name is pulled out into its own encrypted field so it can be hidden
// from roles that may not see it.

const FIELD_ALIASES = {
  hospitalName: ['hospital', 'hospital name', 'facility', 'facility name', 'hospital / facility'],
  patientName: ['patient name', 'patient', 'patient full name', 'name of patient'],
  department: ['department', 'dept', 'ward', 'unit', 'department / ward'],
  submissionType: ['submission type', 'request type', 'type of request', 'form type', 'category'],
};

const normaliseTitle = (title) =>
  title
    .toLowerCase()
    .replace(/[*?:.]+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

const ALIAS_LOOKUP = new Map(
  Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => [alias, field]))
);

// Flattens checkbox/grid answers into readable text for the key fields.
function answerToText(answer) {
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) return answer.flat().map(String).join(', ');
  return String(answer).trim();
}

export function normalizeGoogleFormPayload(payload) {
  const keyFields = {};
  const answers = [];

  for (const item of payload.answers) {
    const field = ALIAS_LOOKUP.get(normaliseTitle(item.question));
    if (field && keyFields[field] === undefined) {
      keyFields[field] = answerToText(item.answer) || null;
      if (field === 'patientName') continue; // stored separately (encrypted, access-controlled)
    }
    answers.push({ question: item.question, answer: item.answer, ...(item.type && { type: item.type }) });
  }

  if (!keyFields.hospitalName) {
    throw ApiError.badRequest('Validation failed', [
      {
        field: 'answers',
        message: `No hospital answer found. Add a question titled one of: ${FIELD_ALIASES.hospitalName.join(', ')}`,
      },
    ]);
  }

  return {
    source: payload.source,
    sourceResponseId: payload.sourceResponseId,
    submittedAt: new Date(payload.submittedAt),
    hospitalName: keyFields.hospitalName.slice(0, 200),
    patientName: keyFields.patientName ?? null,
    department: keyFields.department?.slice(0, 120) ?? null,
    submissionType: keyFields.submissionType?.slice(0, 120) ?? null,
    formData: {
      formId: payload.formId ?? null,
      formTitle: payload.formTitle ?? null,
      respondentEmail: payload.respondentEmail ?? null,
      answers,
    },
  };
}
