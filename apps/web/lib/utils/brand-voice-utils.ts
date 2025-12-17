import type { BrandVoiceProfile } from '@/lib/actions/brand-voice';

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
