'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface CreateContentBriefInput {
  title: string;
  targetKeyword: string;
  secondaryKeywords?: string[];
  contentType: string;
  targetWordCount: number;
  tone: string;
  metaDescription?: string;
  outline?: string;
  keyPoints?: string[];
  callToAction?: string;
  includeStats?: boolean;
  includeExamples?: boolean;
  keywordId?: string;
}

export async function createContentBrief(input: CreateContentBriefInput): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return { success: false, error: 'No organization found' };
    }

    // Get the first product for this organization (or create logic to select one)
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .limit(1)
      .single();

    if (!product) {
      return { success: false, error: 'No product found. Please create a product first.' };
    }

    // Create the content brief
    const { data: brief, error: briefError } = await supabase
      .from('content_briefs')
      .insert({
        product_id: product.id,
        title: input.title,
        target_keyword: input.targetKeyword,
        secondary_keywords: input.secondaryKeywords || [],
        content_type: input.contentType,
        target_word_count: input.targetWordCount,
        tone: input.tone,
        meta_description: input.metaDescription || null,
        outline: input.outline || null,
        key_points: input.keyPoints || [],
        call_to_action: input.callToAction || null,
        include_stats: input.includeStats ?? true,
        include_examples: input.includeExamples ?? true,
        keyword_id: input.keywordId || null,
        status: 'draft',
      })
      .select()
      .single();

    if (briefError) {
      console.error('Error creating content brief:', briefError);
      return { success: false, error: briefError.message };
    }

    revalidatePath('/dashboard/growth/seo/briefs');
    return { success: true, data: brief };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateContentBrief(
  id: string,
  input: Partial<CreateContentBriefInput> & { status?: string }
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.targetKeyword) updates.target_keyword = input.targetKeyword;
    if (input.secondaryKeywords !== undefined) updates.secondary_keywords = input.secondaryKeywords;
    if (input.contentType) updates.content_type = input.contentType;
    if (input.targetWordCount) updates.target_word_count = input.targetWordCount;
    if (input.tone) updates.tone = input.tone;
    if (input.metaDescription !== undefined) updates.meta_description = input.metaDescription;
    if (input.outline !== undefined) updates.outline = input.outline;
    if (input.keyPoints !== undefined) updates.key_points = input.keyPoints;
    if (input.callToAction !== undefined) updates.call_to_action = input.callToAction;
    if (input.includeStats !== undefined) updates.include_stats = input.includeStats;
    if (input.includeExamples !== undefined) updates.include_examples = input.includeExamples;
    if (input.status) updates.status = input.status;

    const { data: brief, error } = await supabase
      .from('content_briefs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/growth/seo/briefs');
    revalidatePath(`/dashboard/growth/seo/briefs/${id}`);
    return { success: true, data: brief };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteContentBrief(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('content_briefs')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/growth/seo/briefs');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function generateBriefOutline(keyword: string): Promise<{ success: boolean; outline?: string; error?: string }> {
  // In a real implementation, this would call an AI API
  // For now, return a template outline
  const outline = `## Introduction
- Hook the reader with a compelling statistic or question
- Introduce the topic: ${keyword}
- Preview what the article will cover

## What is ${keyword}?
- Definition and overview
- Why it matters

## Key Benefits
- Benefit 1: [Detail]
- Benefit 2: [Detail]
- Benefit 3: [Detail]

## How to Get Started
- Step 1: [Action]
- Step 2: [Action]
- Step 3: [Action]

## Best Practices
- Tip 1
- Tip 2
- Tip 3

## Common Mistakes to Avoid
- Mistake 1
- Mistake 2

## Conclusion
- Summarize key points
- Call to action`;

  return { success: true, outline };
}
