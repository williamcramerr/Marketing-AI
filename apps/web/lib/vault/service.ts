import { createAdminClient } from '@/lib/supabase/admin';

/**
 * VaultService handles secure storage and retrieval of sensitive credentials
 * using Supabase Vault for encryption at rest.
 *
 * All secrets are stored encrypted in the vault.secrets table and can only
 * be decrypted by calling the appropriate RPC functions with service role access.
 */
export class VaultService {
  private _supabase: ReturnType<typeof createAdminClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = createAdminClient();
    }
    return this._supabase;
  }

  /**
   * Store a secret in Vault and return the secret ID
   */
  async storeSecret(
    name: string,
    value: string,
    description?: string
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc('store_secret', {
      p_name: name,
      p_secret: value,
      p_description: description || null,
    });

    if (error) {
      throw new Error(`Failed to store secret: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Retrieve a decrypted secret by ID
   */
  async getSecret(secretId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('get_secret', {
      p_secret_id: secretId,
    });

    if (error) {
      throw new Error(`Failed to retrieve secret: ${error.message}`);
    }

    return data as string | null;
  }

  /**
   * Update an existing secret
   */
  async updateSecret(secretId: string, newValue: string): Promise<void> {
    const { error } = await this.supabase.rpc('update_secret', {
      p_secret_id: secretId,
      p_new_secret: newValue,
    });

    if (error) {
      throw new Error(`Failed to update secret: ${error.message}`);
    }
  }

  /**
   * Delete a secret from Vault
   */
  async deleteSecret(secretId: string): Promise<void> {
    const { error } = await this.supabase.rpc('delete_secret', {
      p_secret_id: secretId,
    });

    if (error) {
      throw new Error(`Failed to delete secret: ${error.message}`);
    }
  }

  /**
   * Batch retrieve multiple secrets
   * Returns a map of secret ID to decrypted value
   */
  async getSecretsBatch(secretIds: string[]): Promise<Record<string, string>> {
    if (secretIds.length === 0) {
      return {};
    }

    const { data, error } = await this.supabase.rpc('get_secrets_batch', {
      p_secret_ids: secretIds,
    });

    if (error) {
      throw new Error(`Failed to retrieve secrets batch: ${error.message}`);
    }

    return (data as Record<string, string>) || {};
  }

  /**
   * Store multiple credentials for a connector
   * Returns a map of field name to Vault secret ID
   */
  async storeConnectorCredentials(
    connectorId: string,
    credentials: Record<string, string>
  ): Promise<Record<string, string>> {
    const vaultIds: Record<string, string> = {};

    for (const [fieldName, value] of Object.entries(credentials)) {
      // Only store non-empty values that are sensitive
      if (value && this.isSensitiveField(fieldName)) {
        const secretId = await this.storeSecret(
          `connector_${connectorId}_${fieldName}`,
          value,
          `${fieldName} for connector ${connectorId}`
        );
        vaultIds[fieldName] = secretId;
      }
    }

    return vaultIds;
  }

  /**
   * Retrieve all credentials for a connector using vault IDs
   * Returns decrypted credentials as key-value pairs
   */
  async getConnectorCredentials(
    vaultIds: Record<string, string>
  ): Promise<Record<string, string>> {
    const secretIds = Object.values(vaultIds);

    if (secretIds.length === 0) {
      return {};
    }

    // Batch fetch all secrets
    const secretsMap = await this.getSecretsBatch(secretIds);

    // Map back to original field names
    const credentials: Record<string, string> = {};
    for (const [fieldName, secretId] of Object.entries(vaultIds)) {
      const value = secretsMap[secretId];
      if (value) {
        credentials[fieldName] = value;
      }
    }

    return credentials;
  }

  /**
   * Update credentials for a connector
   * Handles adding new secrets and updating existing ones
   */
  async updateConnectorCredentials(
    connectorId: string,
    newCredentials: Record<string, string>,
    existingVaultIds: Record<string, string>
  ): Promise<Record<string, string>> {
    const updatedVaultIds: Record<string, string> = { ...existingVaultIds };

    for (const [fieldName, value] of Object.entries(newCredentials)) {
      if (!this.isSensitiveField(fieldName)) {
        continue;
      }

      const existingSecretId = existingVaultIds[fieldName];

      if (value) {
        if (existingSecretId) {
          // Update existing secret
          await this.updateSecret(existingSecretId, value);
        } else {
          // Create new secret
          const secretId = await this.storeSecret(
            `connector_${connectorId}_${fieldName}`,
            value,
            `${fieldName} for connector ${connectorId}`
          );
          updatedVaultIds[fieldName] = secretId;
        }
      } else if (existingSecretId) {
        // Value is empty/null - delete the secret
        await this.deleteSecret(existingSecretId);
        delete updatedVaultIds[fieldName];
      }
    }

    return updatedVaultIds;
  }

  /**
   * Delete all credentials for a connector
   */
  async deleteConnectorCredentials(
    vaultIds: Record<string, string>
  ): Promise<void> {
    for (const secretId of Object.values(vaultIds)) {
      await this.deleteSecret(secretId);
    }
  }

  /**
   * Determine if a field name represents sensitive data that should be encrypted
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      'key',
      'secret',
      'token',
      'password',
      'credential',
      'api_key',
      'apikey',
      'access_token',
      'refresh_token',
      'bearer',
      'auth',
    ];

    const lowerFieldName = fieldName.toLowerCase();
    return sensitivePatterns.some(
      (pattern) =>
        lowerFieldName.includes(pattern) || lowerFieldName === pattern
    );
  }

  /**
   * Check if credentials are using legacy plain-text storage
   * (credentials column populated, vault IDs empty)
   */
  isLegacyCredentials(
    credentials: Record<string, unknown>,
    vaultIds: Record<string, string>
  ): boolean {
    const hasCredentials = Object.keys(credentials).length > 0;
    const hasVaultIds = Object.keys(vaultIds).length > 0;
    return hasCredentials && !hasVaultIds;
  }
}

// Export singleton instance for convenience
export const vaultService = new VaultService();
