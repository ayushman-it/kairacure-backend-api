import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    adminEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    adminName: { type: String, default: 'Admin User', trim: true },
    role: { type: String, default: 'Admin', trim: true },
    action: {
      type: String,
      enum: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD', 'LOGIN', 'LOGOUT', '2FA_SETUP', '2FA_VERIFY', 'BACKUP_GENERATE', 'EXPORT'],
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ['patientRecord', 'hospital', 'doctor', 'treatment', 'inquiry', 'appointment', 'document', 'journeyPlan', 'systemSetting', 'adminUser'],
      required: true,
      index: true,
    },
    resourceId: { type: String, default: '', trim: true },
    ipAddress: { type: String, default: '127.0.0.1', trim: true },
    userAgent: { type: String, default: '', trim: true },
    status: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('AuditLog', auditLogSchema);
