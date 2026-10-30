export const DEFAULT_PROGRAM_ID = 'GLP-01';
export const DEMO_AI_MODEL = 'gemini-2.5-flash';
export const DEMO_AI_STATUS = 'demo-untrained';
export const CADENCES = Object.freeze(['Daily', 'Weekly', 'Fortnightly', 'Monthly']);
export const FIXED_REWARD = Object.freeze({amount: 2, unit: 'test ADA'});

const DEFAULT_SYMPTOMS = ['Fatigue', 'Difficulty sleeping', 'Physical discomfort'];
const DEFAULT_REVIEW_FOCUS = 'Summarize the reported experience, missing information, and requests for clinic follow-up. Cite the supplied answers. Do not infer a diagnosis, treatment adherence, dishonesty, or reward eligibility.';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${name} must be an object.`);
  return value;
}

function text(value, name, max, fallback, required = false) {
  const raw = value === undefined ? fallback : value;
  if (typeof raw !== 'string') throw Error(`${name} must be text.`);
  const normalized = raw.trim();
  if ((required && !normalized) || normalized.length > max) throw Error(`${name} must contain ${required ? '1' : '0'}–${max} characters.`);
  return normalized;
}

function list(value, name, maxItems, maxLength, fallback, minItems = 0) {
  const raw = value === undefined ? fallback : value;
  if (!Array.isArray(raw) || raw.length < minItems || raw.length > maxItems) throw Error(`${name} must contain ${minItems}–${maxItems} items.`);
  const normalized = raw.map(item => text(item, name, maxLength, undefined, true));
  if (new Set(normalized.map(item => item.toLowerCase())).size !== normalized.length) throw Error(`${name} must not contain duplicate items.`);
  return normalized;
}

function defaultLabels(hasMedication) {
  return {
    status: hasMedication ? 'Current treatment status' : 'How have you been overall?',
    symptoms: hasMedication ? 'What have you noticed?' : 'Your experience this period',
    details: 'When did these experiences start or change? (optional)',
    impact: 'How much did these experiences affect your usual activities?',
    hydration: 'Have you been able to drink and keep fluids down?',
    contact: 'Would you like the clinic to contact you?',
    notes: 'Anything else for the clinic? (optional)',
  };
}

/** Normalize editable demo data. This does not authorize a real clinic or validate a clinical questionnaire. */
export function normalizeProgram(input) {
  const source = object(input, 'Program');
  const id = text(source.id, 'Program ID', 32, undefined, true).toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(id)) throw Error('Program ID must start with a letter and contain 2–32 letters, digits, hyphens or underscores.');
  const medicationOptions = list(source.medicationOptions, 'Medication options', 12, 100, []);
  const cadence = text(source.cadence, 'Reporting cadence', 20, 'Weekly', true);
  if (!CADENCES.includes(cadence)) throw Error('Choose Daily, Weekly, Fortnightly or Monthly reporting.');
  if (source.active !== undefined && typeof source.active !== 'boolean') throw Error('Active must be true or false.');

  const ai = source.ai === undefined ? {} : object(source.ai, 'AI configuration');
  const model = text(ai.model, 'AI model', 80, DEMO_AI_MODEL, true);
  const status = text(ai.status, 'AI status', 40, DEMO_AI_STATUS, true);
  if (model !== DEMO_AI_MODEL) throw Error(`This demo supports only ${DEMO_AI_MODEL}; custom trained models are not connected.`);
  if (status !== DEMO_AI_STATUS) throw Error('The demo assistant must remain marked demo-untrained.');

  const reward = source.reward === undefined ? FIXED_REWARD : object(source.reward, 'Reward');
  if (reward.amount !== FIXED_REWARD.amount || reward.unit !== FIXED_REWARD.unit) throw Error('The current reward contract supports a fixed 2 test ADA reward.');
  const customLabels = source.labels === undefined ? {} : object(source.labels, 'Question labels');
  const labels = Object.fromEntries(Object.entries(defaultLabels(medicationOptions.length > 0))
    .map(([key, fallback]) => [key, text(customLabels[key], `Question label ${key}`, 160, fallback, true)]));

  return {
    id,
    name: text(source.name, 'Program name', 100, undefined, true),
    condition: text(source.condition, 'Program focus', 160, 'General follow-up', true),
    description: text(source.description, 'Program description', 700, ''),
    cadence,
    medicationOptions,
    symptoms: list(source.symptoms, 'Questionnaire topics', 20, 100, DEFAULT_SYMPTOMS, 1),
    urgentOptions: list(source.urgentOptions, 'Concern indicators', 10, 200, []),
    labels,
    ai: {
      label: text(ai.label, 'AI label', 100, 'Gemini demo assistant', true),
      model,
      status,
      instructions: text(ai.instructions, 'AI review focus', 1600, DEFAULT_REVIEW_FOCUS),
    },
    reward: {...FIXED_REWARD},
    active: source.active === undefined ? true : source.active,
  };
}

export function normalizePrograms(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) throw Error('The demo registry must contain 1–30 programs.');
  const programs = input.map(normalizeProgram);
  if (new Set(programs.map(program => program.id)).size !== programs.length) throw Error('Each program needs a unique program ID.');
  return programs;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const DEFAULT_PROGRAMS = freeze(normalizePrograms([
  {
    id: 'GLP-01',
    name: 'GLP-1 treatment follow-up',
    condition: 'Ozempic / semaglutide follow-up',
    description: 'A fictional weekly check-in about treatment exposure, reported symptoms, daily impact and requested clinic follow-up. The questionnaire requires clinical review before any real use.',
    medicationOptions: ['Ozempic (semaglutide)', 'Other prescribed medication'],
    symptoms: ['Nausea', 'Vomiting', 'Diarrhoea', 'Constipation', 'Abdominal discomfort', 'Reduced appetite', 'Fatigue', 'Dizziness'],
    urgentOptions: ['Severe, persistent abdominal pain', 'Sudden loss or rapid worsening of vision', 'Difficulty breathing or swelling of face / throat'],
    ai: {
      label: 'GLP-1 review assistant · demo',
      instructions: 'Summarize the participant’s reported GLP-1 treatment experience. Identify unclear dates, reported changes, symptom timing, daily impact and requested follow-up. Do not assume medication caused a symptom or recommend medication changes. An unknown response is not evidence that symptoms are absent.',
    },
  },
  {
    id: 'WELL-01',
    name: 'General wellbeing check-in',
    condition: 'Everyday wellbeing and daily activities',
    description: 'A fictional non-medication check-in about energy, sleep, comfort and daily activities. This is an editable demonstration questionnaire, not a diagnostic or validated assessment.',
    medicationOptions: [],
    symptoms: ['Fatigue', 'Difficulty sleeping', 'Difficulty concentrating', 'Physical discomfort'],
    urgentOptions: ['A new concern I want the clinic to review'],
    labels: {symptoms: 'Your wellbeing this period', details: 'What changed this period? (optional)'},
    ai: {
      label: 'Wellbeing review assistant · demo',
      instructions: 'Summarize reported wellbeing and effects on daily activities. Highlight unclear descriptions, changes and requests for follow-up. Do not infer a diagnosis or assume medication use. This program has no medication-specific questions.',
    },
  },
  {
    id: 'MED-01',
    name: 'Medication experience follow-up',
    condition: 'Participant-reported medication experience',
    description: 'A fictional general check-in about a prescribed medication, reported changes, missed doses and day-to-day experience. It does not verify medication use or recommend treatment.',
    medicationOptions: ['My prescribed medication', 'Other prescribed medication'],
    symptoms: ['Nausea', 'Headache', 'Dizziness', 'Fatigue', 'Difficulty sleeping'],
    urgentOptions: ['A new or worsening concern I want the clinic to review'],
    ai: {
      label: 'Medication review assistant · demo',
      instructions: 'Summarize medication experience using only the participant’s statements. Highlight missing medication names, unclear timing, reported changes, missed doses and follow-up requests. Do not infer adherence, causation or dishonesty, and do not recommend medication changes.',
    },
  },
]));

export function getProgram(id = DEFAULT_PROGRAM_ID, programs = DEFAULT_PROGRAMS) {
  const wanted = text(id, 'Program ID', 32, undefined, true).toUpperCase();
  const program = normalizePrograms(programs).find(candidate => candidate.id === wanted);
  if (!program) throw Error('This program is not available in the demo registry.');
  return program;
}

/** Send this as untrusted structured user data; custom review focus must never override system policy. */
export function programAIContext(input) {
  const program = normalizeProgram(input);
  return {
    id: program.id,
    name: program.name,
    condition: program.condition,
    description: program.description,
    cadence: program.cadence,
    medicationOptions: program.medicationOptions,
    symptoms: program.symptoms,
    urgentOptions: program.urgentOptions,
    labels: program.labels,
    reviewFocus: program.ai.instructions,
    model: program.ai.model,
    modelStatus: program.ai.status,
  };
}
