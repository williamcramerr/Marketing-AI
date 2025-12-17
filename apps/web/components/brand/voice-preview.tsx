'use client';

import { useState } from 'react';
import { RefreshCw, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ToneSettings } from '@/lib/actions/brand-voice';

interface VoicePreviewProps {
  toneSettings: ToneSettings;
  writingStyle: string;
  dos: string[];
  donts: string[];
  vocabularyPreferences?: string[];
  wordsToAvoid?: string[];
}

// Sample content based on tone settings
function generateSampleContent(
  toneSettings: ToneSettings,
  writingStyle: string,
  dos: string[],
  donts: string[]
): string {
  const { formality, friendliness, humor, confidence, enthusiasm } = toneSettings;

  // Base greeting
  let greeting = '';
  if (friendliness > 70) {
    greeting = humor > 50 ? 'Hey there! 👋' : 'Hello friend!';
  } else if (formality > 70) {
    greeting = 'Dear valued customer,';
  } else {
    greeting = 'Hi there,';
  }

  // Introduction
  let intro = '';
  if (confidence > 70) {
    intro = "We're thrilled to share something incredible with you.";
  } else if (enthusiasm > 70) {
    intro = "We've got exciting news that we just can't wait to share!";
  } else {
    intro = 'We have something new to share with you.';
  }

  // Body content based on writing style
  let body = '';
  switch (writingStyle) {
    case 'conversational':
      body = formality < 50
        ? "You know how sometimes things just click? That's exactly what happened here."
        : 'We believe you will find this development noteworthy.';
      break;
    case 'technical':
      body = 'Our latest update includes performance optimizations and enhanced functionality.';
      break;
    case 'storytelling':
      body = 'Picture this: a solution that adapts to your needs, growing alongside your business.';
      break;
    case 'persuasive':
      body = confidence > 50
        ? "This is the opportunity you've been waiting for."
        : 'We think you might find this interesting.';
      break;
    default:
      body = 'We have updated our product with new features and improvements.';
  }

  // Call to action
  let cta = '';
  if (enthusiasm > 70) {
    cta = "Don't wait - dive in and see the difference for yourself!";
  } else if (friendliness > 70) {
    cta = "We'd love to hear what you think!";
  } else if (formality > 70) {
    cta = 'We welcome your feedback at your earliest convenience.';
  } else {
    cta = 'Let us know if you have any questions.';
  }

  // Closing
  let closing = '';
  if (friendliness > 70) {
    closing = humor > 50 ? 'Cheers! 🎉' : 'Warmly,';
  } else if (formality > 70) {
    closing = 'Best regards,';
  } else {
    closing = 'Thanks,';
  }

  return `${greeting}

${intro}

${body}

${cta}

${closing}
The Team`;
}

export function VoicePreview({
  toneSettings,
  writingStyle,
  dos,
  donts,
  vocabularyPreferences = [],
  wordsToAvoid = [],
}: VoicePreviewProps) {
  const [sampleContent, setSampleContent] = useState(() =>
    generateSampleContent(toneSettings, writingStyle, dos, donts)
  );
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const regenerate = () => {
    setSampleContent(generateSampleContent(toneSettings, writingStyle, dos, donts));
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(sampleContent);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Sample content copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate a "voice personality" summary
  const getVoicePersonality = (): string => {
    const traits: string[] = [];

    if (toneSettings.formality > 60) traits.push('Formal');
    else if (toneSettings.formality < 40) traits.push('Casual');

    if (toneSettings.friendliness > 60) traits.push('Warm');
    else if (toneSettings.friendliness < 40) traits.push('Professional');

    if (toneSettings.humor > 60) traits.push('Witty');
    if (toneSettings.confidence > 60) traits.push('Bold');
    if (toneSettings.enthusiasm > 60) traits.push('Energetic');

    return traits.length > 0 ? traits.join(' • ') : 'Balanced';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Voice Preview
            </CardTitle>
            <CardDescription>{getVoicePersonality()}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm">{sampleContent}</pre>
        </div>

        {/* Tone indicators */}
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div>
            <div className="mb-1 h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${toneSettings.formality}%` }} />
            <span className="text-muted-foreground">Formality</span>
          </div>
          <div>
            <div className="mb-1 h-2 rounded-full bg-gradient-to-r from-pink-400 to-pink-600" style={{ width: `${toneSettings.friendliness}%` }} />
            <span className="text-muted-foreground">Friendliness</span>
          </div>
          <div>
            <div className="mb-1 h-2 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600" style={{ width: `${toneSettings.humor}%` }} />
            <span className="text-muted-foreground">Humor</span>
          </div>
          <div>
            <div className="mb-1 h-2 rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style={{ width: `${toneSettings.confidence}%` }} />
            <span className="text-muted-foreground">Confidence</span>
          </div>
          <div>
            <div className="mb-1 h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${toneSettings.enthusiasm}%` }} />
            <span className="text-muted-foreground">Enthusiasm</span>
          </div>
        </div>

        {/* Writing style badge */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">Writing Style</span>
          <span className="text-sm font-medium capitalize">{writingStyle}</span>
        </div>

        {/* Guidelines summary */}
        {(dos.length > 0 || donts.length > 0) && (
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Guidelines Applied</p>
            <div className="flex flex-wrap gap-1">
              {dos.slice(0, 3).map((d, i) => (
                <span key={`do-${i}`} className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {d.slice(0, 20)}...
                </span>
              ))}
              {donts.slice(0, 3).map((d, i) => (
                <span key={`dont-${i}`} className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  ✗ {d.slice(0, 20)}...
                </span>
              ))}
              {(dos.length + donts.length) > 6 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{dos.length + donts.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
