import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm } from '../policy-form';
import { createClient } from '@/lib/supabase/server';

async function getProducts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

export default async function NewPolicyPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Policy</h1>
        <p className="text-muted-foreground">
          Define content and execution rules to ensure compliance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Configuration</CardTitle>
          <CardDescription>
            Create a new policy to validate content before publishing. Policies can block prohibited content,
            enforce required phrases, limit execution rates, and more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyForm products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
