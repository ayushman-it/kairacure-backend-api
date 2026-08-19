import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import AdminOperation from '../models/AdminOperation.js';
import AdminUser from '../models/AdminUser.js';
import PatientRecord from '../models/PatientRecord.js';
import AuditLog from '../models/AuditLog.js';
import { adminSeedRecords } from '../data/adminSeedData.js';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || 'kairacure-admin-backup-encryption-key';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptBackupBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]);
}

export async function runAutomatedEncryptedBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`[Backup] Starting automated AES-256 encrypted backup (${timestamp})...`);

  try {
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB();
      } catch (connErr) {
        console.warn('[Backup Warning] MongoDB Atlas offline, generating local backup snapshot.', connErr.message);
      }
    }

    let adminOperations = [];
    let adminUsers = [];
    let patientRecords = [];
    let auditLogs = [];

    if (mongoose.connection.readyState === 1) {
      [adminOperations, adminUsers, patientRecords, auditLogs] = await Promise.all([
        AdminOperation.find({}).lean(),
        AdminUser.find({}).select('-passwordHash -twoFactorSecret').lean(),
        PatientRecord.find({}).lean(),
        AuditLog.find({}).lean(),
      ]);
    } else {
      adminOperations = adminSeedRecords || [];
      auditLogs = await AuditLog.find({}).lean().catch(() => []);
    }

    const backupPayload = {
      backupMetadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        counts: {
          adminOperations: adminOperations.length,
          adminUsers: adminUsers.length,
          patientRecords: patientRecords.length,
          auditLogs: auditLogs.length,
        },
      },
      data: {
        adminOperations,
        adminUsers,
        patientRecords,
        auditLogs,
      },
    };

    const jsonString = JSON.stringify(backupPayload);
    const jsonBuffer = Buffer.from(jsonString, 'utf8');
    const encryptedBackupBuffer = encryptBackupBuffer(jsonBuffer);

    const backupFilename = `kairacure-backup-${timestamp}.enc.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFilename);

    await fs.promises.writeFile(backupFilePath, encryptedBackupBuffer);

    console.log(`[Backup SUCCESS] Encrypted backup file created: ${backupFilePath} (${encryptedBackupBuffer.length} bytes)`);
    return {
      status: 'SUCCESS',
      filename: backupFilename,
      filePath: backupFilePath,
      sizeBytes: encryptedBackupBuffer.length,
      counts: backupPayload.backupMetadata.counts,
    };
  } catch (error) {
    console.error('[Backup ERROR] Backup failed:', error.message);
    throw error;
  }
}

// Allow direct execution from CLI: node scripts/backup.js
if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  runAutomatedEncryptedBackup()
    .then((res) => {
      console.log('Automated backup completed successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup script execution error:', err);
      process.exit(1);
    });
}
