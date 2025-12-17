import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ConnectorForm } from '../connector-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditConnectorPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user!.id)
    .limit(1)
    .single();

  if (!membership) {
    notFound();
  }

  const { data: connector } = await supabase
    .from('connectors')
    .select('*')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (!connector) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Connector</h1>
        <p className="text-muted-foreground">Update the configuration for {connector.name}</p>
      </div>

      <ConnectorForm connector={connector} />
    </div>
  );
}
