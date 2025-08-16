/**
 * Example service demonstrating how to properly use the encryption utilities
 * for secure API key storage and retrieval.
 * 
 * This is an example - in a real NestJS application, this would be a proper service
 * with dependency injection and proper error handling.
 */

import { prisma } from './client';
import { encryptApiKey, decryptApiKey } from './crypto';

export class ProviderKeyService {
  /**
   * Creates a new provider key with encrypted API key storage
   */
  async createProviderKey(projectId: string, provider: string, apiKey: string) {
    // Encrypt the API key before storing it
    const encryptedApiKey = await encryptApiKey(apiKey);
    
    return await prisma.providerKey.create({
      data: {
        projectId,
        provider,
        apiKey: encryptedApiKey, // Store the encrypted version
      },
    });
  }

  /**
   * Retrieves a provider key and decrypts the API key
   */
  async getProviderKey(id: string) {
    const providerKey = await prisma.providerKey.findUnique({
      where: { id },
    });

    if (!providerKey) {
      throw new Error('Provider key not found');
    }

    // Decrypt the API key before returning
    const decryptedApiKey = await decryptApiKey(providerKey.apiKey);

    return {
      ...providerKey,
      apiKey: decryptedApiKey, // Return the decrypted version
    };
  }

  /**
   * Updates a provider key with a new encrypted API key
   */
  async updateProviderKey(id: string, newApiKey: string) {
    // Encrypt the new API key
    const encryptedApiKey = await encryptApiKey(newApiKey);

    return await prisma.providerKey.update({
      where: { id },
      data: {
        apiKey: encryptedApiKey, // Store the encrypted version
      },
    });
  }

  /**
   * Gets all provider keys for a project (with decrypted API keys)
   * Note: In production, you might want to be more selective about when to decrypt
   */
  async getProviderKeysForProject(projectId: string) {
    const providerKeys = await prisma.providerKey.findMany({
      where: { projectId },
    });

    // Decrypt all API keys
    const decryptedKeys = await Promise.all(
      providerKeys.map(async (key) => ({
        ...key,
        apiKey: await decryptApiKey(key.apiKey),
      }))
    );

    return decryptedKeys;
  }
}

// Usage example:
// const service = new ProviderKeyService();
// await service.createProviderKey('project-id', 'openai', 'sk-...');
// const key = await service.getProviderKey('key-id');
// console.log(key.apiKey); // This will be the decrypted API key