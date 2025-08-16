import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Use environment variable or generate a secure key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

/**
 * Encrypts an API key for secure storage in the database using AES-256-GCM
 * @param apiKey The plain text API key to encrypt
 * @returns The encrypted API key as a hex string with format: iv:authTag:encrypted
 */
export async function encryptApiKey(apiKey: string): Promise<string> {
  try {
    // Generate a random initialization vector
    const iv = randomBytes(16);
    
    // Create cipher using GCM mode for authenticated encryption
    const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    // Encrypt the API key
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return iv:authTag:encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error: any) {
    throw new Error(`Failed to encrypt API key: ${error.message}`);
  }
}

/**
 * Decrypts an API key from the database
 * @param encryptedApiKey The encrypted API key from the database (format: iv:authTag:encrypted)
 * @returns The decrypted plain text API key
 */
export async function decryptApiKey(encryptedApiKey: string): Promise<string> {
  try {
    // Split IV, auth tag, and encrypted data
    const [ivHex, authTagHex, encrypted] = encryptedApiKey.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted API key format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher using GCM mode
    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the API key
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
}

/**
 * Utility function to securely hash data (useful for additional security measures)
 * @param data The data to hash
 * @param salt Optional salt for the hash
 * @returns The hashed data as a hex string
 */
export async function hashData(data: string, salt?: string): Promise<string> {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(16);
  const hash = await scryptAsync(data, saltBuffer, 64) as Buffer;
  return saltBuffer.toString('hex') + ':' + hash.toString('hex');
}

/**
 * Verifies hashed data
 * @param data The original data
 * @param hashedData The hashed data to verify against
 * @returns True if the data matches the hash
 */
export async function verifyHashedData(data: string, hashedData: string): Promise<boolean> {
  try {
    const [saltHex, hashHex] = hashedData.split(':');
    const saltBuffer = Buffer.from(saltHex, 'hex');
    const hash = await scryptAsync(data, saltBuffer, 64) as Buffer;
    return hash.toString('hex') === hashHex;
  } catch (error) {
    return false;
  }
}