import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentForm } from '../content-form';
import { getContentAsset } from '@/lib/actions/content-assets';
import { getAssetTypeDisplayName } from '@/lib/utils/content-utils';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function EditContentPage({ params }: PageProps) {
  const { id } = await params;
  const [assetResult, products] = await Promise.all([getContentAsset(id), getProducts()]);

  if (!assetResult.success || !assetResult.data) {
    notFound();
  }

  const asset = assetResult.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Content</h1>
          <p className="text-muted-foreground">
            Modify your content asset
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{getAssetTypeDisplayName(asset.type)}</Badge>
          <Badge variant="outline">v{asset.version}</Badge>
          {asset.published ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="draft">Draft</Badge>
          )}
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Product</div>
              <div className="font-medium">{asset.product?.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium">
                {new Date(asset.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="font-medium">
                {new Date(asset.updated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
            {asset.published_at && (
              <div>
                <div className="text-sm text-muted-foreground">Published At</div>
                <div className="font-medium">
                  {new Date(asset.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ContentForm asset={asset} products={products} />
    </div>
  );
}
