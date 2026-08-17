const ICD_TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
const ICD_API_BASE = 'https://id.who.int';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getIcdConfig() {
  const clientId = process.env.ICD11_CLIENT_ID || process.env.WHO_ICD11_CLIENT_ID || '';
  const clientSecret = process.env.ICD11_CLIENT_SECRET || process.env.WHO_ICD11_CLIENT_SECRET || '';
  const releaseId = process.env.ICD11_RELEASE_ID || '2026-01';
  const language = process.env.ICD11_LANGUAGE || 'en';
  return { clientId, clientSecret, releaseId, language };
}

function textValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value['@value'] || value.value || value.label || '';
}

function stripMarkup(value) {
  return String(value || '').replace(/<\/?[^>]+(>|$)/g, '').replace(/\s+/g, ' ').trim();
}

function entityIdFromUri(uri = '') {
  const clean = String(uri || '').split('?')[0].replace(/\/$/, '');
  return clean.split('/').pop() || '';
}

// Maps ICD-11 MMS codes and title keywords to Kairacure treatment categories.
// ICD-11 chapter codes: 01=Infections, 02=Neoplasms, 05=Endocrine, 07=Sleep,
// 08=Nervous, 09=Visual, 10=Ear, 11=Circulatory, 12=Respiratory, 13=Digestive,
// 14=Skin, 15=Musculoskeletal, 16=Genitourinary, 17=Sexual Health,
// 18=Pregnancy, 19=Neonatal, 20=Developmental, 21=Dental, 22=Injury, 23=External.
const ICD_CATEGORY_MAP = [
  // Code-prefix rules (matched against the leading digits/letters of the ICD code)
  { prefixes: ['BA', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', '11'], category: 'Cardiac Sciences', group: 'Cardiac Sciences', specialty: 'Cardiology' },
  { prefixes: ['FB', 'FC', 'FA', 'FD', 'FE', 'FF', 'NA', 'NB', 'NC', 'ND', '15'], category: 'Orthopedics', group: 'Orthopedics', specialty: 'Orthopedics' },
  { prefixes: ['2B', '2C', '2D', '2E', '2F', '2A', '02'], category: 'Oncology', group: 'Oncology', specialty: 'Oncology' },
  { prefixes: ['8A', '8B', '8C', '8D', '8E', '8F', '8G', '08'], category: 'Neurosurgery', group: 'Neurosurgery', specialty: 'Neurology' },
  { prefixes: ['9A', '9B', '9C', '9D', '9E', '09'], category: 'Ophthalmology', group: 'Ophthalmology', specialty: 'Ophthalmology' },
  { prefixes: ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', '13'], category: 'Gastroenterology', group: 'Gastroenterology', specialty: 'Gastroenterology' },
  { prefixes: ['CB', 'CC', 'CD', 'CE', 'CF', 'CA', '12'], category: 'Pulmonology', group: 'Pulmonology', specialty: 'Pulmonology' },
  { prefixes: ['GB', 'GC', 'GA', '16'], category: 'Urology', group: 'Urology', specialty: 'Urology' },
  { prefixes: ['5A', '5B', '5C', '5D', '05'], category: 'Endocrinology', group: 'Endocrinology', specialty: 'Endocrinology' },
  { prefixes: ['JA', 'JB', 'JC', 'JD', '14'], category: 'Dermatology', group: 'Aesthetic', specialty: 'Dermatology' },
  { prefixes: ['LA', 'LB', 'LC', 'LD', 'LE', 'LF', '18', '17'], category: 'Obstetrics & Gynecology', group: 'Obstetrics & Gynecology', specialty: 'Gynecology' },
  { prefixes: ['KA', 'KB', 'KC', '21'], category: 'Dental', group: 'Dental', specialty: 'Dentistry' },
  { prefixes: ['DA', 'DB', 'DC', 'DD', 'DE', 'DF', '10'], category: 'ENT', group: 'ENT', specialty: 'Otolaryngology' },
  { prefixes: ['EA', 'EB', 'EC', 'ED', 'EE', 'EF'], category: 'Aesthetic', group: 'Aesthetic', specialty: 'Plastic Surgery' },
  { prefixes: ['01', '1A', '1B', '1C', '1D', '1E', '1F', '1G'], category: 'Infectious Diseases', group: 'Medical', specialty: 'Internal Medicine' },
  { prefixes: ['22', 'NA2'], category: 'Trauma & Orthopedics', group: 'Orthopedics', specialty: 'Orthopedics' },
];

// Keyword rules applied to the title when code-prefix matching fails.
const ICD_KEYWORD_MAP = [
  { keywords: ['heart', 'cardiac', 'coronary', 'bypass', 'valve', 'aorta', 'myocardial', 'angina', 'pacemaker', 'arrhythmia', 'atrial', 'ventricular', 'cardiomyopathy'], category: 'Cardiac Sciences', group: 'Cardiac Sciences', specialty: 'Cardiology' },
  { keywords: ['bone', 'joint', 'knee', 'hip', 'spine', 'vertebra', 'fracture', 'ligament', 'arthro', 'scoliosis', 'orthopedic', 'arthroplasty', 'lumbar', 'cervical disc'], category: 'Orthopedics', group: 'Orthopedics', specialty: 'Orthopedics' },
  { keywords: ['cancer', 'tumor', 'tumour', 'carcinoma', 'lymphoma', 'leukemia', 'melanoma', 'sarcoma', 'oncology', 'neoplasm', 'malignant', 'chemotherapy'], category: 'Oncology', group: 'Oncology', specialty: 'Oncology' },
  { keywords: ['brain', 'neural', 'neurology', 'neurosurg', 'stroke', 'epilepsy', 'parkinson', 'alzheimer', 'spinal cord', 'cerebral', 'meningi'], category: 'Neurosurgery', group: 'Neurosurgery', specialty: 'Neurology' },
  { keywords: ['eye', 'retina', 'cataract', 'glaucoma', 'cornea', 'lasik', 'optic', 'vision', 'ophthalmol'], category: 'Ophthalmology', group: 'Ophthalmology', specialty: 'Ophthalmology' },
  { keywords: ['liver', 'gastro', 'intestin', 'colon', 'bowel', 'stomach', 'pancrea', 'hepatic', 'crohn', 'ibd', 'rectal', 'hernia', 'gallbladder', 'bariatric', 'weight loss'], category: 'Gastroenterology', group: 'Gastroenterology', specialty: 'Gastroenterology' },
  { keywords: ['lung', 'respiratory', 'bronch', 'asthma', 'copd', 'pulmon', 'pleura', 'trachea', 'pneumonia'], category: 'Pulmonology', group: 'Pulmonology', specialty: 'Pulmonology' },
  { keywords: ['skin', 'dermat', 'psoria', 'acne', 'eczema', 'cosmetic', 'hair loss', 'hair transplant', 'rhinoplasty', 'liposuction', 'breast implant', 'facelift', 'aesthetic', 'plastic surg', 'botox', 'filler'], category: 'Aesthetic', group: 'Aesthetic', specialty: 'Dermatology' },
  { keywords: ['kidney', 'renal', 'urology', 'bladder', 'prostate', 'ureter', 'urinary', 'nephr', 'dialysis', 'kidney transplant', 'renal transplant'], category: 'Urology', group: 'Urology', specialty: 'Urology' },
  { keywords: ['diabetes', 'thyroid', 'endocrin', 'hormone', 'insulin', 'adrenal', 'pituitary', 'metabolic'], category: 'Endocrinology', group: 'Endocrinology', specialty: 'Endocrinology' },
  { keywords: ['gynecol', 'uterus', 'ovary', 'fibroid', 'endometri', 'cervic', 'pregnan', 'fertility', 'ivf', 'hysterect', 'laparoscop'], category: 'Obstetrics & Gynecology', group: 'Obstetrics & Gynecology', specialty: 'Gynecology' },
  { keywords: ['dental', 'tooth', 'teeth', 'implant', 'orthodont', 'gum', 'periodon', 'root canal', 'wisdom'], category: 'Dental', group: 'Dental', specialty: 'Dentistry' },
  { keywords: ['ear', 'nose', 'throat', 'sinusit', 'tonsil', 'septum', 'hearing', 'cochlear', 'audiolog', 'rhinit', 'larynx', 'vocal cord'], category: 'ENT', group: 'ENT', specialty: 'Otolaryngology' },
  { keywords: ['wellness', 'ayurved', 'yoga', 'meditation', 'detox', 'spa', 'naturopath', 'holistic', 'rehabilitation', 'physio'], category: 'Wellness', group: 'Wellness', specialty: 'Wellness' },
  { keywords: ['infect', 'virus', 'bacteria', 'hiv', 'tuberculosis', 'malaria', 'dengue', 'hepatitis'], category: 'Infectious Diseases', group: 'Medical', specialty: 'Internal Medicine' },
];

/**
 * Classifies an ICD-11 entity into a Kairacure treatment category.
 * Returns { category, group, specialty } — never falls back to "ICD-11 MMS".
 */
export function classifyIcdCategory(entity = {}) {
  const code = String(entity.code || entity.icdCode || '').toUpperCase().trim();
  const title = String(entity.title || entity.matchedText || '').toLowerCase();

  // 1. Try code-prefix match (most precise)
  if (code) {
    for (const rule of ICD_CATEGORY_MAP) {
      if (rule.prefixes.some((prefix) => code.startsWith(prefix.toUpperCase()))) {
        return { category: rule.category, group: rule.group, specialty: rule.specialty };
      }
    }
  }

  // 2. Try title keyword match
  for (const rule of ICD_KEYWORD_MAP) {
    if (rule.keywords.some((kw) => title.includes(kw))) {
      return { category: rule.category, group: rule.group, specialty: rule.specialty };
    }
  }

  // 3. Safe fallback — "Medical" is always a valid category in the frontend
  return { category: 'Medical', group: 'Medical', specialty: 'General Medicine' };
}

export function normalizeIcdEntity(entity = {}) {
  const uri = entity.id || entity['@id'] || entity.entityUri || entity.foundationUri || entity.linearizationUri || '';
  const title = stripMarkup(textValue(entity.title) || textValue(entity.matchingPVs?.[0]?.label) || entity.label || entity.stemTitle);
  const code = entity.theCode || entity.code || entity.icdCode || entity.stemId || '';
  const matchedText = stripMarkup(textValue(entity.matchingPVs?.[0]?.label) || entity.matchText || title);

  return {
    id: entityIdFromUri(uri || entity.linearizationUri || entity.foundationUri || code || title),
    title,
    code,
    uri,
    foundationUri: entity.foundationUri || entity.foundationReference || '',
    linearizationUri: entity.linearizationUri || uri,
    browserUrl: uri ? `https://icd.who.int/browse/latest-release/mms/en#/${entityIdFromUri(uri)}` : '',
    score: entity.score || entity.matchScore || entity.matchingScore || '',
    matchedText,
    chapter: entity.chapter || entity.chapterCode || '',
    raw: entity,
  };
}

async function getAccessToken() {
  const { clientId, clientSecret } = getIcdConfig();
  if (!clientId || !clientSecret) {
    throw new Error('ICD-11 credentials are not configured');
  }
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(ICD_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'icdapi_access',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'WHO ICD-11 authentication failed');
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + Math.max(1, Number(data.expires_in || 3600) - 90) * 1000;
  return cachedToken;
}

export async function searchIcd11(query, options = {}) {
  const searchText = String(query || '').trim();
  if (searchText.length < 2) return [];

  const { releaseId, language } = getIcdConfig();
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: searchText,
    flatResults: 'true',
    medicalCodingMode: 'true',
    highlightingEnabled: 'false',
    useFlexisearch: options.flexible ? 'true' : 'false',
  });
  if (options.chapterFilter) params.set('chapterFilter', options.chapterFilter);

  const response = await fetch(`${ICD_API_BASE}/icd/release/11/${releaseId}/mms/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': language,
      'API-Version': 'v2',
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || 'WHO ICD-11 search failed');
  }

  const entities = data.destinationEntities || data.entities || data.results || [];
  return entities
    .map(normalizeIcdEntity)
    .filter((item) => item.title || item.code || item.uri)
    .map((item) => ({
      ...item,
      ...classifyIcdCategory(item),   // attach category/group/specialty to each search result
    }));
}
