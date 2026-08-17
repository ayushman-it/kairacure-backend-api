import mongoose from 'mongoose';
import { patientDb } from '../config/db.js';

const encryptedPayloadSchema = new mongoose.Schema(
  {
    algorithm: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);

const patientRecordSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    role: { type: String, default: 'Patient', trim: true },
    passwordHash: { type: String },
    treatmentInterest: { type: String, trim: true },
    supportNeed: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
    status: { type: String, default: 'Active', trim: true, index: true },
    dashboard: {
      stage: { type: String, default: 'Profile created' },
      preferredHospital: { type: String, default: '' },
      preferredDoctor: { type: String, default: '' },
      nextStep: { type: String, default: 'Upload reports or request a coordinator call' },
      estimates: [{ type: mongoose.Schema.Types.Mixed }],
      tasks: [{ type: mongoose.Schema.Types.Mixed }],
      messages: [{ type: mongoose.Schema.Types.Mixed }],
      activities: [{ type: mongoose.Schema.Types.Mixed }],
    },
    encryptedMedicalData: { type: encryptedPayloadSchema, required: true },
    createdBy: { type: String, default: 'patient-signup', trim: true },
  },
  { timestamps: true },
);

export default patientDb.model('PatientRecord', patientRecordSchema);
