import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import {
  Plus,
  FileText,
  ArrowLeft,
  ArrowRight,
  Search,
  Target,
  CheckCircle,
  Clock,
  Edit,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  published: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default async function BriefsPage() {
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

  // Get products
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('organization_id', membership.organization_id);

  const productIds = products?.map(p => p.id) || [];

  // Fetch content briefs
  const { data: briefs } = await supabase
    .from('content_briefs')
    .select(`
      *,
      keyword_research (keyword, search_volume)
    `)
    .in('product_id', productIds.length > 0 ? productIds : ['none'])
    .order('created_at', { ascending: false });

  // Calculate stats
  const totalBriefs = briefs?.length || 0;
  const draftBriefs = briefs?.filter(b => b.status === 'draft').length || 0;
  const inProgressBriefs = briefs?.filter(b => b.status === 'in_progress').length || 0;
  const completedBriefs = briefs?.filter(b => b.status === 'completed' || b.status === 'published').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth/seo">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to SEO
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Briefs</h1>
          <p className="text-muted-foreground">
            Create AI-powered briefs for SEO-optimized content
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/seo/briefs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Brief
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Briefs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBriefs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftBriefs}</div>
            <p className="text-xs text-muted-foreground">awaiting work</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressBriefs}</div>
            <p className="text-xs text-muted-foreground">being written</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedBriefs}</div>
            <p className="text-xs text-muted-foreground">ready to publish</p>
          </CardContent>
        </Card>
      </div>

      {/* Briefs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>All Content Briefs</CardTitle>
              <CardDescription>
                Manage your SEO content briefs and track progress
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {briefs && briefs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target Keyword</TableHead>
                  <TableHead>Word Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {briefs.map((brief) => (
                  <TableRow key={brief.id}>
                    <TableCell>
                      <div className="font-medium">{brief.title}</div>
                      {brief.meta_description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {brief.meta_description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {brief.keyword_research ? (
                        <div>
                          <div className="font-medium">{brief.keyword_research.keyword}</div>
                          <div className="text-xs text-muted-foreground">
                            {brief.keyword_research.search_volume?.toLocaleString() || 0} vol
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        {brief.target_word_count?.toLocaleString() || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[brief.status] || statusColors.draft}>
                        {brief.status || 'draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(brief.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/growth/seo/briefs/${brief.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/growth/seo/briefs/${brief.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-50" />
              <p>No content briefs yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/seo/briefs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Brief
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
