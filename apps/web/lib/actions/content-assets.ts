'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type AssetType =
  | 'blog_post'
  | 'landing_page'
  | 'email_template'
  | 'social_post'
  | 'image'
  | 'document';

export interface ContentAsset {
  id: string;
  task_id: string | null;
  product_id: string;
  type: AssetType;
  title: string;
  content: string | null;
  metadata: Record<string, any>;
  version: number;
  parent_asset_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: { id: string; name: string };
  task?: { id: string; title: string };
}

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return membership?.organization_id || null;
}

/**
 * List all content assets for the organization
 */
export async function listContentAssets(filters?: {
  productId?: string;
  type?: AssetType;
  published?: boolean;
}): Promise<ActionResult<ContentAsset[]>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Get products for this organization to filter assets
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId);

    const productIds = products?.map((p) => p.id) || [];

    if (productIds.length === 0) {
      return { success: true, data: [] };
    }

    let query = supabase
      .from('content_assets')
      .select(
        `
        *,
        product:products(id, name),
        task:tasks(id, title)
      `
      )
      .in('product_id', productIds)
      .order('created_at', { ascending: false });

    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.published !== undefined) {
      query = query.eq('published', filters.published);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ContentAsset[] };
  } catch (error: any) {
    console.error('Error listing content assets:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single content asset by ID
 */
export async function getContentAsset(id: string): Promise<ActionResult<ContentAsset>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('content_assets')
      .select(
        `
        *,
        product:products(id, name),
        task:tasks(id, title)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Verify the asset belongs to the organization
    const { data: product } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', data.product_id)
      .single();

    if (product?.organization_id !== organizationId) {
      return { success: false, error: 'Asset not found' };
    }

    return { success: true, data: data as ContentAsset };
  } catch (error: any) {
    console.error('Error getting content asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new content asset
 */
export async function createContentAsset(input: {
  product_id: string;
  type: AssetType;
  title: string;
  content?: string;
  metadata?: Record<string, any>;
  external_url?: string;
}): Promise<ActionResult<ContentAsset>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Verify product belongs to organization
    const { data: product } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', input.product_id)
      .single();

    if (product?.organization_id !== organizationId) {
      return { success: false, error: 'Product not found' };
    }

    const { data, error } = await supabase
      .from('content_assets')
      .insert({
        product_id: input.product_id,
        type: input.type,
        title: input.title,
        content: input.content || null,
        metadata: input.metadata || {},
        external_url: input.external_url || null,
        version: 1,
        published: false,
      })
      .select(
        `
        *,
        product:products(id, name),
        task:tasks(id, title)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/content');
    return { success: true, data: data as ContentAsset };
  } catch (error: any) {
    console.error('Error creating content asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a content asset
 */
export async function updateContentAsset(
  id: string,
  input: {
    title?: string;
    content?: string;
    metadata?: Record<string, any>;
    external_url?: string;
  }
): Promise<ActionResult<ContentAsset>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Get current asset to verify ownership and get version
    const current = await getContentAsset(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Asset not found' };
    }

    const { data, error } = await supabase
      .from('content_assets')
      .update({
        title: input.title,
        content: input.content,
        metadata: input.metadata,
        external_url: input.external_url,
        version: current.data.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        product:products(id, name),
        task:tasks(id, title)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/content');
    revalidatePath(`/dashboard/content/${id}`);
    return { success: true, data: data as ContentAsset };
  } catch (error: any) {
    console.error('Error updating content asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Publish or unpublish a content asset
 */
export async function togglePublishAsset(
  id: string,
  published: boolean
): Promise<ActionResult<ContentAsset>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Verify ownership
    const current = await getContentAsset(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Asset not found' };
    }

    const { data, error } = await supabase
      .from('content_assets')
      .update({
        published,
        published_at: published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        `
        *,
        product:products(id, name),
        task:tasks(id, title)
      `
      )
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/content');
    revalidatePath(`/dashboard/content/${id}`);
    return { success: true, data: data as ContentAsset };
  } catch (error: any) {
    console.error('Error toggling publish state:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a content asset
 */
export async function deleteContentAsset(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Verify ownership
    const current = await getContentAsset(id);
    if (!current.success || !current.data) {
      return { success: false, error: 'Asset not found' };
    }

    const { error } = await supabase.from('content_assets').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/content');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting content asset:', error);
    return { success: false, error: error.message };
  }
}

// Note: getAssetTypeDisplayName moved to @/lib/utils/content-utils.ts
