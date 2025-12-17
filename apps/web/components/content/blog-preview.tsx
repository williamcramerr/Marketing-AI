'use client';

import { useState, useMemo } from 'react';
import { Monitor, Smartphone, Globe, Search, Clock, User } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface BlogPreviewProps {
  title: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  publishDate?: string;
  readingTime?: number;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    slug?: string;
    keywords?: string[];
  };
}

type ViewMode = 'desktop' | 'mobile';

/**
 * Sanitizes HTML content using DOMPurify to prevent XSS attacks.
 * Only allows safe HTML tags and attributes for blog content rendering.
 */
function sanitizeHtmlContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
      'td', 'th', 'thead', 'tr', 'u', 'ul', 'hr', 'blockquote', 'pre',
      'code', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'style', 'class', 'width', 'height',
      'target', 'rel',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

export function BlogPreview({
  title,
  content,
  excerpt,
  featuredImage,
  author = { name: 'Marketing Pilot' },
  publishDate = new Date().toISOString(),
  readingTime,
  seo,
}: BlogPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [activeTab, setActiveTab] = useState<'preview' | 'seo'>('preview');

  // SECURITY: Content is sanitized with DOMPurify before rendering
  const sanitizedContent = useMemo(() => sanitizeHtmlContent(content), [content]);

  // Calculate reading time if not provided
  const estimatedReadingTime = useMemo(() => {
    if (readingTime) return readingTime;
    const plainText = content.replace(/<[^>]*>/g, '');
    const wordCount = plainText.split(/\s+/).length;
    return Math.ceil(wordCount / 200);
  }, [content, readingTime]);

  const formattedDate = new Date(publishDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const seoScore = useMemo(() => {
    let score = 0;
    const checks: { name: string; passed: boolean; suggestion: string }[] = [];

    // Title check
    const titleLength = (seo?.metaTitle || title).length;
    const titlePassed = titleLength >= 30 && titleLength <= 60;
    checks.push({
      name: 'Title length',
      passed: titlePassed,
      suggestion: titlePassed
        ? `Good length (${titleLength} chars)`
        : `Should be 30-60 chars (currently ${titleLength})`,
    });
    if (titlePassed) score += 25;

    // Meta description check
    const descLength = (seo?.metaDescription || excerpt || '').length;
    const descPassed = descLength >= 120 && descLength <= 160;
    checks.push({
      name: 'Meta description',
      passed: descPassed,
      suggestion: descPassed
        ? `Good length (${descLength} chars)`
        : descLength === 0
          ? 'Missing meta description'
          : `Should be 120-160 chars (currently ${descLength})`,
    });
    if (descPassed) score += 25;

    // Keywords check
    const hasKeywords = (seo?.keywords?.length || 0) > 0;
    checks.push({
      name: 'Keywords',
      passed: hasKeywords,
      suggestion: hasKeywords
        ? `${seo?.keywords?.length} keywords defined`
        : 'Add focus keywords',
    });
    if (hasKeywords) score += 25;

    // Content length check
    const plainText = content.replace(/<[^>]*>/g, '');
    const wordCount = plainText.split(/\s+/).length;
    const contentPassed = wordCount >= 300;
    checks.push({
      name: 'Content length',
      passed: contentPassed,
      suggestion: contentPassed
        ? `Good length (${wordCount} words)`
        : `Should be at least 300 words (currently ${wordCount})`,
    });
    if (contentPassed) score += 25;

    return { score, checks };
  }, [title, content, excerpt, seo]);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'seo')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-2 rounded-lg border p-1">
              <Button
                variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Blog Preview */}
        <TabsContent value="preview" className="mt-4">
          <div
            className={cn(
              'mx-auto overflow-hidden rounded-lg border bg-white shadow-lg transition-all dark:bg-gray-900',
              viewMode === 'desktop' ? 'w-full max-w-4xl' : 'w-full max-w-sm'
            )}
          >
            {/* Featured Image */}
            {featuredImage && (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={featuredImage}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Article Content */}
            <article className="p-6 md:p-8">
              {/* Title */}
              <h1 className="mb-4 text-2xl font-bold md:text-3xl lg:text-4xl">{title}</h1>

              {/* Meta */}
              <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {author.avatar ? (
                      <img src={author.avatar} alt={author.name} className="h-8 w-8 rounded-full" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <span>{author.name}</span>
                </div>
                <span>{formattedDate}</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{estimatedReadingTime} min read</span>
                </div>
              </div>

              {/* Excerpt */}
              {excerpt && (
                <p className="mb-6 text-lg text-muted-foreground italic">{excerpt}</p>
              )}

              {/* Content - SECURITY: sanitizedContent is sanitized via DOMPurify.sanitize() above */}
              <div
                className="prose prose-gray max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </article>
          </div>
        </TabsContent>

        {/* SEO Analysis */}
        <TabsContent value="seo" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Search Engine Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4" />
                  Search Engine Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-white p-4 dark:bg-gray-900">
                  <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                    <Globe className="h-3 w-3" />
                    <span>yoursite.com</span>
                    <span>&gt;</span>
                    <span>blog</span>
                    <span>&gt;</span>
                    <span className="truncate">{seo?.slug || 'article-slug'}</span>
                  </div>
                  <h3 className="mt-1 text-lg text-blue-600 hover:underline dark:text-blue-400">
                    {seo?.metaTitle || title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {seo?.metaDescription || excerpt || 'No meta description provided.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SEO Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>SEO Score</span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-medium',
                      seoScore.score >= 75
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : seoScore.score >= 50
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    )}
                  >
                    {seoScore.score}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {seoScore.checks.map((check) => (
                    <div key={check.name} className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-xs',
                          check.passed
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        )}
                      >
                        {check.passed ? '✓' : '!'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{check.name}</p>
                        <p className="text-xs text-muted-foreground">{check.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Keywords */}
            {seo?.keywords && seo.keywords.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Focus Keywords</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {seo.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
