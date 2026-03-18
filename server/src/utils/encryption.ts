import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.warn('[encryption] ⚠️  ENCRYPTION_KEY não configurada — OAuth token storage desativado.');
}

// Detect hex encoding (64 hex chars = 32 bytes) vs raw UTF-8 (32 chars)
const KEY = ENCRYPTION_KEY
    ? (ENCRYPTION_KEY.length === 64 && /^[0-9a-f]+$/i.test(ENCRYPTION_KEY)
        ? Buffer.from(ENCRYPTION_KEY, 'hex')
        : Buffer.from(ENCRYPTION_KEY, 'utf8'))
    : null;

if (KEY && KEY.length !== 32) {
    console.warn('[encryption] ⚠️  ENCRYPTION_KEY deve ter exatamente 32 bytes. Current length:', KEY.length);
}

// ── AES-256-GCM (authenticated encryption) ─────────────────────────────────
const GCM_PREFIX = 'gcm:';
const GCM_IV_LEN = 12;

/**
 * Encrypts a string using AES-256-GCM (authenticated encryption).
 */
export function encrypt(text: string): string {
    if (!KEY) throw new Error('[encryption] ENCRYPTION_KEY não configurada');
    const iv = crypto.randomBytes(GCM_IV_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return GCM_PREFIX + iv.toString('hex') + ':' + enc.toString('hex') + ':' + tag.toString('hex');
}

/**
 * Decrypts a string.
 * Supports GCM (new tokens, "gcm:" prefix) and legacy CBC (existing tokens in DB).
 */
export function decrypt(text: string): string {
    if (!KEY) throw new Error('[encryption] ENCRYPTION_KEY não configurada');
    if (text.startsWith(GCM_PREFIX)) {
        // AES-256-GCM path
        const parts = text.slice(GCM_PREFIX.length).split(':');
        if (parts.length !== 3) throw new Error('Invalid GCM ciphertext format');
        const [ivHex, encHex, tagHex] = parts;
        const iv = Buffer.from(ivHex!, 'hex');
        const enc = Buffer.from(encHex!, 'hex');
        const tag = Buffer.from(tagHex!, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    }

    // Legacy AES-256-CBC fallback — tokens encrypted before GCM migration
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}
