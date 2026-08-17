import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import AdminOperation from '../models/AdminOperation.js';
import AdminUser from '../models/AdminUser.js';
import { adminSeedRecords } from '../data/adminSeedData.js';
import { doctorDefaults, hospitalDefaults } from '../utils/bootstrapDefaults.js';
import { decryptJson, encryptJson } from '../utils/encryption.js';
import { classifyIcdCategory, normalizeIcdEntity, searchIcd11 } from '../utils/icd11.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';

const router = Router();

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_MENUS = [
  'Dashboard',
  'Hospitals',
  'Doctors',
  'Treatment Mapping',
  'ICD-11 Mapping',
  'Journey Plans',
  'Upload CSV / Excel',
  'Patient inquiries',
  'Consultation stages',
  'Appointments',
  'Agents',
  'Reports',
  'Audit Logs',
  'Settings',
  'Users & Roles',
];
const defaultSiteSettings = {
  logoMark: 'K',
  logoText: 'Kairacure',
  footerDescription: 'Patient-first international care planning with verified hospitals, doctors, and transparent treatment support.',
  contactEmail: 'care@kairacure.com',
  contactPhone: '+91 98765 43210',
  contactAddress: 'Delhi NCR, India',
  socialFacebook: '',
  socialInstagram: '',
  socialLinkedin: '',
  socialX: '',
  faqs: [
    { id: 'faq-help', icon: 'fa-hand-holding-medical', question: 'How does Kairacure help patients?', answer: 'We help compare hospitals, doctors, treatment costs in Indian Rupees, appointment slots, travel support, and follow-up steps in one place.', visible: true },
    { id: 'faq-compare', icon: 'fa-code-compare', question: 'Can I compare hospitals before booking?', answer: 'Yes. Patients can compare hospital profile, doctor availability, estimated package, ratings, city, and treatment focus before requesting an appointment.', visible: true },
    { id: 'faq-opinion', icon: 'fa-file-medical', question: 'Is the second opinion support free?', answer: 'The care team can guide report sharing and coordinate available second-opinion options before the patient travels.', visible: true },
    { id: 'faq-number', icon: 'fa-phone-volume', question: 'What happens after I submit my number?', answer: 'A care expert follows up for reports, INR cost estimate, hospital options, doctor selection, and appointment planning.', visible: true },
    { id: 'faq-cost', icon: 'fa-indian-rupee-sign', question: 'Are treatment costs shown in Indian Rupees?', answer: 'Yes. Website estimates are shown in INR by default so patients can understand India treatment packages clearly.', visible: true },
    { id: 'faq-travel', icon: 'fa-plane-arrival', question: 'Can Kairacure help with travel and stay?', answer: 'Yes. The team can coordinate visa invitation, airport pickup, nearby stay, translator support, and follow-up planning.', visible: true },
    { id: 'faq-reports', icon: 'fa-notes-medical', question: 'Which reports should I share?', answer: 'Recent prescriptions, diagnosis summary, lab results, scans, discharge notes, and current medication details help doctors review faster.', visible: true },
    { id: 'faq-admin', icon: 'fa-user-gear', question: 'Can appointments be tracked after booking?', answer: 'Yes. Patient inquiries, appointments, hospital details, and care stages can be tracked from the admin dashboard.', visible: true },
  ],
  pages: [
    { id: 'page-home', title: 'Home', slug: '/', visible: true },
    { id: 'page-hospitals', title: 'Hospitals', slug: '/hospitals', visible: true },
    { id: 'page-treatments', title: 'Treatments', slug: '/treatments', visible: true },
    { id: 'page-doctors', title: 'Doctors', slug: '/doctors', visible: true },
    { id: 'page-contact', title: 'Contact', slug: '/contact', visible: true },
  ],
};
const memoryDefaultRecords = [
  {
    recordType: 'siteSetting',
    title: 'Site Settings',
    status: 'Active',
    publicData: defaultSiteSettings,
    confidential: { note: 'Default admin editable site settings.' },
  },
  ...adminSeedRecords.filter((record) => record.recordType !== 'hospital'),
  ...hospitalDefaults().map((hospital) => ({
    recordType: 'hospital',
    title: hospital.name,
    status: hospital.certificationStatus || 'Active',
    publicData: hospital,
    confidential: {
      source: hospital.source?.referenceUrl,
      sourceOfficialFinder: hospital.source?.officialFinderUrl,
      importNote: 'Backend memory NABH integration catalog.',
    },
  })),
  ...doctorDefaults(hospitalDefaults()).map((doctor) => ({
    recordType: 'doctor',
    title: doctor.name,
    status: 'Active',
    publicData: {
      doctorId: doctor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      doctorName: doctor.name,
      title: doctor.title,
      specialty: doctor.specialty,
      hospital: doctor.hospital,
      experience: doctor.experience,
      rating: doctor.rating,
      profileImage: doctor.profileImage || doctor.image,
      treatments: doctor.treatments,
      focusAreas: doctor.focusAreas,
      education: doctor.education,
      about: doctor.about,
    },
    confidential: { importNote: 'Backend generated doctor catalog record.' },
  })),
];

let memoryRecords = memoryDefaultRecords.map((record, index) => ({
  _id: `default-${record.recordType}-${index + 1}`,
  ...record,
  encryptedPrivateData: encryptJson(record.confidential || {}),
  confidential: undefined,
  createdBy: 'system-default',
  createdAt: new Date(Date.now() - index * 3600000).toISOString(),
  updatedAt: new Date(Date.now() - index * 1800000).toISOString(),
}));

export async function getAdminOperationRecordsForAi() {
  if (mongoose.connection.readyState !== 1) {
    return memoryRecords
      .slice()
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 120);
  }

  return AdminOperation.find({})
    .sort({ updatedAt: -1 })
    .limit(120)
    .lean();
}

export async function getPublicAdminRecords(recordType) {
  if (mongoose.connection.readyState !== 1) {
    return memoryRecords
      .filter((record) => record.recordType === recordType && record.status !== 'Deleted')
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  }

  return AdminOperation.find({ recordType, status: { $ne: 'Deleted' } })
    .sort({ updatedAt: -1 })
    .lean();
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || 'admin@medijourney.com';
}

function getAuthSecret() {
  return process.env.ADMIN_AUTH_SECRET || process.env.DATA_ENCRYPTION_KEY || 'medijourney-admin-auth-secret';
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  if (!safeCompare(signature, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.email || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = verifyToken(token);
  if (!session) return res.status(401).json({ message: 'Admin login required' });
  req.admin = session;
  return next();
}

function buildAdminRecord(body, recordType) {
  const { confidential = {}, publicData = {}, title, status, createdBy } = body;
  return {
    recordType,
    title: title || publicData.name || publicData.surgery || publicData.patient || 'Admin record',
    status: status || 'draft',
    publicData,
    encryptedPrivateData: encryptJson(confidential),
    createdBy: createdBy || 'admin',
  };
}

function cleanCell(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeImportRow(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    cleanCell(key).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    cleanCell(value),
  ]));
}

function firstPresent(normalized, keys = []) {
  return keys.map((key) => normalized[key]).find((value) => cleanCell(value)) || '';
}

function splitImportList(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((item) => cleanCell(item))
    .filter(Boolean);
}

function parseLeadingNumber(value) {
  const match = String(value || '').replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function buildAddress(normalized) {
  return [
    firstPresent(normalized, ['address', 'address_1']),
    normalized.address_2,
    normalized.address_3,
  ].map(cleanCell).filter(Boolean).join('\n');
}

function detectMasterImportKind(rows = []) {
  const keys = new Set(rows.flatMap((row) => Object.keys(normalizeImportRow(row))));
  if (keys.has('description') && keys.has('eligibility') && (keys.has('annual_fee') || keys.has('type'))) return 'accreditationType';
  if (keys.has('hospital') || keys.has('hospital_name') || keys.has('name')) return 'hospital';
  return 'generic';
}

function accreditationPayloadFromRow(row, index = 0) {
  const normalized = normalizeImportRow(row);
  const title = normalized.description || normalized.name || normalized.accreditation || `Accreditation type ${index + 1}`;
  return {
    serialNumber: normalized.s_no || normalized.sno || normalized.serial || String(index + 1),
    type: normalized.type || 'Accreditation',
    title,
    description: title,
    eligibility: normalized.eligibility || '',
    logoReference: normalized.logo_reference || normalized.logo || '',
    annualFee: normalized.annual_fee || normalized.fee || '',
    sourceSystem: 'Client master data',
    active: true,
  };
}

function hospitalPayloadFromRow(row, index = 0) {
  const normalized = normalizeImportRow(row);
  const name = normalized.hospital_name || normalized.hospital || normalized.name || `Imported hospital ${index + 1}`;
  const specialty = firstPresent(normalized, [
    'specialty',
    'speciality',
    'specialities',
    'specialties',
    'speciality_super_speciality',
  ]);
  const treatments = firstPresent(normalized, ['treatments', 'treatment', 'doctors_speciality', 'specialities', 'specialties']) || specialty;
  const nabhType = firstPresent(normalized, ['nabh_type', 'nabh', 'accreditation_type', 'type']);
  const jciValue = firstPresent(normalized, ['jci_yes_no_update_later', 'jci', 'jci_yes_no']);
  const accreditations = firstPresent(normalized, ['accreditations', 'accreditation'])
    || [nabhType, jciValue && /^yes/i.test(jciValue) ? 'JCI certified' : jciValue].filter(Boolean).join(', ');
  const bedText = firstPresent(normalized, ['beds', 'no_of_beds', 'total_beds']);
  const hospitalImages = firstPresent(normalized, ['hospital_images_to_be_used_in_hospital_profile', 'gallery_images', 'images', 'image_urls']);
  const galleryImages = splitImportList(hospitalImages);
  const facilitiesText = firstPresent(normalized, ['facilities_bullet_points_as_per_interview', 'facilities', 'facility']);
  const phone = firstPresent(normalized, ['phone', 'phone_no', 'contact']);
  const mobile = firstPresent(normalized, ['mobile_no', 'mobile', 'contact_number']);
  return {
    name,
    serialNumber: normalized.s_no || normalized.sno || normalized.serial || String(index + 1),
    city: normalized.city || normalized.location || '',
    state: normalized.state || '',
    country: normalized.country || 'India',
    address: buildAddress(normalized),
    addressLine1: firstPresent(normalized, ['address', 'address_1']),
    addressLine2: normalized.address_2 || '',
    addressLine3: normalized.address_3 || '',
    foundedYear: normalized.founded_year || '',
    specialty: specialty || treatments.split(',')[0]?.trim() || 'Multi Specialty',
    treatments,
    tags: splitImportList(treatments),
    accreditations: accreditations || '',
    accreditationType: nabhType || '',
    nabhType,
    jciAccredited: /^yes/i.test(jciValue),
    jciStatus: jciValue || '',
    beds: parseLeadingNumber(bedText),
    bedText,
    icuBeds: parseLeadingNumber(normalized.icu_beds || normalized.icu),
    operatingRooms: Number(normalized.operating_rooms || normalized.operation_theatres || normalized.ots) || 0,
    packageFrom: Number(normalized.package_from || normalized.package_from_usd || normalized.starting_package) || 0,
    minCost: Number(normalized.min_cost || normalized.min_cost_inr) || 0,
    maxCost: Number(normalized.max_cost || normalized.max_cost_inr) || 0,
    image: firstPresent(normalized, ['image', 'image_url']) || galleryImages[0] || '',
    galleryImages,
    contactPerson: normalized.contact_person || '',
    email: firstPresent(normalized, ['email', 'email_address']),
    phone,
    mobile,
    website: normalized.website || '',
    linkedIn: normalized.linkedin || '',
    internationalPatientWing: firstPresent(normalized, ['international_patient_wing', 'international_patient_desk']),
    doctorsList: firstPresent(normalized, ['doctors_list_for_each_hospital', 'doctors_list', 'doctors']),
    facilities: splitImportList(facilitiesText),
    facilitiesText,
    futureWebsiteData: firstPresent(normalized, ['future_data_to_use_in_website', 'future_data']),
    certificationStatus: normalized.status || 'Active',
    sourceSystem: 'Client master data',
    sourceRow: index + 1,
  };
}

function recordFromMasterRow(row, importKind, index, createdBy) {
  if (importKind === 'accreditationType') {
    const publicData = accreditationPayloadFromRow(row, index);
    return buildAdminRecord({
      title: publicData.title,
      status: 'Active',
      publicData,
      confidential: { rawRow: row, importedBy: createdBy },
      createdBy,
    }, 'accreditationType');
  }

  const publicData = hospitalPayloadFromRow(row, index);
  return buildAdminRecord({
    title: publicData.name,
    status: publicData.certificationStatus || 'Active',
    publicData,
    confidential: { rawRow: row, importedBy: createdBy },
    createdBy,
  }, 'hospital');
}

async function ensureBootstrapAdmin() {
  if (mongoose.connection.readyState !== 1) return null;

  const email = getAdminEmail().toLowerCase();
  const existing = await AdminUser.findOne({ email });
  if (existing) return existing;

  const initialPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!initialPassword) return null;

  return AdminUser.create({
    email,
    name: 'Admin User',
    role: 'Super Admin',
    passwordHash: hashPassword(initialPassword),
    passwordChangedAt: new Date(),
  });
}

router.post('/login', async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Admin database is offline' });
    }

    await ensureBootstrapAdmin();
    const adminUser = await AdminUser.findOne({ email, active: true });
    if (!adminUser || !verifyPassword(password, adminUser.passwordHash)) {
      return res.status(401).json({ message: 'Invalid admin email or password' });
    }

    adminUser.lastLoginAt = new Date();
    await adminUser.save();

    return res.json({
      token: signToken(email),
      admin: {
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        menus: adminUser.menus,
        profile: adminUser.profile,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/public-appointment', async (req, res, next) => {
  try {
    const patientName = String(req.body.patientName || req.body.name || '').trim();
    const treatment = String(req.body.treatment || '').trim();
    const hospital = String(req.body.hospital || '').trim();

    if (!patientName || !treatment) {
      return res.status(400).json({ message: 'Patient name and treatment are required' });
    }

    const appointmentId = `APT-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
    const record = buildAdminRecord({
      title: patientName,
      status: 'Scheduled',
      publicData: {
        appointmentId,
        patientId: req.body.patientId || req.body.userId || '',
        userId: req.body.userId || req.body.patientId || '',
        userName: req.body.userName || '',
        userEmail: req.body.userEmail || '',
        patientName,
        treatment,
        hospital,
        doctor: req.body.doctor || '',
        mode: req.body.mode || 'Planner request',
        phone: req.body.phone || '',
        country: req.body.country || 'India',
        city: req.body.city || '',
        dateTime: req.body.dateTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        notes: req.body.notes || '',
        source: req.body.source || 'website',
      },
      confidential: {
        phone: req.body.phone || '',
        patientId: req.body.patientId || req.body.userId || '',
        userId: req.body.userId || req.body.patientId || '',
        userName: req.body.userName || '',
        userEmail: req.body.userEmail || '',
        doctor: req.body.doctor || '',
        notes: req.body.notes || '',
        submittedFrom: req.body.source || 'website',
      },
      createdBy: 'public-appointment-form',
    }, 'appointment');

    if (mongoose.connection.readyState !== 1) {
      const saved = {
        _id: `local-appointment-${crypto.randomUUID()}`,
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [saved, ...memoryRecords];
      return res.status(201).json({ message: 'Appointment scheduled', appointment: saved });
    }

    const saved = await AdminOperation.create(record);
    return res.status(201).json({ message: 'Appointment scheduled', appointment: saved });
  } catch (error) {
    next(error);
  }
});

router.use(requireAdmin);

router.get('/icd11/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.ICD11_CLIENT_ID && process.env.ICD11_CLIENT_SECRET),
    releaseId: process.env.ICD11_RELEASE_ID || '2026-01',
    language: process.env.ICD11_LANGUAGE || 'en',
  });
});

router.get('/icd11/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ query: q, results: [] });
    const results = await searchIcd11(q, {
      flexible: String(req.query.flexible || '') === 'true',
      chapterFilter: req.query.chapterFilter,
    });
    return res.json({ query: q, results });
  } catch (error) {
    return next(error);
  }
});

router.post('/icd11/import-treatment', async (req, res, next) => {
  try {
    const entity = normalizeIcdEntity(req.body.entity || req.body);
    if (!entity.title) return res.status(400).json({ message: 'ICD-11 title is required' });

    // Derive a proper clinical category (Cardiac Sciences, Orthopedics, Oncology, etc.)
    // from the ICD code prefix and title keywords — never leaves it as "ICD-11 MMS".
    const { category, group, specialty } = classifyIcdCategory(entity);
    const adminOverrideCategory = String(req.body.category || '').trim();
    const finalCategory = adminOverrideCategory || category;

    const publicData = {
      title: entity.title,
      category: finalCategory,
      group: finalCategory,
      specialty: adminOverrideCategory ? adminOverrideCategory : specialty,
      subtitle: finalCategory,
      procedureCode: entity.code || entity.id,
      icdCode: entity.code,
      icdUri: entity.uri,
      icdEntityId: entity.id,
      icdFoundationUri: entity.foundationUri,
      icdLinearizationUri: entity.linearizationUri,
      icdBrowserUrl: entity.browserUrl,
      icdMatchedText: entity.matchedText,
      sourceSystem: 'WHO ICD-11 MMS',
      sourceRelease: process.env.ICD11_RELEASE_ID || '2026-01',
      description: req.body.description || `${entity.title} — WHO ICD-11 classified procedure under ${finalCategory}.`,
      packageFrom: Number(req.body.packageFrom || 0),
      image: req.body.image || '',
      active: true,
    };
    const recordBody = buildAdminRecord({
      title: entity.title,
      status: req.body.status || 'Active',
      publicData,
      confidential: {
        importedBy: req.admin.email,
        importedAt: new Date().toISOString(),
        rawIcdEntity: entity.raw || req.body.entity || {},
      },
      createdBy: req.admin.email,
    }, 'treatment');

    if (mongoose.connection.readyState !== 1) {
      const record = {
        _id: `local-treatment-${crypto.randomUUID()}`,
        ...recordBody,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [record, ...memoryRecords];
      return res.status(201).json({ message: 'ICD-11 treatment imported locally', record });
    }

    const lookup = publicData.icdUri
      ? { recordType: 'treatment', 'publicData.icdUri': publicData.icdUri }
      : { recordType: 'treatment', title: entity.title, 'publicData.icdCode': publicData.icdCode };
    const record = await AdminOperation.findOneAndUpdate(
      lookup,
      recordBody,
      { new: true, upsert: true, runValidators: true },
    );
    return res.status(201).json({ message: 'ICD-11 treatment imported', record });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-password', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Admin database is offline' });
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const adminUser = await AdminUser.findOne({ email: req.admin.email, active: true });
    if (!adminUser || !verifyPassword(currentPassword, adminUser.passwordHash)) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    adminUser.passwordHash = hashPassword(newPassword);
    adminUser.passwordChangedAt = new Date();
    await adminUser.save();
    return res.json({ message: 'Admin password changed' });
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Admin user database is offline' });
    }

    const users = await AdminUser.find({}).sort({ createdAt: -1 }).lean();
    return res.json(users.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      menus: user.menus || [],
      profile: user.profile || {},
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })));
  } catch (error) {
    return next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Admin user database is offline' });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim() || 'Admin User';
    const role = String(req.body.role || 'Admin').trim();
    const menus = Array.isArray(req.body.menus)
      ? req.body.menus.filter((menu) => ADMIN_MENUS.includes(menu))
      : [];

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and temporary password are required' });
    }

    const user = await AdminUser.create({
      email,
      name,
      role,
      menus,
      profile: req.body.profile || {},
      passwordHash: hashPassword(password),
      passwordChangedAt: new Date(),
      active: req.body.active !== false,
    });

    return res.status(201).json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      menus: user.menus,
      profile: user.profile,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Admin user already exists' });
    return next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const record = memoryRecords.find((item) => item.recordType === 'siteSetting');
      return res.json(record?.publicData || defaultSiteSettings);
    }

    const record = await AdminOperation.findOne({ recordType: 'siteSetting', title: 'Site Settings' }).sort({ updatedAt: -1 });
    return res.json(record?.publicData || defaultSiteSettings);
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const publicData = {
      ...defaultSiteSettings,
      ...(req.body || {}),
      pages: Array.isArray(req.body?.pages) ? req.body.pages : defaultSiteSettings.pages,
      faqs: Array.isArray(req.body?.faqs) ? req.body.faqs : defaultSiteSettings.faqs,
    };

    if (mongoose.connection.readyState !== 1) {
      const existing = memoryRecords.find((item) => item.recordType === 'siteSetting');
      const updated = {
        ...(existing || {
          _id: `local-siteSetting-${crypto.randomUUID()}`,
          recordType: 'siteSetting',
          createdAt: new Date().toISOString(),
          encryptedPrivateData: encryptJson({ note: 'Memory settings record.' }),
          createdBy: req.admin.email,
        }),
        title: 'Site Settings',
        status: 'Active',
        publicData,
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = existing
        ? memoryRecords.map((record) => (record._id === existing._id ? updated : record))
        : [updated, ...memoryRecords];
      return res.json({ message: 'Settings saved', settings: publicData, record: updated });
    }

    const record = await AdminOperation.findOneAndUpdate(
      { recordType: 'siteSetting', title: 'Site Settings' },
      buildAdminRecord({
        title: 'Site Settings',
        status: 'Active',
        publicData,
        confidential: { updatedBy: req.admin.email },
        createdBy: req.admin.email,
      }, 'siteSetting'),
      { new: true, upsert: true, runValidators: true },
    );
    return res.json({ message: 'Settings saved', settings: record.publicData, record });
  } catch (error) {
    next(error);
  }
});

router.get('/records', async (req, res, next) => {
  try {
    if (req.query.recordType === 'patientRecord') {
      return res.status(403).json({
        message: 'Admin users cannot view patient records. Patient records are available only to authorized hospitals.',
      });
    }

    const filter = req.query.recordType ? { recordType: req.query.recordType } : {};
    if (mongoose.connection.readyState !== 1) {
      const records = memoryRecords
        .filter((record) => !filter.recordType || record.recordType === filter.recordType)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
      return res.json(records);
    }

    const records = await AdminOperation.find(filter).sort({ updatedAt: -1 }).limit(200);
    return res.json(records);
  } catch (error) {
    next(error);
  }
});

router.get('/records/:id/private', async (req, res, next) => {
  try {
    if (String(req.params.id).startsWith('PAT-')) {
      return res.status(403).json({
        message: 'Admin users cannot view patient private records. Only authorized hospitals can access assigned patient records.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const record = memoryRecords.find((item) => item._id === req.params.id);
      if (!record) return res.status(404).json({ message: 'Admin record not found' });
      return res.json({
        id: record._id,
        recordType: record.recordType,
        title: record.title,
        confidential: decryptJson(record.encryptedPrivateData),
      });
    }

    const record = await AdminOperation.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Admin record not found' });
    if (record.recordType === 'patientRecord') {
      return res.status(403).json({
        message: 'Admin users cannot view patient private records. Only authorized hospitals can access assigned patient records.',
      });
    }
    return res.json({
      id: record._id,
      recordType: record.recordType,
      title: record.title,
      confidential: decryptJson(record.encryptedPrivateData),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/records/:recordType', async (req, res, next) => {
  try {
    if (req.params.recordType === 'patientRecord') {
      return res.status(403).json({
        message: 'Admin users cannot create patient records. Patient records are created by patients and managed by authorized hospitals.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const record = {
        _id: `local-${req.params.recordType}-${crypto.randomUUID()}`,
        ...buildAdminRecord(req.body, req.params.recordType),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [record, ...memoryRecords];
      return res.status(201).json(record);
    }

    const record = await AdminOperation.create(buildAdminRecord(req.body, req.params.recordType));
    return res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.put('/records/:id', async (req, res, next) => {
  try {
    if (req.body.recordType === 'patientRecord') {
      return res.status(403).json({
        message: 'Admin users cannot update patient records. Hospitals may add reports, but records cannot be edited or deleted from the portal.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const existingIndex = memoryRecords.findIndex((record) => record._id === req.params.id);
      if (existingIndex === -1) return res.status(404).json({ message: 'Admin record not found' });

      const existing = memoryRecords[existingIndex];
      if (existing.recordType === 'patientRecord') {
        return res.status(403).json({
          message: 'Admin users cannot update patient records. Hospitals may add reports, but records cannot be edited or deleted from the portal.',
        });
      }
      const updated = {
        ...existing,
        title: req.body.title ?? existing.title,
        status: req.body.status ?? existing.status,
        publicData: req.body.publicData ?? existing.publicData,
        createdBy: req.body.createdBy ?? existing.createdBy,
        encryptedPrivateData: req.body.confidential ? encryptJson(req.body.confidential) : existing.encryptedPrivateData,
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = memoryRecords.map((record) => (record._id === req.params.id ? updated : record));
      return res.json(updated);
    }

    const existingRecord = await AdminOperation.findById(req.params.id);
    if (!existingRecord) return res.status(404).json({ message: 'Admin record not found' });
    if (existingRecord.recordType === 'patientRecord') {
      return res.status(403).json({
        message: 'Admin users cannot update patient records. Hospitals may add reports, but records cannot be edited or deleted from the portal.',
      });
    }

    const update = {
      title: req.body.title,
      status: req.body.status,
      publicData: req.body.publicData,
      createdBy: req.body.createdBy,
    };

    if (req.body.confidential) {
      update.encryptedPrivateData = encryptJson(req.body.confidential);
    }

    Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
    const record = await AdminOperation.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!record) return res.status(404).json({ message: 'Admin record not found' });
    return res.json(record);
  } catch (error) {
    next(error);
  }
});

router.delete('/records/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (String(id).startsWith('PAT-')) {
      return res.status(403).json({
        message: 'Admin users cannot delete patient records.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const existing = memoryRecords.find((record) => record._id === id);
      if (!existing) return res.status(404).json({ message: 'Admin record not found' });
      if (existing.recordType === 'patientRecord') {
        return res.status(403).json({ message: 'Admin users cannot delete patient records.' });
      }
      memoryRecords = memoryRecords.filter((record) => record._id !== id);
      return res.json({ message: 'Admin record deleted', id });
    }

    // Handle local- prefixed IDs (memory records that were never persisted to DB)
    if (String(id).startsWith('local-') || String(id).startsWith('default-')) {
      memoryRecords = memoryRecords.filter((record) => record._id !== id);
      return res.json({ message: 'Admin record deleted from memory', id });
    }

    const record = await AdminOperation.findById(id);
    if (!record) return res.status(404).json({ message: 'Admin record not found' });
    if (record.recordType === 'patientRecord') {
      return res.status(403).json({ message: 'Admin users cannot delete patient records.' });
    }
    await AdminOperation.findByIdAndDelete(id);
    return res.json({ message: 'Admin record deleted', id: record._id });
  } catch (error) {
    // CastError = invalid ObjectId format — treat as not found
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Admin record not found (invalid id format)' });
    }
    next(error);
  }
});

// Clear imported treatments endpoint
router.post('/treatments/clear-imported', async (req, res, next) => {
  try {
    const { importRecordId } = req.body;
    
    if (mongoose.connection.readyState !== 1) {
      // Clear from memory (for offline mode)
      const beforeCount = memoryRecords.length;
      memoryRecords = memoryRecords.filter(record => 
        !(record.recordType === 'treatment' && record.publicData?.sourceSystem === 'WHO ICD-11 MMS')
      );
      const deleted = beforeCount - memoryRecords.length;
      return res.json({ message: 'ICD-11 treatments cleared from memory', deleted });
    }

    // Clear from MongoDB - delete AdminOperation records with treatment type
    const deleteResult = await AdminOperation.deleteMany({
      recordType: 'treatment',
      'publicData.sourceSystem': 'WHO ICD-11 MMS'
    });

    // Also clear any direct Treatment model entries if they exist
    const directDeleteResult = await mongoose.model('Treatment').deleteMany({
      $or: [
        { sourceSystem: 'WHO ICD-11 MMS' },
        { source: 'ICD-11 import' },
        { icdCode: { $exists: true } },
        { icdUri: { $exists: true } }
      ]
    });

    const totalDeleted = deleteResult.deletedCount + directDeleteResult.deletedCount;

    return res.json({ 
      message: 'ICD-11 treatments cleared successfully', 
      deleted: totalDeleted,
      adminRecords: deleteResult.deletedCount,
      directTreatments: directDeleteResult.deletedCount
    });
  } catch (error) {
    next(error);
  }
});

router.post('/imports', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const record = {
        _id: `local-import-${crypto.randomUUID()}`,
        ...buildAdminRecord({
          title: req.body.fileName || 'CSV / Excel import',
          status: 'queued',
          publicData: {
            fileName: req.body.fileName,
            sourceType: req.body.sourceType || 'spreadsheet',
            rows: req.body.rows || 0,
            uploadedOn: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            modules: req.body.modules || ['hospitals', 'surgeries', 'doctors'],
          },
          confidential: {
            originalFileHash: req.body.originalFileHash,
            uploadedByEmail: req.body.uploadedByEmail,
            privateNotes: req.body.privateNotes,
          },
          createdBy: req.body.createdBy,
        }, 'import'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [record, ...memoryRecords];
      return res.status(201).json({ message: 'Import queued', record });
    }

    const record = await AdminOperation.create(buildAdminRecord({
      title: req.body.fileName || 'CSV / Excel import',
      status: 'queued',
      publicData: {
        fileName: req.body.fileName,
        sourceType: req.body.sourceType || 'spreadsheet',
        rows: req.body.rows || 0,
        modules: req.body.modules || ['hospitals', 'surgeries', 'doctors'],
      },
      confidential: {
        originalFileHash: req.body.originalFileHash,
        uploadedByEmail: req.body.uploadedByEmail,
        privateNotes: req.body.privateNotes,
      },
      createdBy: req.body.createdBy,
    }, 'import'));
    res.status(201).json({ message: 'Import queued', record });
  } catch (error) {
    next(error);
  }
});

router.post('/imports/master-data', async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    const cleanedRows = rows
      .map((row) => Object.fromEntries(Object.entries(row || {}).filter(([, value]) => cleanCell(value))))
      .filter((row) => Object.keys(row).length);
    if (!cleanedRows.length) return res.status(400).json({ message: 'No import rows found' });

    const importKind = req.body.importKind || detectMasterImportKind(cleanedRows);
    if (!['hospital', 'accreditationType'].includes(importKind)) {
      return res.status(400).json({ message: 'Unsupported master data format. Expected hospital or accreditation columns.' });
    }

    const createdBy = req.admin?.email || req.body.createdBy || 'admin';
    const recordsToSave = cleanedRows
      .map((row, index) => recordFromMasterRow(row, importKind, index, createdBy))
      .filter((record) => {
        const title = cleanCell(record.title).toLowerCase();
        return title && !['description', 'hospital name', 'name'].includes(title);
      });
    if (!recordsToSave.length) return res.status(400).json({ message: 'No valid master data rows found after cleanup' });
    const uploadedOn = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const importRecordBody = buildAdminRecord({
      title: req.body.fileName || `${importKind} master data import`,
      status: 'processed',
      publicData: {
        fileName: req.body.fileName || '',
        sourceType: req.body.sourceType || 'csv',
        importKind,
        rows: cleanedRows.length,
        createdRecords: recordsToSave.length,
        uploadedOn,
        modules: importKind === 'hospital' ? ['hospitals'] : ['accreditationTypes'],
      },
      confidential: {
        uploadedByEmail: createdBy,
        privateNotes: req.body.privateNotes || 'Master data uploaded from admin dashboard',
      },
      createdBy,
    }, 'import');

    if (mongoose.connection.readyState !== 1) {
      const savedRecords = recordsToSave.map((record) => ({
        _id: `local-${record.recordType}-${crypto.randomUUID()}`,
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      const importRecord = {
        _id: `local-import-${crypto.randomUUID()}`,
        ...importRecordBody,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [importRecord, ...savedRecords, ...memoryRecords];
      return res.status(201).json({
        message: `Imported ${savedRecords.length} ${importKind === 'hospital' ? 'hospital' : 'accreditation'} records locally`,
        importKind,
        importedCount: savedRecords.length,
        records: savedRecords,
        importRecord,
      });
    }

    const savedRecords = [];
    for (const record of recordsToSave) {
      const lookup = record.recordType === 'hospital'
        ? { recordType: 'hospital', title: record.title }
        : { recordType: 'accreditationType', title: record.title };
      const saved = await AdminOperation.findOneAndUpdate(lookup, record, {
        new: true,
        upsert: true,
        runValidators: true,
      });
      savedRecords.push(saved);
    }
    const importRecord = await AdminOperation.create(importRecordBody);
    return res.status(201).json({
      message: `Imported ${savedRecords.length} ${importKind === 'hospital' ? 'hospital' : 'accreditation'} records`,
      importKind,
      importedCount: savedRecords.length,
      records: savedRecords,
      importRecord,
    });
  } catch (error) {
    next(error);
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// Journey Plans — save, list, update status
// These are called by the frontend planner when users complete a journey plan
// and confirm their booking. No admin auth required for POST (public action).
// ─────────────────────────────────────────────────────────────────────────────

// Remove requireAdmin for this route so unauthenticated frontend users can save plans
router.post('/journey-plans', async (req, res, next) => {
  try {
    const {
      userId, userName, selectedHospital, selectedTreatments,
      journeyPlan, icdCodes, status, createdAt,
    } = req.body;

    if (!userName && !userId) {
      return res.status(400).json({ message: 'Patient name or email is required' });
    }

    const planId = `JP-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
    const costs = journeyPlan?.costs || {};

    const publicData = {
      planId,
      userId: userId || '',
      userName: userName || 'Guest',
      selectedHospital: selectedHospital || '',
      selectedTreatments: Array.isArray(selectedTreatments) ? selectedTreatments : [],
      icdCodes: Array.isArray(icdCodes) ? icdCodes : [],
      userLocation: journeyPlan?.userLocation || '',
      hospitalLocation: journeyPlan?.hospitalLocation || '',
      distance: journeyPlan?.distance || 0,
      travelMode: journeyPlan?.travelMode || 'flight',
      hotelCategory: journeyPlan?.hotelCategory || '3star',
      stayDuration: journeyPlan?.stayDuration || 7,
      companionCount: journeyPlan?.companionCount || 0,
      costs: {
        treatment: Number(costs.treatment || 0),
        travel: Number(costs.travel || 0),
        hotel: Number(costs.hotel || 0),
        companion: Number(costs.companion || 0),
        visa: Number(costs.visa || 0),
        localTransport: Number(costs.localTransport || 0),
        meals: Number(costs.meals || 0),
        total: Number(costs.total || journeyPlan?.totalCost || 0),
      },
      route: journeyPlan?.route || {},
      status: status || 'calculated',
      submittedAt: createdAt || new Date().toISOString(),
    };

    const record = buildAdminRecord({
      title: `${publicData.userName} — ${publicData.selectedHospital}`,
      status: 'calculated',
      publicData,
      confidential: { userId, userAgent: req.headers['user-agent'] || '' },
      createdBy: 'planner-frontend',
    }, 'journeyPlan');

    if (mongoose.connection.readyState !== 1) {
      const saved = {
        _id: `local-journeyPlan-${crypto.randomUUID()}`,
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryRecords = [saved, ...memoryRecords];
      return res.status(201).json({ message: 'Journey plan saved', planId, record: saved });
    }

    const saved = await AdminOperation.create(record);
    return res.status(201).json({ message: 'Journey plan saved', planId, record: saved });
  } catch (error) {
    next(error);
  }
});

router.patch('/journey-plans/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, confirmedAt } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const record = memoryRecords.find(
        (r) => r.recordType === 'journeyPlan' && r.publicData?.userId === userId,
      );
      if (!record) return res.status(404).json({ message: 'Journey plan not found' });
      record.status = status || 'confirmed';
      record.publicData = { ...record.publicData, status: status || 'confirmed', confirmedAt };
      record.updatedAt = new Date().toISOString();
      return res.json({ message: 'Journey plan updated', record });
    }

    const record = await AdminOperation.findOneAndUpdate(
      { recordType: 'journeyPlan', 'publicData.userId': userId },
      { status: status || 'confirmed', 'publicData.status': status || 'confirmed', 'publicData.confirmedAt': confirmedAt },
      { new: true, sort: { createdAt: -1 } },
    );
    if (!record) return res.status(404).json({ message: 'Journey plan not found' });
    return res.json({ message: 'Journey plan updated', record });
  } catch (error) {
    next(error);
  }
});

export default router;
