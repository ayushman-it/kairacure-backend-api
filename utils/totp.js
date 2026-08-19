import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encryptJson, decryptJson } from './encryption.js';

authenticator.options = {
  window: 2, // Allow 60 seconds drift (2 steps before/after for phone clock sync)
  step: 30,
};

/**
 * Generate a new random base32 TOTP secret for Admin 2FA enrollment
 */
export function generateTotpSecret() {
  return authenticator.generateSecret();
}

/**
 * Build OTPAuth URL and render base64 PNG QR Code Data URL
 */
export async function generateQrCodeDataUrl(adminEmail, secret) {
  const label = encodeURIComponent(adminEmail || 'admin@kairacure.com');
  const otpauthUrl = authenticator.keyuri(label, 'Kairacure Admin', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 240,
    color: {
      dark: '#0d2f5d',
      light: '#ffffff',
    },
  });
  return {
    otpauthUrl,
    qrCodeDataUrl,
    secret,
  };
}

/**
 * Verify a 6-digit TOTP token against an admin's secret
 */
export function verifyTotpCode(code, secret) {
  if (!code || !secret) return false;
  const cleanCode = String(code).replace(/\s+/g, '').trim();
  return authenticator.check(cleanCode, secret);
}

/**
 * Encrypt TOTP secret before saving to MongoDB
 */
export function encryptTotpSecret(secret) {
  return encryptJson({ secret });
}

/**
 * Decrypt TOTP secret from MongoDB
 */
export function decryptTotpSecret(encryptedEnvelope) {
  if (!encryptedEnvelope) return '';
  if (typeof encryptedEnvelope === 'string') return encryptedEnvelope;
  const decrypted = decryptJson(encryptedEnvelope);
  return decrypted.secret || '';
}

/**
 * Generate 8 random single-use emergency backup recovery codes
 */
export function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    codes.push(code);
  }
  return codes;
}
