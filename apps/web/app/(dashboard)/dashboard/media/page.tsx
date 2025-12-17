import { createClient } from '@/lib/supabase/server';
import { getMediaAssets, getCollections } from '@/lib/actions/media';
import { MediaLibraryClient } from './media-library-client';

export default async function MediaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', user!.id);

  const organizationId = memberships?.[0]?.organization_id;

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  const [{ assets: initialAssets, total: initialTotal }, collections] = await Promise.all([
    getMediaAssets(organizationId, { limit: 50 }),
    getCollections(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Media Library</h1>
        <p className="text-muted-foreground">
          Manage your images, videos, and other media assets
        </p>
      </div>

      <MediaLibraryClient
        organizationId={organizationId}
        initialAssets={initialAssets}
        initialTotal={initialTotal}
        collections={collections}
      />
    </div>
  );
}
