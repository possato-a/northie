import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY).length !== 32) {
    console.error('[encryption] ENCRYPTION_KEY deve ter exatamente 32 bytes. ' +
        'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}
const KEY = Buffer.from(ENCRYPTION_KEY);
// ── AES-256-GCM (authenticated encryption) ─────────────────────────────────
const GCM_PREFIX = 'gcm:';
const GCM_IV_LEN = 12;
/**
 * Encrypts a string using AES-256-GCM (authenticated encryption).
 */
export function encrypt(text) {
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
export function decrypt(text) {
    if (text.startsWith(GCM_PREFIX)) {
        // AES-256-GCM path
        const parts = text.slice(GCM_PREFIX.length).split(':');
        if (parts.length !== 3)
            throw new Error('Invalid GCM ciphertext format');
        const [ivHex, encHex, tagHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    }
    // Legacy AES-256-CBC fallback — tokens encrypted before GCM migration
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}
//# sourceMappingURL=encryption.js.map