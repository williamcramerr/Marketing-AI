'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ToneSettings {
  formality: number; // 0 = casual, 100 = formal
  friendliness: number; // 0 = professional, 100 = friendly
  humor: number; // 0 = serious, 100 = playful
  confidence: number; // 0 = humble, 100 = confident
  enthusiasm: number; // 0 = calm, 100 = enthusiastic
}

export interface BrandVoiceProfile {
  id: string;
  product_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  tone_settings: ToneSettings;
  writing_style: string; // e.g., 'conversational', 'technical', 'storytelling'
  vocabulary_preferences: string[];
  words_to_avoid: string[];
  guidelines_dos: string[];
  guidelines_donts: string[];
  example_content: string[];
  active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVoiceProfileInput {
  productId: string;
  name: string;
  description?: string;
  toneSettings: ToneSettings;
  writingStyle: string;
  vocabularyPreferences?: string[];
  wordsToAvoid?: string[];
  guidelinesDos?: string[];
  guidelinesDonts?: string[];
  exampleContent?: string[];
}

export interface UpdateVoiceProfileInput {
  name?: string;
  description?: string;
  toneSettings?: ToneSettings;
  writingStyle?: string;
  vocabularyPreferences?: string[];
  wordsToAvoid?: string[];
  guidelinesDos?: string[];
  guidelinesDonts?: string[];
  exampleContent?: string[];
  active?: boolean;
}

// Get voice profile for a product
export async function getVoiceProfile(productId: string): Promise<{
  success: boolean;
  profile?: BrandVoiceProfile;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('brand_voice_profiles')
    .select('*')
    .eq('product_id', productId)
    .eq('active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    return { success: false, error: error.message };
  }

  return { success: true, profile: data as BrandVoiceProfile | undefined };
}

// Get all voice profiles for an organization
export async function getOrganizationVoiceProfiles(): Promise<{
  success: boolean;
  profiles?: BrandVoiceProfile[];
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) {
    return { success: true, profiles: [] };
  }

  const orgIds = memberships.map((m) => m.organization_id);

  const { data, error } = await supabase
    .from('brand_voice_profiles')
    .select(`
      *,
      products (
        id,
        name
      )
    `)
    .in('organization_id', orgIds)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, profiles: data as BrandVoiceProfile[] };
}

// Create a new voice profile
export async function createVoiceProfile(
  input: CreateVoiceProfileInput
): Promise<{
  success: boolean;
  profile?: BrandVoiceProfile;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get product's organization
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('organization_id')
    .eq('id', input.productId)
    .single();

  if (productError || !product) {
    return { success: false, error: 'Product not found' };
  }

  // Deactivate any existing active profiles for this product
  await supabase
    .from('brand_voice_profiles')
    .update({ active: false })
    .eq('product_id', input.productId);

  const { data, error } = await supabase
    .from('brand_voice_profiles')
    .insert({
      product_id: input.productId,
      organization_id: product.organization_id,
      name: input.name,
      description: input.description || null,
      tone_settings: input.toneSettings,
      writing_style: input.writingStyle,
      vocabulary_preferences: input.vocabularyPreferences || [],
      words_to_avoid: input.wordsToAvoid || [],
      guidelines_dos: input.guidelinesDos || [],
      guidelines_donts: input.guidelinesDonts || [],
      example_content: input.exampleContent || [],
      active: true,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Create history entry
  await supabase.from('brand_voice_history').insert({
    profile_id: data.id,
    version: 1,
    tone_settings: input.toneSettings,
    writing_style: input.writingStyle,
    guidelines_dos: input.guidelinesDos || [],
    guidelines_donts: input.guidelinesDonts || [],
    changed_by: user.id,
    change_summary: 'Initial version',
  });

  revalidatePath('/dashboard/settings/brand-voice');
  revalidatePath(`/dashboard/products/${input.productId}`);

  return { success: true, profile: data as BrandVoiceProfile };
}

// Update a voice profile
export async function updateVoiceProfile(
  profileId: string,
  input: UpdateVoiceProfileInput
): Promise<{
  success: boolean;
  profile?: BrandVoiceProfile;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get current profile
  const { data: currentProfile, error: fetchError } = await supabase
    .from('brand_voice_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (fetchError || !currentProfile) {
    return { success: false, error: 'Profile not found' };
  }

  const newVersion = (currentProfile.version || 0) + 1;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: newVersion,
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.toneSettings !== undefined) updateData.tone_settings = input.toneSettings;
  if (input.writingStyle !== undefined) updateData.writing_style = input.writingStyle;
  if (input.vocabularyPreferences !== undefined) updateData.vocabulary_preferences = input.vocabularyPreferences;
  if (input.wordsToAvoid !== undefined) updateData.words_to_avoid = input.wordsToAvoid;
  if (input.guidelinesDos !== undefined) updateData.guidelines_dos = input.guidelinesDos;
  if (input.guidelinesDonts !== undefined) updateData.guidelines_donts = input.guidelinesDonts;
  if (input.exampleContent !== undefined) updateData.example_content = input.exampleContent;
  if (input.active !== undefined) updateData.active = input.active;

  const { data, error } = await supabase
    .from('brand_voice_profiles')
    .update(updateData)
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Create history entry
  await supabase.from('brand_voice_history').insert({
    profile_id: profileId,
    version: newVersion,
    tone_settings: input.toneSettings || currentProfile.tone_settings,
    writing_style: input.writingStyle || currentProfile.writing_style,
    guidelines_dos: input.guidelinesDos || currentProfile.guidelines_dos,
    guidelines_donts: input.guidelinesDonts || currentProfile.guidelines_donts,
    changed_by: user.id,
    change_summary: 'Updated profile',
  });

  revalidatePath('/dashboard/settings/brand-voice');

  return { success: true, profile: data as BrandVoiceProfile };
}

// Delete a voice profile
export async function deleteVoiceProfile(profileId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('brand_voice_profiles')
    .delete()
    .eq('id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/settings/brand-voice');

  return { success: true };
}

// Get voice profile history
export async function getVoiceProfileHistory(profileId: string): Promise<{
  success: boolean;
  history?: Array<{
    id: string;
    version: number;
    tone_settings: ToneSettings;
    writing_style: string;
    guidelines_dos: string[];
    guidelines_donts: string[];
    changed_by: string;
    change_summary: string;
    created_at: string;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('brand_voice_history')
    .select('*')
    .eq('profile_id', profileId)
    .order('version', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, history: data };
}

// Generate voice prompt for AI
export function generateVoicePrompt(profile: BrandVoiceProfile): string {
  const toneDescriptions = {
    formality: profile.tone_settings.formality > 50 ? 'formal' : 'casual',
    friendliness: profile.tone_settings.friendliness > 50 ? 'friendly and warm' : 'professional and straightforward',
    humor: profile.tone_settings.humor > 50 ? 'with appropriate humor' : 'serious and focused',
    confidence: profile.tone_settings.confidence > 50 ? 'confident and assertive' : 'humble and approachable',
    enthusiasm: profile.tone_settings.enthusiasm > 50 ? 'enthusiastic and energetic' : 'calm and measured',
  };

  let prompt = `Write in a ${toneDescriptions.formality}, ${toneDescriptions.friendliness} tone. `;
  prompt += `Be ${toneDescriptions.humor}. `;
  prompt += `The voice should be ${toneDescriptions.confidence} and ${toneDescriptions.enthusiasm}. `;
  prompt += `Writing style: ${profile.writing_style}. `;

  if (profile.vocabulary_preferences.length > 0) {
    prompt += `Prefer using words like: ${profile.vocabulary_preferences.join(', ')}. `;
  }

  if (profile.words_to_avoid.length > 0) {
    prompt += `Avoid using: ${profile.words_to_avoid.join(', ')}. `;
  }

  if (profile.guidelines_dos.length > 0) {
    prompt += `DO: ${profile.guidelines_dos.join('; ')}. `;
  }

  if (profile.guidelines_donts.length > 0) {
    prompt += `DON'T: ${profile.guidelines_donts.join('; ')}. `;
  }

  return prompt;
}
