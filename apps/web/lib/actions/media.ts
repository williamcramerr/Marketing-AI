'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface MediaAsset {
  id: string;
  name: string;
  file_url: string;
  content_type: string;
  file_size?: number;
  thumbnail_url?: string;
  collection_id?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
  tags?: string[];
}

export interface MediaCollection {
  id: string;
  name: string;
  parent_id?: string;
  organization_id: string;
  created_at: string;
  asset_count?: number;
}

export interface AssetTag {
  id: string;
  name: string;
  organization_id: string;
}

export async function getMediaAssets(
  organizationId: string,
  options: {
    collectionId?: string;
    search?: string;
    contentType?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  } = {}
): Promise<{ assets: MediaAsset[]; total: number }> {
  const { collectionId, search, contentType, limit = 50, offset = 0, includeArchived = false } = options;
  const supabase = await createClient();

  let query = supabase
    .from('content_assets')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (collectionId) {
    query = query.eq('collection_id', collectionId);
  }

  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (contentType) {
    query = query.ilike('content_type', `${contentType}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching media assets:', error);
    return { assets: [], total: 0 };
  }

  return {
    assets: (data as MediaAsset[]) || [],
    total: count || 0,
  };
}

export async function getMediaAsset(assetId: string): Promise<MediaAsset | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_assets')
    .select('*')
    .eq('id', assetId)
    .single();

  if (error) {
    console.error('Error fetching media asset:', error);
    return null;
  }

  return data as MediaAsset;
}

export async function uploadAsset(
  organizationId: string,
  file: File,
  options: {
    collectionId?: string;
    tags?: string[];
  } = {}
): Promise<{ success: boolean; asset?: MediaAsset; error?: string }> {
  const supabase = await createClient();

  // Upload file to Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${organizationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    return { success: false, error: uploadError.message };
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);

  // Create asset record
  const { data: asset, error: assetError } = await supabase
    .from('content_assets')
    .insert({
      name: file.name,
      file_url: urlData.publicUrl,
      content_type: file.type,
      file_size: file.size,
      organization_id: organizationId,
      collection_id: options.collectionId,
      is_archived: false,
    })
    .select()
    .single();

  if (assetError) {
    console.error('Error creating asset record:', assetError);
    return { success: false, error: assetError.message };
  }

  // Add tags if provided
  if (options.tags && options.tags.length > 0) {
    await tagAsset(asset.id, options.tags);
  }

  revalidatePath('/dashboard/media');
  return { success: true, asset: asset as MediaAsset };
}

export async function deleteAsset(
  assetId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Soft delete by archiving
  const { error } = await supabase
    .from('content_assets')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', assetId);

  if (error) {
    console.error('Error deleting asset:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

export async function moveAsset(
  assetId: string,
  collectionId: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('content_assets')
    .update({ collection_id: collectionId, updated_at: new Date().toISOString() })
    .eq('id', assetId);

  if (error) {
    console.error('Error moving asset:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

export async function renameAsset(
  assetId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('content_assets')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', assetId);

  if (error) {
    console.error('Error renaming asset:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

// Collections

export async function getCollections(
  organizationId: string
): Promise<MediaCollection[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('media_collections')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching collections:', error);
    return [];
  }

  return (data as MediaCollection[]) || [];
}

export async function createCollection(
  organizationId: string,
  name: string,
  parentId?: string
): Promise<{ success: boolean; collection?: MediaCollection; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('media_collections')
    .insert({
      name,
      organization_id: organizationId,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating collection:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true, collection: data as MediaCollection };
}

export async function deleteCollection(
  collectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Move all assets in this collection to root (null collection_id)
  await supabase
    .from('content_assets')
    .update({ collection_id: null })
    .eq('collection_id', collectionId);

  // Delete the collection
  const { error } = await supabase
    .from('media_collections')
    .delete()
    .eq('id', collectionId);

  if (error) {
    console.error('Error deleting collection:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

export async function renameCollection(
  collectionId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('media_collections')
    .update({ name: newName })
    .eq('id', collectionId);

  if (error) {
    console.error('Error renaming collection:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

// Tags

export async function getAssetTags(
  organizationId: string
): Promise<AssetTag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('asset_tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching asset tags:', error);
    return [];
  }

  return (data as AssetTag[]) || [];
}

export async function tagAsset(
  assetId: string,
  tagNames: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get asset to find organization_id
  const { data: asset } = await supabase
    .from('content_assets')
    .select('organization_id')
    .eq('id', assetId)
    .single();

  if (!asset) {
    return { success: false, error: 'Asset not found' };
  }

  // Get or create tags
  for (const tagName of tagNames) {
    // Find or create tag
    let { data: tag } = await supabase
      .from('asset_tags')
      .select('id')
      .eq('organization_id', asset.organization_id)
      .eq('name', tagName)
      .single();

    if (!tag) {
      const { data: newTag } = await supabase
        .from('asset_tags')
        .insert({ name: tagName, organization_id: asset.organization_id })
        .select('id')
        .single();
      tag = newTag;
    }

    if (tag) {
      // Create mapping
      await supabase
        .from('asset_tag_mappings')
        .upsert({ asset_id: assetId, tag_id: tag.id });
    }
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}

export async function removeTagFromAsset(
  assetId: string,
  tagId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('asset_tag_mappings')
    .delete()
    .eq('asset_id', assetId)
    .eq('tag_id', tagId);

  if (error) {
    console.error('Error removing tag from asset:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/media');
  return { success: true };
}
