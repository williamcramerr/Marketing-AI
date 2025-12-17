import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm } from '../product-form';

function NewProductLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Product</h1>
        <p className="text-muted-foreground">Add a new product to your organization</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading form...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Product</h1>
        <p className="text-muted-foreground">Add a new product to your organization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Provide basic information about your product. This will be used to generate marketing
            content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<NewProductLoading />}>
            <ProductForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
