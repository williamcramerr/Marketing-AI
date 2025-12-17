import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentForm } from '../content-form';
import { createClient } from '@/lib/supabase/server';

async function getProducts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return [];

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('organization_id', membership.organization_id)
    .eq('active', true)
    .order('name');

  return products || [];
}

export default async function NewContentPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Content</h1>
        <p className="text-muted-foreground">
          Add a new content asset to your library
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Products Available</CardTitle>
            <CardDescription>
              You need to create at least one product before you can create content assets.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ContentForm products={products} />
      )}
    </div>
  );
}
