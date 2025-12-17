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
  ArrowLeft,
  Search,
  Plus,
  ArrowRight,
  FileText,
  Target,
} from 'lucide-react';

const getDifficultyColor = (difficulty: number | null) => {
  if (!difficulty) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  if (difficulty <= 30) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (difficulty <= 60) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
};

const statusColors: Record<string, string> = {
  discovered: 'bg-gray-100 text-gray-800',
  selected: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
};

export default async function KeywordsPage() {
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

  // Fetch keywords
  const { data: keywords } = await supabase
    .from('keyword_research')
    .select('*')
    .in('product_id', productIds.length > 0 ? productIds : ['none'])
    .order('priority', { ascending: false });

  // Calculate stats
  const totalKeywords = keywords?.length || 0;
  const avgVolume = keywords?.length
    ? Math.round(keywords.reduce((sum, k) => sum + (k.search_volume || 0), 0) / keywords.length)
    : 0;
  const avgDifficulty = keywords?.length
    ? Math.round(keywords.reduce((sum, k) => sum + (k.keyword_difficulty || 0), 0) / keywords.length)
    : 0;
  const withContent = keywords?.filter(k => k.status === 'completed').length || 0;

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
          <h1 className="text-3xl font-bold">Keyword Research</h1>
          <p className="text-muted-foreground">
            Track and prioritize keywords for your content strategy
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/growth/seo/keywords/discover">
            <Search className="mr-2 h-4 w-4" />
            Discover Keywords
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKeywords}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVolume.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDifficulty}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              With Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{withContent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Keywords Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <div>
              <CardTitle>All Keywords</CardTitle>
              <CardDescription>
                Click on a keyword to view details and create content
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {keywords && keywords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>CPC</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell>
                      <div className="font-medium">{keyword.keyword}</div>
                      {keyword.related_keywords?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          +{keyword.related_keywords.length} related
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {keyword.search_volume?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getDifficultyColor(keyword.keyword_difficulty)}>
                        {keyword.keyword_difficulty || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {keyword.cpc_cents
                        ? `$${(keyword.cpc_cents / 100).toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {keyword.intent || 'informational'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[keyword.status] || statusColors.discovered}>
                        {keyword.status || 'discovered'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/growth/seo/briefs/new?keyword=${keyword.id}`}>
                            <FileText className="mr-2 h-3 w-3" />
                            Brief
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/growth/seo/keywords/${keyword.id}`}>
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
              <Search className="h-8 w-8 opacity-50" />
              <p>No keywords researched yet</p>
              <Button asChild size="sm">
                <Link href="/dashboard/growth/seo/keywords/discover">
                  <Plus className="mr-2 h-4 w-4" />
                  Discover Keywords
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
