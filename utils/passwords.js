import crypto from 'crypto';

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const [, iterations, salt, expectedHash] = parts;
  const hash = crypto.pbkdf2Sync(String(password), salt, Number(iterations), KEY_LENGTH, DIGEST).toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
