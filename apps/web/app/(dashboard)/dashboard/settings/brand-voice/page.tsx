import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getOrganizationVoiceProfiles } from '@/lib/actions/brand-voice';
import { getProducts } from '@/lib/actions/products';
import { BrandVoiceClient } from './brand-voice-client';

export default async function BrandVoicePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [profilesResult, productsResult] = await Promise.all([
    getOrganizationVoiceProfiles(),
    getProducts(),
  ]);

  const profiles = profilesResult.profiles || [];
  const products = productsResult.success ? productsResult.data || [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Voice</h1>
        <p className="text-muted-foreground">
          Configure how your AI-generated content sounds and feels
        </p>
      </div>

      <BrandVoiceClient
        profiles={profiles as any[]}
        products={products as any[]}
      />
    </div>
  );
}
