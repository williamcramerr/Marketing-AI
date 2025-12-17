'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProduct, updateProduct, type ProductFormData } from '@/lib/actions/products';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/lib/supabase/types';
import Link from 'next/link';

interface ProductFormProps {
  product?: Tables<'products'>;
}

export function ProductForm({ product }: ProductFormProps) {
  const isEditing = !!product;
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    name: product?.name || '',
    slug: product?.slug || '',
    description: product?.description || '',
    website_url: product?.website_url || '',
    active: product?.active ?? true,
  });

  function handleChange(field: keyof ProductFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const result = isEditing
      ? await updateProduct(product.id, formData)
      : await createProduct(formData);

    if (result.success) {
      toast({
        title: isEditing ? 'Product updated' : 'Product created',
        description: `${formData.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      router.push('/dashboard/products');
      router.refresh();
    } else {
      toast({
        title: 'Error',
        description: result.error || `Failed to ${isEditing ? 'update' : 'create'} product`,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Product Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Acme Analytics Platform"
            required
          />
          <p className="text-xs text-muted-foreground">
            The name of your product or service
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="auto-generated from name"
          />
          <p className="text-xs text-muted-foreground">
            URL-friendly identifier (leave blank to auto-generate)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe your product..."
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            A brief description of what your product does
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website_url">Website URL</Label>
          <Input
            id="website_url"
            type="url"
            value={formData.website_url}
            onChange={(e) => handleChange('website_url', e.target.value)}
            placeholder="https://example.com"
          />
          <p className="text-xs text-muted-foreground">
            Your product's website or landing page
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="active"
            type="checkbox"
            checked={formData.active}
            onChange={(e) => handleChange('active', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="active" className="cursor-pointer font-normal">
            Active
          </Label>
          <p className="text-xs text-muted-foreground">
            (Inactive products won't be available for campaigns)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t pt-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Update Product' : 'Create Product'}
        </Button>
        <Link href="/dashboard/products">
          <Button type="button" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
