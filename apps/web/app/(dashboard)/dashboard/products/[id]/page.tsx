import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getProduct } from '@/lib/actions/products';
import { ProductForm } from '../product-form';

interface ProductEditPageProps {
  params: {
    id: string;
  };
}

function ProductEditLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update product information</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading product...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function ProductEditContent({ id }: { id: string }) {
  const result = await getProduct(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const product = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Update {product.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Update your product information. Changes will be reflected in all future campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm product={product} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>
            Additional product configuration (coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Positioning</h4>
              <p className="text-sm text-muted-foreground">
                Define your product's unique value proposition and market positioning. This will
                help the AI generate more targeted marketing content.
              </p>
              <div className="mt-2 rounded-md border p-4">
                <p className="text-sm text-muted-foreground italic">
                  Positioning editor coming soon
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Brand Guidelines</h4>
              <p className="text-sm text-muted-foreground">
                Set brand voice, tone, and style guidelines for consistent messaging across all
                marketing materials.
              </p>
              <div className="mt-2 rounded-md border p-4">
                <p className="text-sm text-muted-foreground italic">
                  Brand guidelines editor coming soon
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Verified Claims</h4>
              <p className="text-sm text-muted-foreground">
                Add verified facts, statistics, and claims that can be safely used in marketing
                content.
              </p>
              <div className="mt-2 rounded-md border p-4">
                <p className="text-sm text-muted-foreground italic">
                  Verified claims editor coming soon
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  return (
    <Suspense fallback={<ProductEditLoading />}>
      <ProductEditContent id={params.id} />
    </Suspense>
  );
}
