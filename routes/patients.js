import { Router } from 'express';
import crypto from 'crypto';
import EmailOtp from '../models/EmailOtp.js';
import PatientRecord from '../models/PatientRecord.js';
import { decryptJson, encryptJson } from '../utils/encryption.js';
import { sendMail } from '../utils/email.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { isPatientDbConnected } from '../config/db.js';

const router = Router();
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVITY_ITEMS = 80;
const editablePatientFields = new Set(['name', 'phone', 'role', 'treatmentInterest', 'supportNeed', 'country']);

const defaultPatientRecords = [
  {
    patientId: 'PAT-DEMO-1001',
    name: 'Demo Patient',
    email: 'patient@medijourney.com',
    phone: '+91 90000 00000',
    role: 'Patient',
    passwordHash: hashPassword('Patient@123'),
    treatmentInterest: 'Orthopedics',
    supportNeed: 'Hospital shortlisting',
    country: 'India',
    status: 'Active',
    dashboard: {
      stage: 'Hospital options shared',
      preferredHospital: 'Fortis Hospital, Noida',
      preferredDoctor: 'Dr. Kavya Mehra',
      nextStep: 'Review shortlisted hospitals and confirm report upload',
      estimates: [{ label: 'Tentative treatment package', amount: 2600, currency: 'USD' }],
      tasks: [
        { label: 'Upload latest reports', status: 'Pending' },
        { label: 'Confirm travel city', status: 'Pending' },
        { label: 'Coordinator call', status: 'Scheduled' },
      ],
      messages: [{ from: 'Care team', text: 'Your care plan is ready for review.' }],
    },
    encryptedMedicalData: encryptJson({ symptoms: 'Demo knee pain notes', passportNumber: 'Encrypted demo value' }),
    createdBy: 'system-default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let memoryPatientRecords = [...defaultPatientRecords];
let memoryOtps = [];

function getAuthSecret() {
  return process.env.PATIENT_AUTH_SECRET || process.env.ADMIN_AUTH_SECRET || process.env.DATA_ENCRYPTION_KEY || 'medijourney-patient-auth-secret';
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signToken(patient) {
  const payload = Buffer.from(JSON.stringify({
    patientId: patient.patientId,
    email: patient.email,
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
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
    if (!decoded.patientId || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function findPatientByEmail(email) {
  if (!isPatientDbConnected()) {
    return memoryPatientRecords.find((record) => record.email === email) || null;
  }
  return PatientRecord.findOne({ email }).lean();
}

async function savePatient(record) {
  if (!isPatientDbConnected()) {
    const saved = { ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memoryPatientRecords = [saved, ...memoryPatientRecords];
    return saved;
  }

  return PatientRecord.create(record);
}

async function updatePatientPassword(email, password) {
  const passwordHash = hashPassword(password);
  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.email === email ? { ...record, passwordHash, updatedAt: new Date().toISOString() } : record
    ));
    return memoryPatientRecords.find((record) => record.email === email);
  }

  return PatientRecord.findOneAndUpdate(
    { email },
    { passwordHash },
    { new: true },
  ).lean();
}

async function updatePatientDashboardForAdmin(patientId, updates = {}) {
  const current = await findPatientById(patientId);
  if (!current) return null;

  const dashboard = {
    ...(current.dashboard || {}),
    ...(updates.dashboard || {}),
  };
  const nextRecord = {
    status: updates.status || current.status || 'Active',
    dashboard,
  };

  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.patientId === patientId
        ? { ...record, ...nextRecord, updatedAt: new Date().toISOString() }
        : record
    ));
    return memoryPatientRecords.find((record) => record.patientId === patientId);
  }

  return PatientRecord.findOneAndUpdate(
    { patientId },
    nextRecord,
    { new: true },
  ).lean();
}

async function addPatientAttachmentForAdmin(patientId, attachment) {
  const current = await findPatientById(patientId);
  if (!current) return null;
  const attachments = [...(Array.isArray(current.attachments) ? current.attachments : []), attachment].slice(-50);
  const nextRecord = { attachments };

  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.patientId === patientId
        ? { ...record, ...nextRecord, updatedAt: new Date().toISOString() }
        : record
    ));
    return memoryPatientRecords.find((record) => record.patientId === patientId);
  }

  return PatientRecord.findOneAndUpdate({ patientId }, nextRecord, { new: true }).lean();
}

async function removePatientAttachmentForAdmin(patientId, fileId) {
  const current = await findPatientById(patientId);
  if (!current) return null;
  const attachments = (Array.isArray(current.attachments) ? current.attachments : [])
    .filter((attachment) => attachment.fileId !== fileId);
  if (attachments.length === (current.attachments || []).length) return current;
  const nextRecord = { attachments };

  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.patientId === patientId
        ? { ...record, ...nextRecord, updatedAt: new Date().toISOString() }
        : record
    ));
    return memoryPatientRecords.find((record) => record.patientId === patientId);
  }

  return PatientRecord.findOneAndUpdate({ patientId }, nextRecord, { new: true }).lean();
}

function sanitizeActivity(body = {}, session = {}) {
  return {
    event: String(body.event || 'activity').slice(0, 80),
    patientId: session.patientId,
    userId: session.patientId,
    page: String(body.page || '').slice(0, 80),
    path: String(body.path || '').slice(0, 180),
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
    at: new Date().toISOString(),
  };
}

async function appendPatientActivity(patientId, activity) {
  const current = await findPatientById(patientId);
  if (!current) return null;
  const dashboard = current.dashboard || {};
  const activities = [activity, ...(Array.isArray(dashboard.activities) ? dashboard.activities : [])].slice(0, MAX_ACTIVITY_ITEMS);
  const nextRecord = {
    dashboard: {
      ...dashboard,
      activities,
    },
  };

  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.patientId === patientId
        ? { ...record, ...nextRecord, updatedAt: new Date().toISOString() }
        : record
    ));
    return memoryPatientRecords.find((record) => record.patientId === patientId);
  }

  return PatientRecord.findOneAndUpdate(
    { patientId },
    nextRecord,
    { new: true },
  ).lean();
}

async function updatePatientProfile(patientId, fields = {}, activity) {
  const updates = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!editablePatientFields.has(key)) continue;
    updates[key] = String(value || '').trim();
  }
  const current = await findPatientById(patientId);
  if (!current) return null;

  const dashboard = current.dashboard || {};
  const activities = activity
    ? [activity, ...(Array.isArray(dashboard.activities) ? dashboard.activities : [])].slice(0, MAX_ACTIVITY_ITEMS)
    : dashboard.activities;
  const nextRecord = {
    ...updates,
    dashboard: {
      ...dashboard,
      ...(activities ? { activities } : {}),
    },
  };

  if (!isPatientDbConnected()) {
    memoryPatientRecords = memoryPatientRecords.map((record) => (
      record.patientId === patientId
        ? { ...record, ...nextRecord, updatedAt: new Date().toISOString() }
        : record
    ));
    return memoryPatientRecords.find((record) => record.patientId === patientId);
  }

  return PatientRecord.findOneAndUpdate(
    { patientId },
    nextRecord,
    { new: true },
  ).lean();
}

async function findPatientById(patientId) {
  if (!isPatientDbConnected()) {
    return memoryPatientRecords.find((record) => record.patientId === patientId) || null;
  }
  return PatientRecord.findOne({ patientId }).lean();
}

function toDashboardPatient(record) {
  return {
    patientId: record.patientId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    role: record.role,
    treatmentInterest: record.treatmentInterest,
    supportNeed: record.supportNeed,
    country: record.country,
    status: record.status,
    dashboard: record.dashboard || {},
    attachments: Array.isArray(record.attachments) ? record.attachments.map((attachment) => ({
      fileId: attachment.fileId,
      originalFilename: attachment.originalFilename,
      extension: attachment.extension,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      category: attachment.category,
      notes: attachment.notes,
      uploadedBy: attachment.uploadedBy,
      uploadedAt: attachment.uploadedAt,
    })) : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function requirePatient(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = verifyToken(token);
  if (!session) return res.status(401).json({ message: 'Patient login required' });
  req.patientSession = session;
  return next();
}

function normalizePurpose(purpose) {
  if (purpose === 'register') return 'patient-register';
  if (purpose === 'forgot-password') return 'patient-forgot-password';
  return 'patient-login';
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

async function storeOtp({ email, purpose, otp, metadata }) {
  const record = {
    email,
    purpose,
    otpHash: hashPassword(otp),
    attempts: 0,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    metadata,
  };

  if (!isPatientDbConnected()) {
    memoryOtps = memoryOtps.filter((item) => item.email !== email || item.purpose !== purpose);
    memoryOtps.push({ ...record, createdAt: new Date().toISOString() });
    return;
  }

  await EmailOtp.deleteMany({ email, purpose, consumedAt: { $exists: false } });
  await EmailOtp.create(record);
}

async function consumeOtp({ email, purpose, otp }) {
  const now = new Date();
  if (!isPatientDbConnected()) {
    const index = memoryOtps.findIndex((item) => item.email === email && item.purpose === purpose && !item.consumedAt);
    if (index === -1) return null;
    const record = memoryOtps[index];
    if (new Date(record.expiresAt) < now) return null;
    record.attempts += 1;
    if (record.attempts > 5 || !verifyPassword(otp, record.otpHash)) return null;
    record.consumedAt = now.toISOString();
    return record;
  }

  const record = await EmailOtp.findOne({ email, purpose, consumedAt: { $exists: false }, expiresAt: { $gt: now } });
  if (!record) return null;
  record.attempts += 1;
  if (record.attempts > 5 || !verifyPassword(otp, record.otpHash)) {
    await record.save();
    return null;
  }
  record.consumedAt = now;
  await record.save();
  return record.toObject();
}

function buildPatientRecord(body, email) {
  const name = String(body.name || body.fullName || 'Medijourney Patient').trim();
  const patientId = `PAT-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
  return {
    patientId,
    name,
    email,
    phone: body.phone || '',
    role: body.role || 'Patient',
    passwordHash: body.password ? hashPassword(body.password) : undefined,
    treatmentInterest: body.treatmentInterest || '',
    supportNeed: body.supportNeed || '',
    country: body.country || 'India',
    status: 'Active',
    dashboard: {
      stage: 'Profile created',
      preferredHospital: '',
      preferredDoctor: '',
      nextStep: 'A coordinator will review your care request',
      estimates: [],
      tasks: [
        { label: 'Complete treatment details', status: 'Pending' },
        { label: 'Upload reports', status: 'Pending' },
        { label: 'Schedule coordinator call', status: 'Pending' },
      ],
      messages: [{ from: 'Care team', text: 'Welcome to your Medijourney dashboard.' }],
      activities: [{ event: 'signup', patientId, userId: patientId, page: 'login', path: '/login', metadata: { source: 'otp-register' }, at: new Date().toISOString() }],
    },
    encryptedMedicalData: encryptJson({
      symptoms: body.symptoms || '',
      notes: body.notes || '',
      source: 'patient-otp-register',
    }),
    createdBy: 'patient-otp-signup',
  };
}

router.post('/request-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const purpose = normalizePurpose(req.body.purpose);
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const existing = await findPatientByEmail(email);
    if (purpose === 'patient-login' && !existing) {
      return res.status(404).json({ message: 'No patient account found for this email' });
    }
    if (purpose === 'patient-forgot-password' && !existing) {
      return res.status(404).json({ message: 'No patient account found for this email' });
    }
    if (purpose === 'patient-register' && existing) {
      return res.status(409).json({ message: 'A patient account already exists for this email' });
    }

    const otp = generateOtp();
    await storeOtp({ email, purpose, otp, metadata: req.body });
    await sendMail({
      to: email,
      subject: 'Your Medijourney verification code',
      text: `Your Medijourney verification code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    });

    return res.json({ message: 'OTP sent to email' });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const purpose = normalizePurpose(req.body.purpose);
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const otpRecord = await consumeOtp({ email, purpose, otp });
    if (!otpRecord) return res.status(401).json({ message: 'Invalid or expired OTP' });

    if (purpose === 'patient-forgot-password') {
      const newPassword = String(req.body.newPassword || '');
      if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
      const updated = await updatePatientPassword(email, newPassword);
      if (!updated) return res.status(404).json({ message: 'Patient account not found' });
      return res.json({ message: 'Password reset successfully' });
    }

    let patient = await findPatientByEmail(email);
    if (purpose === 'patient-register') {
      if (patient) return res.status(409).json({ message: 'A patient account already exists for this email' });
      patient = await savePatient(buildPatientRecord({ ...(otpRecord.metadata || {}), ...req.body }, email));
    }

    if (!patient) return res.status(404).json({ message: 'Patient account not found' });
    return res.json({ token: signToken(patient), patient: toDashboardPatient(patient) });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await findPatientByEmail(email);
    if (existing) return res.status(409).json({ message: 'A patient account already exists for this email' });

    const patientId = `PAT-${new Date().getFullYear()}-${crypto.randomInt(10000, 99999)}`;
    const record = {
      patientId,
      name,
      email,
      phone: req.body.phone || '',
      role: req.body.role || 'Patient',
      passwordHash: password ? hashPassword(password) : undefined,
      treatmentInterest: req.body.treatmentInterest || '',
      supportNeed: req.body.supportNeed || '',
      country: req.body.country || 'India',
      status: 'Active',
      dashboard: {
        stage: 'Profile created',
        preferredHospital: '',
        preferredDoctor: '',
        nextStep: 'A coordinator will review your care request',
        estimates: [],
        tasks: [
          { label: 'Complete treatment details', status: 'Pending' },
          { label: 'Upload reports', status: 'Pending' },
          { label: 'Schedule coordinator call', status: 'Pending' },
        ],
        messages: [{ from: 'Care team', text: 'Welcome to your Medijourney dashboard.' }],
        activities: [{ event: 'signup', patientId, userId: patientId, page: 'login', path: '/login', metadata: { source: 'password-register' }, at: new Date().toISOString() }],
      },
      encryptedMedicalData: encryptJson({
        symptoms: req.body.symptoms || '',
        notes: req.body.notes || '',
        source: 'patient-register',
      }),
      createdBy: 'patient-signup',
    };

    const saved = await savePatient(record);

    return res.status(201).json({ token: signToken(saved), patient: toDashboardPatient(saved) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const patient = await findPatientByEmail(email);

    if (!patient || !patient.passwordHash || !verifyPassword(password, patient.passwordHash)) {
      return res.status(401).json({ message: 'Invalid patient email or password' });
    }

    return res.json({ token: signToken(patient), patient: toDashboardPatient(patient) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requirePatient, async (req, res, next) => {
  try {
    const patient = await findPatientById(req.patientSession.patientId);
    if (!patient) return res.status(404).json({ message: 'Patient record not found' });
    return res.json({ patient: toDashboardPatient(patient) });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requirePatient, async (req, res, next) => {
  try {
    const activity = sanitizeActivity({
      event: 'profile_update',
      page: req.body.page || 'patient-dashboard',
      path: req.body.path || '/login',
      metadata: { fields: Object.keys(req.body.fields || {}) },
    }, req.patientSession);
    const updated = await updatePatientProfile(req.patientSession.patientId, req.body.fields || {}, activity);
    if (!updated) return res.status(404).json({ message: 'Patient record not found' });
    return res.json({ patient: toDashboardPatient(updated) });
  } catch (error) {
    next(error);
  }
});

router.post('/activity', requirePatient, async (req, res, next) => {
  try {
    const activity = sanitizeActivity(req.body, req.patientSession);
    const updated = await appendPatientActivity(req.patientSession.patientId, activity);
    if (!updated) return res.status(404).json({ message: 'Patient record not found' });
    return res.status(201).json({ activity });
  } catch (error) {
    next(error);
  }
});

export async function getPatientRecordsForAdmin() {
  if (!isPatientDbConnected()) {
    return memoryPatientRecords.map(toDashboardPatient);
  }
  const records = await PatientRecord.find({}).sort({ updatedAt: -1 }).limit(200).lean();
  return records.map(toDashboardPatient);
}

export async function getPatientPrivateRecordForAdmin(patientId) {
  const record = await findPatientById(patientId);
  if (!record) return null;
  return {
    ...toDashboardPatient(record),
    confidential: decryptJson(record.encryptedMedicalData),
  };
}

export async function updatePatientRecordForAdmin(patientId, updates) {
  const updated = await updatePatientDashboardForAdmin(patientId, updates);
  return updated ? toDashboardPatient(updated) : null;
}

export async function addPatientAttachmentRecordForAdmin(patientId, attachment) {
  const updated = await addPatientAttachmentForAdmin(patientId, attachment);
  return updated ? toDashboardPatient(updated) : null;
}

export async function removePatientAttachmentRecordForAdmin(patientId, fileId) {
  const updated = await removePatientAttachmentForAdmin(patientId, fileId);
  return updated ? toDashboardPatient(updated) : null;
}

export default router;
