import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Code,
  Globe,
  CheckCircle,
  Clock,
  Copy,
} from 'lucide-react';
import { CopyScriptButton } from './copy-script-button';
import { DeleteScriptButton } from './delete-script-button';

export default async function TrackingSetupPage() {
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
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">No Organization Found</h1>
        <p className="text-muted-foreground">Please create an organization first.</p>
      </div>
    );
  }

  // Fetch tracking scripts
  const { data: scripts } = await supabase
    .from('tracking_scripts')
    .select('*')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/visitors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Visitors
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tracking Setup</h1>
          <p className="text-muted-foreground">
            Install tracking scripts on your website to identify company visitors
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/visitors/tracking/new">
            <Plus className="mr-2 h-4 w-4" />
            New Tracking Script
          </Link>
        </Button>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How Visitor Identification Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                1
              </div>
              <div>
                <p className="font-medium">Add the tracking script</p>
                <p className="text-sm text-muted-foreground">
                  Install our lightweight script on your website
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                2
              </div>
              <div>
                <p className="font-medium">We identify companies</p>
                <p className="text-sm text-muted-foreground">
                  Using IP-to-company mapping and enrichment data
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                3
              </div>
              <div>
                <p className="font-medium">Get alerts on hot leads</p>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when high-fit visitors arrive
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracking Scripts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <div>
              <CardTitle>Tracking Scripts</CardTitle>
              <CardDescription>
                Each script is tied to a specific domain
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scripts && scripts.length > 0 ? (
            <div className="space-y-4">
              {scripts.map((script) => {
                const scriptCode = `<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/tracker.js" data-key="${script.script_key}" async></script>`;

                return (
                  <div
                    key={script.id}
                    className="rounded-lg border p-4 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{script.name}</h3>
                          {script.active ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Globe className="h-3.5 w-3.5" />
                          {script.domain}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {script.last_seen_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            Last ping: {new Date(script.last_seen_at).toLocaleDateString()}
                          </div>
                        )}
                        <DeleteScriptButton scriptId={script.id} name={script.name} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Installation Code</p>
                      <div className="relative">
                        <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                          {scriptCode}
                        </pre>
                        <CopyScriptButton script={scriptCode} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Add this code before the closing &lt;/head&gt; tag on your website
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Code className="h-8 w-8 opacity-50" />
              <p>No tracking scripts configured</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/visitors/tracking/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Script
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Info */}
      <Card>
        <CardHeader>
          <CardTitle>Data Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Clearbit Reveal</p>
              <p className="text-sm text-muted-foreground">
                Enterprise-grade IP-to-company identification
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/connectors">
                Configure API Key
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
