import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PolicyForm } from '../policy-form';
import { getPolicy } from '@/lib/actions/policies';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function EditPolicyPage({ params }: PageProps) {
  const { id } = await params;
  const [policyResult, products] = await Promise.all([
    getPolicy(id),
    getProducts(),
  ]);

  if (!policyResult.success || !policyResult.data) {
    notFound();
  }

  const policy = policyResult.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Policy</h1>
        <p className="text-muted-foreground">
          Modify policy settings and rules
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{policy.name}</CardTitle>
          <CardDescription>
            {policy.description || 'Update the configuration for this policy.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PolicyForm policy={policy} products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
