import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PRIVATE_DIR = path.join(process.cwd(), 'uploads', 'private');

if (!fs.existsSync(PRIVATE_DIR)) {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
}

function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || 'kairacure-admin-local-encryption-key';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Save encrypted file buffer to private storage directory
 */
export async function savePrivateEncryptedFile(fileBuffer, originalFilename) {
  const fileId = `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const extension = path.extname(originalFilename || '') || '.bin';
  const filePath = path.join(PRIVATE_DIR, `${fileId}.enc`);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  const metadata = {
    fileId,
    originalFilename,
    extension,
    mimeType: getMimeType(originalFilename),
    sizeBytes: fileBuffer.length,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertextPath: `${fileId}.enc`,
    createdAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(filePath, encrypted);
  await fs.promises.writeFile(path.join(PRIVATE_DIR, `${fileId}.meta.json`), JSON.stringify(metadata, null, 2));

  return metadata;
}

/**
 * Decrypt and retrieve private file buffer for authenticated streaming
 */
export async function readPrivateDecryptedFile(fileId) {
  const metaPath = path.join(PRIVATE_DIR, `${fileId}.meta.json`);
  const encPath = path.join(PRIVATE_DIR, `${fileId}.enc`);

  if (!fs.existsSync(metaPath) || !fs.existsSync(encPath)) {
    throw new Error(`Private document ${fileId} not found`);
  }

  const metaRaw = await fs.promises.readFile(metaPath, 'utf8');
  const metadata = JSON.parse(metaRaw);
  const encryptedBuffer = await fs.promises.readFile(encPath);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(metadata.iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(metadata.tag, 'base64'));

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  return {
    buffer: decryptedBuffer,
    metadata
  };
}

export async function deletePrivateEncryptedFile(fileId) {
  const safeFileId = String(fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeFileId || safeFileId !== String(fileId || '')) {
    throw new Error('Invalid private document id');
  }

  const paths = [
    path.join(PRIVATE_DIR, `${safeFileId}.meta.json`),
    path.join(PRIVATE_DIR, `${safeFileId}.enc`),
  ];
  await Promise.all(paths.map(async (filePath) => {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}

function getMimeType(filename = '') {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.dicom': 'application/dicom',
    '.dcm': 'application/dicom',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
