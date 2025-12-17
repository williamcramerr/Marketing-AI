'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Video,
  CheckSquare,
  Wrench,
  Upload,
} from 'lucide-react';
import { createLeadMagnet } from '@/lib/actions/lead-magnets';

const magnetTypes = [
  { id: 'pdf', name: 'PDF Guide', icon: FileText, description: 'Ebook, whitepaper, or guide' },
  { id: 'template', name: 'Template', icon: FileText, description: 'Spreadsheet, document, or design' },
  { id: 'checklist', name: 'Checklist', icon: CheckSquare, description: 'Step-by-step checklist' },
  { id: 'tool', name: 'Free Tool', icon: Wrench, description: 'Calculator, generator, or mini-app' },
  { id: 'video', name: 'Video Course', icon: Video, description: 'Video tutorial or webinar' },
];

const landingTemplates = [
  { id: 'standard', name: 'Standard', description: 'Hero + benefits + form + testimonial' },
  { id: 'minimal', name: 'Minimal', description: 'Simple headline with form' },
  { id: 'video', name: 'Video', description: 'Video embed with form below' },
  { id: 'checklist', name: 'Checklist Preview', description: 'Show checklist items to entice' },
];

export default function NewLeadMagnetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [magnetType, setMagnetType] = useState('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [template, setTemplate] = useState('standard');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [ctaText, setCtaText] = useState('Download Free');

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createLeadMagnet({
        title,
        slug,
        description,
        magnetType: magnetType as any,
        fileUrl: fileUrl || undefined,
        externalUrl: externalUrl || undefined,
        landingPageTemplate: template,
        landingPageConfig: {
          headline: headline || title,
          subheadline,
          cta_text: ctaText,
        },
      });

      if (result.success) {
        router.push('/dashboard/growth/leads/magnets');
      } else {
        setError(result.error || 'Failed to create lead magnet');
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
          <Link href="/dashboard/growth/leads/magnets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Magnets
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">New Lead Magnet</h1>
        <p className="text-muted-foreground">
          Create valuable content to capture email addresses
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Describe your lead magnet and choose its type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., The Ultimate Guide to Marketing Automation"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/lp/</span>
                <Input
                  id="slug"
                  placeholder="marketing-automation-guide"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A brief description of what they'll get..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {magnetTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setMagnetType(type.id)}
                      className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                        magnetType === type.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Delivery</CardTitle>
            <CardDescription>
              How will users receive the lead magnet?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fileUrl">File URL (for downloads)</Label>
              <div className="flex gap-2">
                <Input
                  id="fileUrl"
                  placeholder="https://storage.example.com/guide.pdf"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                />
                <Button type="button" variant="outline" disabled>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Upload your file or paste a direct download URL
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalUrl">External Link (for tools/videos)</Label>
              <Input
                id="externalUrl"
                placeholder="https://app.example.com/free-tool"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Redirect to an external page after signup
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Landing Page</CardTitle>
            <CardDescription>
              Customize the landing page where visitors will sign up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {landingTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div>
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-muted-foreground">- {t.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                placeholder={title || 'Your compelling headline'}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subheadline">Subheadline</Label>
              <Input
                id="subheadline"
                placeholder="Describe the value they'll get..."
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">Call-to-Action Button Text</Label>
              <Input
                id="ctaText"
                placeholder="Download Free"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
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
            <Link href="/dashboard/growth/leads/magnets">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || !title || !slug}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Lead Magnet
          </Button>
        </div>
      </form>
    </div>
  );
}
