import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Package, ExternalLink, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getProducts } from '@/lib/actions/products';
import { formatDate } from '@/lib/utils';
import { DeleteProductButton } from './delete-product-button';
import { ToggleProductActiveButton } from './toggle-product-active-button';

function ProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your products and their details</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function ProductsList() {
  const result = await getProducts();

  if (!result.success || !result.data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-destructive">Error loading products: {result.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const products = result.data;

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No products yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first product to get started with your marketing campaigns
            </p>
            <Link href="/dashboard/products/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      product.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {product.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {product.description && (
                  <CardDescription className="mt-2">{product.description}</CardDescription>
                )}
                {product.website_url && (
                  <a
                    href={product.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {product.website_url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/products/${product.id}`}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
                <ToggleProductActiveButton
                  productId={product.id}
                  currentActive={product.active}
                />
                <DeleteProductButton productId={product.id} productName={product.name} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="font-medium text-muted-foreground">Slug</p>
                <p className="mt-1 font-mono">{product.slug}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Created</p>
                <p className="mt-1">{formatDate(product.created_at)}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Last Updated</p>
                <p className="mt-1">{formatDate(product.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your products and their details</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </Link>
      </div>

      <Suspense fallback={<ProductsLoading />}>
        <ProductsList />
      </Suspense>
    </div>
  );
}
