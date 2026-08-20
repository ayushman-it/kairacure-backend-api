import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: 'Admin User', trim: true },
    role: { type: String, default: 'Super Admin', trim: true },
    menus: { type: [String], default: [] },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    profile: {
      department: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      designation: { type: String, default: '', trim: true },
      hospitalScope: { type: String, default: '', trim: true },
    },
    passwordHash: { type: String, required: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    twoFactorBackupCodes: [{ type: String }],
    refreshTokenHash: { type: String, default: '' },
    refreshTokenExpiresAt: { type: Date },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model('AdminUser', adminUserSchema);
