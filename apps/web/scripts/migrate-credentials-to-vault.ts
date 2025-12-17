/**
 * One-time migration script to move existing plain-text credentials to Vault
 *
 * Usage:
 *   npx tsx scripts/migrate-credentials-to-vault.ts
 *
 * Or with pnpm:
 *   pnpm tsx scripts/migrate-credentials-to-vault.ts
 *
 * This script will:
 * 1. Find all connectors with plain-text credentials
 * 2. Store each credential in Supabase Vault
 * 3. Update the connector with vault IDs
 * 4. Clear the plain-text credentials
 *
 * The script is idempotent - it will skip connectors that have already been migrated.
 */

import { createClient } from '@supabase/supabase-js';

// Sensitive field patterns that should be encrypted
const SENSITIVE_PATTERNS = [
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

function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_PATTERNS.some(
    (pattern) => lowerFieldName.includes(pattern) || lowerFieldName === pattern
  );
}

async function main() {
  console.log('Starting credential migration to Vault...\n');

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('Make sure your .env file is loaded or environment variables are set.');
    process.exit(1);
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get all connectors
  const { data: connectors, error: fetchError } = await supabase
    .from('connectors')
    .select('id, name, type, credentials, credentials_vault_ids, config')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Error fetching connectors:', fetchError.message);
    process.exit(1);
  }

  if (!connectors || connectors.length === 0) {
    console.log('No connectors found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${connectors.length} connector(s) to check.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const connector of connectors) {
    const credentials = (connector.credentials || {}) as Record<string, unknown>;
    const existingVaultIds = (connector.credentials_vault_ids || {}) as Record<string, string>;
    const config = (connector.config || {}) as Record<string, unknown>;

    // Check if already migrated
    if (Object.keys(existingVaultIds).length > 0) {
      console.log(`[SKIP] ${connector.name} (${connector.id}) - Already migrated`);
      skippedCount++;
      continue;
    }

    // Check if there are any credentials to migrate
    // Credentials might be in the credentials column or config column
    const allCredentials = { ...credentials, ...config };
    const sensitiveFields = Object.entries(allCredentials).filter(
      ([key, value]) => isSensitiveField(key) && value && typeof value === 'string'
    );

    if (sensitiveFields.length === 0) {
      console.log(`[SKIP] ${connector.name} (${connector.id}) - No sensitive credentials found`);
      skippedCount++;
      continue;
    }

    console.log(`[MIGRATING] ${connector.name} (${connector.id})...`);
    console.log(`  Found ${sensitiveFields.length} sensitive field(s): ${sensitiveFields.map(([k]) => k).join(', ')}`);

    try {
      const vaultIds: Record<string, string> = {};

      // Store each sensitive field in Vault
      for (const [fieldName, value] of sensitiveFields) {
        const { data: secretId, error: storeError } = await supabase.rpc('store_secret', {
          p_name: `connector_${connector.id}_${fieldName}`,
          p_secret: value as string,
          p_description: `${fieldName} for connector ${connector.name} (${connector.id})`,
        });

        if (storeError) {
          throw new Error(`Failed to store ${fieldName}: ${storeError.message}`);
        }

        vaultIds[fieldName] = secretId;
        console.log(`  Stored ${fieldName} in Vault`);
      }

      // Prepare updated config without sensitive data
      const cleanConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (!isSensitiveField(key)) {
          cleanConfig[key] = value;
        }
      }

      // Update connector with vault IDs and clear plain-text credentials
      const { error: updateError } = await supabase
        .from('connectors')
        .update({
          credentials_vault_ids: vaultIds,
          credentials: {}, // Clear legacy credentials
          config: cleanConfig, // Remove sensitive data from config
        })
        .eq('id', connector.id);

      if (updateError) {
        throw new Error(`Failed to update connector: ${updateError.message}`);
      }

      console.log(`  [SUCCESS] Migrated ${sensitiveFields.length} credential(s)`);
      migratedCount++;
    } catch (error) {
      console.error(`  [ERROR] Migration failed: ${error}`);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped:  ${skippedCount}`);
  console.log(`  Errors:   ${errorCount}`);
  console.log('========================================');

  if (errorCount > 0) {
    console.log('\nSome migrations failed. Please review the errors above.');
    process.exit(1);
  }

  console.log('\nMigration completed successfully!');
}

// Run the migration
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
