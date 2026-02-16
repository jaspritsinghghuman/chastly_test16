/**
 * Encryption Utilities for BeeCastly
 * 
 * All third-party API credentials are encrypted before storage.
 * The ENCRYPTION_KEY must be set in .env (system-level secret only)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Get encryption key from environment (system-level secret)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY is required in environment variables');
}

// Derive a 32-byte key from the provided key using SHA-256
const deriveKey = (key: string): Buffer => {
  return crypto.createHash('sha256').update(key).digest();
};

const KEY = deriveKey(ENCRYPTION_KEY);

/**
 * Encrypt a string value
 * @param text - The plain text to encrypt
 * @returns Object containing encrypted text and IV
 */
export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64')
  };
}

/**
 * Decrypt an encrypted string
 * @param encrypted - The encrypted text
 * @param iv - The initialization vector (base64 encoded)
 * @returns The decrypted plain text
 */
export function decrypt(encrypted: string, iv: string): string {
  const ivBuffer = Buffer.from(iv, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, ivBuffer);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt an object (converts to JSON first)
 * @param obj - The object to encrypt
 * @returns Object containing encrypted text and IV
 */
export function encryptObject<T extends Record<string, any>>(obj: T): { encrypted: string; iv: string } {
  const jsonString = JSON.stringify(obj);
  return encrypt(jsonString);
}

/**
 * Decrypt an object (parses JSON after decryption)
 * @param encrypted - The encrypted text
 * @param iv - The initialization vector
 * @returns The decrypted object
 */
export function decryptObject<T extends Record<string, any>>(encrypted: string, iv: string): T {
  const decrypted = decrypt(encrypted, iv);
  return JSON.parse(decrypted) as T;
}

/**
 * Mask sensitive data for display (show only last 4 characters)
 * @param value - The value to mask
 * @param visibleChars - Number of characters to show at the end (default: 4)
 * @returns Masked string
 */
export function maskValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  
  const masked = '*'.repeat(value.length - visibleChars);
  const visible = value.slice(-visibleChars);
  return masked + visible;
}

/**
 * Mask an API key with a specific format
 * Shows provider prefix and last 4 chars
 * @param key - The API key to mask
 * @returns Masked API key
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '****';
  }
  
  // Extract prefix if it exists (like "sk_live_", "pk_test_", etc.)
  const prefixMatch = key.match(/^[a-z]+_[a-z]+_/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const remaining = key.slice(prefix.length);
  
  if (remaining.length <= 4) {
    return prefix + '****';
  }
  
  return prefix + '*'.repeat(remaining.length - 4) + remaining.slice(-4);
}

/**
 * Mask email address
 * @param email - The email to mask
 * @returns Masked email
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '****@****.com';
  }
  
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.length > 2 
    ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart.slice(-1)
    : '*'.repeat(localPart.length);
  
  const domainParts = domain.split('.');
  const domainName = domainParts[0];
  const maskedDomain = domainName.length > 2
    ? domainName[0] + '*'.repeat(domainName.length - 2) + domainName.slice(-1)
    : '*'.repeat(domainName.length);
  
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join('.')}`;
}

/**
 * Mask phone number
 * @param phone - The phone number to mask
 * @returns Masked phone number
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) {
    return '****';
  }
  
  const cleaned = phone.replace(/\D/g, '');
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Generate a secure random token
 * @param length - Token length in bytes (default: 32)
 * @returns Hex-encoded token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a value using SHA-256 (for non-reversible hashing)
 * @param value - The value to hash
 * @returns SHA-256 hash
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Compare a value with its hash (timing-safe)
 * @param value - The plain value
 * @param hashValue - The hash to compare against
 * @returns True if they match
 */
export function compareHash(value: string, hashValue: string): boolean {
  const computedHash = hash(value);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hashValue)
  );
}

/**
 * Encrypt credentials object for storage
 * @param credentials - The credentials object
 * @returns Encrypted data ready for database storage
 */
export function encryptCredentials(credentials: Record<string, string>): {
  encrypted: string;
  iv: string;
} {
  return encryptObject(credentials);
}

/**
 * Decrypt credentials from storage
 * @param encrypted - The encrypted credentials
 * @param iv - The initialization vector
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encrypted: string, iv: string): Record<string, string> {
  return decryptObject(encrypted, iv);
}

/**
 * Validate that encryption key is properly configured
 * @returns True if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 16;
}

/**
 * Generate a secure encryption key (for initial setup)
 * @returns A new encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}
