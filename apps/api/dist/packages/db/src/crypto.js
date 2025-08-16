"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptApiKey = encryptApiKey;
exports.decryptApiKey = decryptApiKey;
exports.hashData = hashData;
exports.verifyHashedData = verifyHashedData;
const crypto_1 = require("crypto");
const util_1 = require("util");
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
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
async function encryptApiKey(apiKey) {
    try {
        // Generate a random initialization vector
        const iv = (0, crypto_1.randomBytes)(16);
        // Create cipher using GCM mode for authenticated encryption
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', ENCRYPTION_KEY, iv);
        // Encrypt the API key
        let encrypted = cipher.update(apiKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // Get the authentication tag
        const authTag = cipher.getAuthTag();
        // Return iv:authTag:encrypted
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    catch (error) {
        throw new Error(`Failed to encrypt API key: ${error.message}`);
    }
}
/**
 * Decrypts an API key from the database
 * @param encryptedApiKey The encrypted API key from the database (format: iv:authTag:encrypted)
 * @returns The decrypted plain text API key
 */
async function decryptApiKey(encryptedApiKey) {
    try {
        // Split IV, auth tag, and encrypted data
        const [ivHex, authTagHex, encrypted] = encryptedApiKey.split(':');
        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error('Invalid encrypted API key format');
        }
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        // Create decipher using GCM mode
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        // Decrypt the API key
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (error) {
        throw new Error(`Failed to decrypt API key: ${error.message}`);
    }
}
/**
 * Utility function to securely hash data (useful for additional security measures)
 * @param data The data to hash
 * @param salt Optional salt for the hash
 * @returns The hashed data as a hex string
 */
async function hashData(data, salt) {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : (0, crypto_1.randomBytes)(16);
    const hash = await scryptAsync(data, saltBuffer, 64);
    return saltBuffer.toString('hex') + ':' + hash.toString('hex');
}
/**
 * Verifies hashed data
 * @param data The original data
 * @param hashedData The hashed data to verify against
 * @returns True if the data matches the hash
 */
async function verifyHashedData(data, hashedData) {
    try {
        const [saltHex, hashHex] = hashedData.split(':');
        const saltBuffer = Buffer.from(saltHex, 'hex');
        const hash = await scryptAsync(data, saltBuffer, 64);
        return hash.toString('hex') === hashHex;
    }
    catch (error) {
        return false;
    }
}
