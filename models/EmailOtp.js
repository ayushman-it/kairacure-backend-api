import mongoose from 'mongoose';
import { patientDb } from '../config/db.js';

const emailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: ['patient-login', 'patient-register', 'patient-forgot-password'], required: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default patientDb.model('EmailOtp', emailOtpSchema);
