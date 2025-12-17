/**
 * Setup script for load testing test data
 *
 * This script helps create the necessary test users, organizations,
 * campaigns, and products for load testing.
 *
 * Run with: node load-tests/setup-test-data.js
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEST_USER_COUNT = 10;
const TEST_ORG_COUNT = 5;
const TEST_CAMPAIGNS_PER_ORG = 10;
const TEST_PRODUCTS_PER_ORG = 5;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Main setup function
 */
async function setupTestData() {
  console.log('=== Load Testing Data Setup ===');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Step 1: Create test users
    console.log('Step 1: Creating test users...');
    const users = await createTestUsers();
    console.log(`Created ${users.length} test users`);
    console.log('');

    // Step 2: Create test organizations
    console.log('Step 2: Creating test organizations...');
    const organizations = await createTestOrganizations(users);
    console.log(`Created ${organizations.length} test organizations`);
    console.log('');

    // Step 3: Create test products
    console.log('Step 3: Creating test products...');
    const products = await createTestProducts(organizations);
    console.log(`Created ${products.length} test products`);
    console.log('');

    // Step 4: Create test campaigns
    console.log('Step 4: Creating test campaigns...');
    const campaigns = await createTestCampaigns(products);
    console.log(`Created ${campaigns.length} test campaigns`);
    console.log('');

    // Print summary
    console.log('=== Setup Complete ===');
    console.log(`Total Users: ${users.length}`);
    console.log(`Total Organizations: ${organizations.length}`);
    console.log(`Total Products: ${products.length}`);
    console.log(`Total Campaigns: ${campaigns.length}`);
    console.log('');
    console.log('Test Credentials:');
    console.log('Email: loadtest1@example.com - loadtest10@example.com');
    console.log('Password: LoadTest123!');
    console.log('');
    console.log('You can now run load tests with:');
    console.log('npm run test:load:smoke');
  } catch (error) {
    console.error('Error setting up test data:', error);
    process.exit(1);
  }
}

/**
 * Create test users
 */
async function createTestUsers() {
  const users = [];

  for (let i = 1; i <= TEST_USER_COUNT; i++) {
    const email = `loadtest${i}@example.com`;
    const password = 'LoadTest123!';

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);

      if (existingUser) {
        console.log(`  User ${email} already exists, skipping...`);
        users.push(existingUser);
        continue;
      }

      // Create new user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: `Load Test User ${i}`,
          role: 'test_user',
        },
      });

      if (error) {
        console.error(`  Error creating user ${email}:`, error.message);
        continue;
      }

      console.log(`  Created user: ${email}`);
      users.push(newUser.user);
    } catch (error) {
      console.error(`  Error processing user ${email}:`, error.message);
    }
  }

  return users;
}

/**
 * Create test organizations
 */
async function createTestOrganizations(users) {
  const organizations = [];

  for (let i = 1; i <= TEST_ORG_COUNT; i++) {
    const orgData = {
      name: `Load Test Organization ${i}`,
      slug: `loadtest-org-${i}`,
      subscription_status: 'active',
    };

    try {
      // Check if organization already exists
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgData.slug)
        .single();

      if (existing) {
        console.log(`  Organization ${orgData.name} already exists, skipping...`);
        organizations.push(existing);
        continue;
      }

      // Create organization
      const { data: org, error } = await supabase
        .from('organizations')
        .insert(orgData)
        .select()
        .single();

      if (error) {
        console.error(`  Error creating organization ${orgData.name}:`, error.message);
        continue;
      }

      console.log(`  Created organization: ${orgData.name}`);

      // Add users to organization (2 users per org)
      const orgUsers = users.slice((i - 1) * 2, i * 2);
      for (const user of orgUsers) {
        await supabase.from('organization_members').insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'admin',
        });
      }

      organizations.push(org);
    } catch (error) {
      console.error(`  Error processing organization ${orgData.name}:`, error.message);
    }
  }

  return organizations;
}

/**
 * Create test products
 */
async function createTestProducts(organizations) {
  const products = [];

  for (const org of organizations) {
    for (let i = 1; i <= TEST_PRODUCTS_PER_ORG; i++) {
      const productData = {
        organization_id: org.id,
        name: `Test Product ${i}`,
        description: `Load testing product ${i} for organization ${org.name}`,
        status: 'active',
      };

      try {
        const { data: product, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) {
          console.error(`  Error creating product:`, error.message);
          continue;
        }

        console.log(`  Created product: ${productData.name} for ${org.name}`);
        products.push(product);
      } catch (error) {
        console.error(`  Error processing product:`, error.message);
      }
    }
  }

  return products;
}

/**
 * Create test campaigns
 */
async function createTestCampaigns(products) {
  const campaigns = [];

  for (const product of products) {
    for (let i = 1; i <= TEST_CAMPAIGNS_PER_ORG; i++) {
      const campaignData = {
        product_id: product.id,
        name: `Test Campaign ${i}`,
        description: `Load testing campaign ${i} for product ${product.name}`,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      try {
        const { data: campaign, error } = await supabase
          .from('campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (error) {
          console.error(`  Error creating campaign:`, error.message);
          continue;
        }

        console.log(`  Created campaign: ${campaignData.name} for ${product.name}`);
        campaigns.push(campaign);
      } catch (error) {
        console.error(`  Error processing campaign:`, error.message);
      }
    }
  }

  return campaigns;
}

/**
 * Clean up test data (optional)
 */
async function cleanupTestData() {
  console.log('=== Cleaning up test data ===');

  try {
    // Delete in reverse order (campaigns -> products -> organizations -> users)
    console.log('Deleting test campaigns...');
    await supabase.from('campaigns').delete().like('name', 'Test Campaign%');

    console.log('Deleting test products...');
    await supabase.from('products').delete().like('name', 'Test Product%');

    console.log('Deleting test organizations...');
    await supabase.from('organizations').delete().like('slug', 'loadtest-org-%');

    console.log('Deleting test users...');
    for (let i = 1; i <= TEST_USER_COUNT; i++) {
      const email = `loadtest${i}@example.com`;
      const { data: user } = await supabase.auth.admin.getUserByEmail(email);
      if (user) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Run setup
const command = process.argv[2];

if (command === 'cleanup') {
  cleanupTestData();
} else {
  setupTestData();
}
