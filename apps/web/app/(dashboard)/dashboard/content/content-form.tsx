'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createContentAsset,
  updateContentAsset,
  type ContentAsset,
} from '@/lib/actions/content-assets';
import { getAssetTypeDisplayName, type AssetType } from '@/lib/utils/content-utils';
import { toast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
}

interface ContentFormProps {
  asset?: ContentAsset;
  products: Product[];
}

const assetTypes: AssetType[] = [
  'blog_post',
  'landing_page',
  'email_template',
  'social_post',
  'image',
  'document',
];

export function ContentForm({ asset, products }: ContentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    product_id: asset?.product_id || '',
    type: asset?.type || ('blog_post' as AssetType),
    title: asset?.title || '',
    content: asset?.content || '',
    external_url: asset?.external_url || '',
    metadata: asset?.metadata || {},
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.product_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a product',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a title',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let result;

      if (asset) {
        result = await updateContentAsset(asset.id, {
          title: formData.title,
          content: formData.content || undefined,
          external_url: formData.external_url || undefined,
          metadata: formData.metadata,
        });
      } else {
        result = await createContentAsset({
          product_id: formData.product_id,
          type: formData.type,
          title: formData.title,
          content: formData.content || undefined,
          external_url: formData.external_url || undefined,
          metadata: formData.metadata,
        });
      }

      if (result.success) {
        toast({
          title: asset ? 'Content Updated' : 'Content Created',
          description: asset
            ? 'Your content has been updated.'
            : 'Your new content has been created.',
        });
        router.push('/dashboard/content');
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save content',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Set the basic details for your content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, product_id: value }))
                }
                disabled={!!asset}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Content Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, type: value as AssetType }))
                }
                disabled={!!asset}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {assetTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getAssetTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter content title"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            Enter the content body or link to external content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content Body</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Enter your content here..."
              className="min-h-[300px] font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Supports plain text or HTML. For rich formatting, consider using markdown.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="external_url">External URL (Optional)</Label>
            <Input
              id="external_url"
              type="url"
              value={formData.external_url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, external_url: e.target.value }))
              }
              placeholder="https://example.com/content"
            />
            <p className="text-xs text-muted-foreground">
              Link to external content if hosted elsewhere
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metadata based on type */}
      {formData.type === 'blog_post' && (
        <Card>
          <CardHeader>
            <CardTitle>Blog Post Settings</CardTitle>
            <CardDescription>Additional settings for blog posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta_title">SEO Title</Label>
                <Input
                  id="meta_title"
                  value={formData.metadata.meta_title || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, meta_title: e.target.value },
                    }))
                  }
                  placeholder="SEO optimized title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.metadata.slug || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, slug: e.target.value },
                    }))
                  }
                  placeholder="url-friendly-slug"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta Description</Label>
              <Textarea
                id="meta_description"
                value={formData.metadata.meta_description || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, meta_description: e.target.value },
                  }))
                }
                placeholder="Brief description for search engines"
                className="h-20"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {formData.type === 'email_template' && (
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>Settings specific to email templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject_line">Subject Line</Label>
              <Input
                id="subject_line"
                value={formData.metadata.subject_line || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, subject_line: e.target.value },
                  }))
                }
                placeholder="Email subject line"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preview_text">Preview Text</Label>
              <Input
                id="preview_text"
                value={formData.metadata.preview_text || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, preview_text: e.target.value },
                  }))
                }
                placeholder="Text shown in email preview"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {formData.type === 'social_post' && (
        <Card>
          <CardHeader>
            <CardTitle>Social Media Settings</CardTitle>
            <CardDescription>Settings for social media posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Target Platform</Label>
              <Select
                value={formData.metadata.platform || ''}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, platform: value },
                  }))
                }
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Input
                id="hashtags"
                value={formData.metadata.hashtags || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, hashtags: e.target.value },
                  }))
                }
                placeholder="#marketing #growth"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/content')}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : asset ? 'Update Content' : 'Create Content'}
        </Button>
      </div>
    </form>
  );
}
