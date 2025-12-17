'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Search,
} from 'lucide-react';
import { createContentBrief } from '@/lib/actions/content-briefs';

const contentTypes = [
  { id: 'blog_post', name: 'Blog Post', description: 'Standard blog article' },
  { id: 'pillar_page', name: 'Pillar Page', description: 'Comprehensive guide on a topic' },
  { id: 'how_to_guide', name: 'How-To Guide', description: 'Step-by-step tutorial' },
  { id: 'listicle', name: 'Listicle', description: 'List-based article' },
  { id: 'comparison', name: 'Comparison', description: 'Compare options/products' },
  { id: 'case_study', name: 'Case Study', description: 'Success story with data' },
];

const toneOptions = [
  { id: 'professional', name: 'Professional' },
  { id: 'conversational', name: 'Conversational' },
  { id: 'educational', name: 'Educational' },
  { id: 'persuasive', name: 'Persuasive' },
  { id: 'friendly', name: 'Friendly' },
];

export default function NewBriefPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keywordId = searchParams.get('keyword');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [contentType, setContentType] = useState('blog_post');
  const [targetWordCount, setTargetWordCount] = useState('1500');
  const [tone, setTone] = useState('professional');
  const [metaDescription, setMetaDescription] = useState('');
  const [outline, setOutline] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [includeStats, setIncludeStats] = useState(true);
  const [includeExamples, setIncludeExamples] = useState(true);

  const generateOutline = async () => {
    if (!targetKeyword) return;

    setGenerating(true);
    // Simulate AI generation - in real app, call API
    await new Promise(resolve => setTimeout(resolve, 1500));

    const generatedOutline = `## Introduction
- Hook the reader with a compelling statistic or question
- Introduce the topic: ${targetKeyword}
- Preview what the article will cover

## What is ${targetKeyword}?
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

    setOutline(generatedOutline);
    setGenerating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createContentBrief({
        title,
        targetKeyword,
        secondaryKeywords: secondaryKeywords.split(',').map(k => k.trim()).filter(Boolean),
        contentType,
        targetWordCount: parseInt(targetWordCount),
        tone,
        metaDescription,
        outline,
        keyPoints: keyPoints.split('\n').filter(Boolean),
        callToAction,
        includeStats,
        includeExamples,
        keywordId: keywordId || undefined,
      });

      if (result.success) {
        router.push('/dashboard/growth/seo/briefs');
      } else {
        setError(result.error || 'Failed to create brief');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/seo/briefs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Briefs
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">New Content Brief</h1>
        <p className="text-muted-foreground">
          Create a structured brief for SEO-optimized content
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Define the content topic and target keywords
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Content Title</Label>
              <Input
                id="title"
                placeholder="e.g., The Ultimate Guide to Marketing Automation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetKeyword">Target Keyword</Label>
                <div className="flex gap-2">
                  <Input
                    id="targetKeyword"
                    placeholder="e.g., marketing automation"
                    value={targetKeyword}
                    onChange={(e) => setTargetKeyword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryKeywords">Secondary Keywords</Label>
                <Input
                  id="secondaryKeywords"
                  placeholder="keyword1, keyword2, keyword3"
                  value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Comma-separated list</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wordCount">Target Word Count</Label>
                <Input
                  id="wordCount"
                  type="number"
                  min="500"
                  max="10000"
                  step="100"
                  value={targetWordCount}
                  onChange={(e) => setTargetWordCount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO Settings</CardTitle>
            <CardDescription>
              Optimize for search engines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                placeholder="Write a compelling meta description (150-160 characters)..."
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {metaDescription.length}/160 characters
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Content Outline</CardTitle>
                <CardDescription>
                  Structure your content with headings and key sections
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateOutline}
                disabled={generating || !targetKeyword}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outline">Outline (Markdown supported)</Label>
              <Textarea
                id="outline"
                placeholder="## Introduction
- Key point 1
- Key point 2

## Section 1
- Detail...

## Conclusion"
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyPoints">Key Points to Cover</Label>
              <Textarea
                id="keyPoints"
                placeholder="Enter key points (one per line)..."
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">Call to Action</Label>
              <Input
                id="cta"
                placeholder="What should readers do after reading?"
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Requirements</CardTitle>
            <CardDescription>
              Additional requirements for the content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Statistics</Label>
                <p className="text-xs text-muted-foreground">
                  Add relevant data and statistics to support claims
                </p>
              </div>
              <Switch
                checked={includeStats}
                onCheckedChange={setIncludeStats}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Examples</Label>
                <p className="text-xs text-muted-foreground">
                  Add real-world examples and case studies
                </p>
              </div>
              <Switch
                checked={includeExamples}
                onCheckedChange={setIncludeExamples}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/growth/seo/briefs">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || !title || !targetKeyword}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Brief
          </Button>
        </div>
      </form>
    </div>
  );
}
