'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import { generateSlug } from '@/lib/utils';

export type ProductFormData = {
  name: string;
  slug?: string;
  description?: string;
  website_url?: string;
  positioning?: Record<string, any>;
  brand_guidelines?: Record<string, any>;
  verified_claims?: Record<string, any>;
  active?: boolean;
};

async function getUserOrganizationId() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user's first organization (in a real app, you'd select from multiple orgs)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    throw new Error('No organization found');
  }

  return membership.organization_id;
}

export async function getProducts() {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { success: false, error: String(error) };
  }
}

export async function getProduct(id: string) {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching product:', error);
    return { success: false, error: String(error) };
  }
}

export async function createProduct(formData: ProductFormData) {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    // Generate slug from name if not provided
    const slug = formData.slug || generateSlug(formData.name);

    // Check if slug already exists for this organization
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .single();

    if (existing) {
      return { success: false, error: 'A product with this name already exists' };
    }

    const productData: TablesInsert<'products'> = {
      organization_id: organizationId,
      name: formData.name,
      slug,
      description: formData.description || null,
      website_url: formData.website_url || null,
      positioning: formData.positioning || {},
      brand_guidelines: formData.brand_guidelines || {},
      verified_claims: formData.verified_claims || {},
      active: formData.active ?? true,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/products');
    return { success: true, data };
  } catch (error) {
    console.error('Error creating product:', error);
    return { success: false, error: String(error) };
  }
}

export async function updateProduct(id: string, formData: ProductFormData) {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    // Verify product belongs to user's organization
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existing) {
      return { success: false, error: 'Product not found' };
    }

    // Generate slug from name if not provided
    const slug = formData.slug || generateSlug(formData.name);

    // Check if slug already exists for this organization (excluding current product)
    const { data: duplicateSlug } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (duplicateSlug) {
      return { success: false, error: 'A product with this name already exists' };
    }

    const productData: TablesUpdate<'products'> = {
      name: formData.name,
      slug,
      description: formData.description || null,
      website_url: formData.website_url || null,
      positioning: formData.positioning || {},
      brand_guidelines: formData.brand_guidelines || {},
      verified_claims: formData.verified_claims || {},
      active: formData.active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/products');
    revalidatePath(`/dashboard/products/${id}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: String(error) };
  }
}

export async function deleteProduct(id: string) {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    // Verify product belongs to user's organization
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existing) {
      return { success: false, error: 'Product not found' };
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/dashboard/products');
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: String(error) };
  }
}

export async function toggleProductActive(id: string, active: boolean) {
  try {
    const supabase = await createClient();
    const organizationId = await getUserOrganizationId();

    // Verify product belongs to user's organization
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existing) {
      return { success: false, error: 'Product not found' };
    }

    const { data, error } = await supabase
      .from('products')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/dashboard/products');
    revalidatePath(`/dashboard/products/${id}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error toggling product active status:', error);
    return { success: false, error: String(error) };
  }
}
