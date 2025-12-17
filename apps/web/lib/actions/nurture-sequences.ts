'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface CreateSequenceInput {
  name: string;
  description?: string;
  trigger: string;
  fromName?: string;
  fromEmail?: string;
  stopOnReply?: boolean;
  stopOnConversion?: boolean;
  emails: {
    subject: string;
    delay_days: number;
    content: string;
    order: number;
  }[];
}

export async function createNurtureSequence(input: CreateSequenceInput): Promise<{ success: boolean; error?: string; data?: any }> {
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

    // Create the sequence
    const { data: sequence, error: seqError } = await supabase
      .from('nurture_sequences')
      .insert({
        organization_id: membership.organization_id,
        name: input.name,
        description: input.description || null,
        trigger_type: input.trigger,
        from_name: input.fromName || null,
        from_email: input.fromEmail || null,
        stop_on_reply: input.stopOnReply ?? true,
        stop_on_conversion: input.stopOnConversion ?? true,
        status: 'draft',
        email_count: input.emails.length,
      })
      .select()
      .single();

    if (seqError) {
      console.error('Error creating sequence:', seqError);
      return { success: false, error: seqError.message };
    }

    // Create the emails
    if (input.emails.length > 0) {
      const emailsToInsert = input.emails.map((email, index) => ({
        sequence_id: sequence.id,
        sequence_order: index + 1,
        delay_days: email.delay_days,
        subject: email.subject,
        body_text: email.content,
        body_html: `<p>${email.content.replace(/\n/g, '</p><p>')}</p>`,
        email_type: 'value',
        active: true,
      }));

      const { error: emailError } = await supabase
        .from('nurture_emails')
        .insert(emailsToInsert);

      if (emailError) {
        console.error('Error creating emails:', emailError);
        // Don't fail the whole operation if emails fail
      }
    }

    revalidatePath('/dashboard/growth/leads/sequences');
    return { success: true, data: sequence };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateNurtureSequence(
  id: string,
  input: Partial<CreateSequenceInput>
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (input.name) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.trigger) updates.trigger_type = input.trigger;
    if (input.fromName !== undefined) updates.from_name = input.fromName;
    if (input.fromEmail !== undefined) updates.from_email = input.fromEmail;
    if (input.stopOnReply !== undefined) updates.stop_on_reply = input.stopOnReply;
    if (input.stopOnConversion !== undefined) updates.stop_on_conversion = input.stopOnConversion;

    const { data: sequence, error } = await supabase
      .from('nurture_sequences')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/growth/leads/sequences');
    revalidatePath(`/dashboard/growth/leads/sequences/${id}`);
    return { success: true, data: sequence };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteNurtureSequence(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // First delete associated emails
    await supabase
      .from('nurture_emails')
      .delete()
      .eq('sequence_id', id);

    // Then delete the sequence
    const { error } = await supabase
      .from('nurture_sequences')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/growth/leads/sequences');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function toggleNurtureSequence(
  id: string,
  status: 'active' | 'paused' | 'draft'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('nurture_sequences')
      .update({ status })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/growth/leads/sequences');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'An unexpected error occurred' };
  }
}
