import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY).length !== 32) {
    console.error(
        '[encryption] ENCRYPTION_KEY env var must be set to exactly 32 bytes. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

/**
 * Encrypts a string using AES-256-CBC
 * @param text The plain text to encrypt
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY!), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a string using AES-256-CBC
 * @param text The encrypted text in format iv:encryptedData
 */
export function decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY!), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
