'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, X, Twitter, Globe, Linkedin } from 'lucide-react';
import { createListeningConfig } from '@/lib/actions/social-listening';

const platforms = [
  { id: 'twitter', name: 'Twitter/X', icon: Twitter },
  { id: 'reddit', name: 'Reddit', icon: Globe },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
];

export default function NewListeningConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
  const [negativeInput, setNegativeInput] = useState('');
  const [intentThreshold, setIntentThreshold] = useState('medium');
  const [autoRespond, setAutoRespond] = useState(false);
  const [responseTemplate, setResponseTemplate] = useState('');

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const addNegativeKeyword = () => {
    if (negativeInput.trim() && !negativeKeywords.includes(negativeInput.trim())) {
      setNegativeKeywords([...negativeKeywords, negativeInput.trim()]);
      setNegativeInput('');
    }
  };

  const removeNegativeKeyword = (keyword: string) => {
    setNegativeKeywords(negativeKeywords.filter(k => k !== keyword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createListeningConfig({
        name,
        platforms: selectedPlatforms,
        keywords,
        negativeKeywords: negativeKeywords.length > 0 ? negativeKeywords : undefined,
        intentThreshold: intentThreshold as 'low' | 'medium' | 'high',
        autoRespond,
        responseTemplate: responseTemplate || undefined,
      });

      if (result.success) {
        router.push('/dashboard/growth/listening/configs');
      } else {
        setError(result.error || 'Failed to create configuration');
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
          <Link href="/dashboard/growth/listening/configs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Configs
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">New Listening Configuration</h1>
        <p className="text-muted-foreground">
          Set up monitoring for specific keywords across social platforms
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Settings</CardTitle>
            <CardDescription>
              Name your configuration and select which platforms to monitor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Configuration Name</Label>
              <Input
                id="name"
                placeholder="e.g., Product Feedback Monitoring"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Platforms to Monitor</Label>
              <div className="flex flex-wrap gap-2">
                {platforms.map((platform) => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <Button
                      key={platform.id}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => togglePlatform(platform.id)}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {platform.name}
                    </Button>
                  );
                })}
              </div>
              {selectedPlatforms.length === 0 && (
                <p className="text-sm text-destructive">Select at least one platform</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keywords</CardTitle>
            <CardDescription>
              Enter the keywords you want to monitor. Use phrases that people might use when looking for solutions like yours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Keywords to Monitor</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a keyword..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {keywords.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add keywords like &quot;looking for recommendations&quot;, &quot;anyone know a good&quot;, your product name, etc.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Negative Keywords (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Exclude mentions containing..."
                  value={negativeInput}
                  onChange={(e) => setNegativeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNegativeKeyword())}
                />
                <Button type="button" variant="outline" onClick={addNegativeKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {negativeKeywords.map((keyword) => (
                  <Badge key={keyword} variant="destructive" className="gap-1">
                    -{keyword}
                    <button
                      type="button"
                      onClick={() => removeNegativeKeyword(keyword)}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filtering & Response</CardTitle>
            <CardDescription>
              Configure how conversations are filtered and whether to auto-respond
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intent">Minimum Intent Level</Label>
              <Select value={intentThreshold} onValueChange={setIntentThreshold}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (show all matches)</SelectItem>
                  <SelectItem value="medium">Medium (moderate intent)</SelectItem>
                  <SelectItem value="high">High (only high-intent)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Higher threshold means fewer but more relevant matches
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-respond">Auto-Respond</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate and send responses (requires approval for first few)
                </p>
              </div>
              <Switch
                id="auto-respond"
                checked={autoRespond}
                onCheckedChange={setAutoRespond}
              />
            </div>

            {autoRespond && (
              <div className="space-y-2">
                <Label htmlFor="template">Response Template (optional)</Label>
                <Textarea
                  id="template"
                  placeholder="Guidelines for AI-generated responses. E.g., 'Keep responses helpful and non-promotional. Mention our free tier when relevant.'"
                  value={responseTemplate}
                  onChange={(e) => setResponseTemplate(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/growth/listening/configs">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={loading || selectedPlatforms.length === 0 || keywords.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
