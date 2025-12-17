import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Search,
  FileText,
  TrendingUp,
  Target,
  BarChart3,
  Plus,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

export default async function SEOPage() {
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
    .select('id')
    .eq('organization_id', membership.organization_id);

  const productIds = products?.map(p => p.id) || [];

  // Fetch keywords
  const { data: keywords } = await supabase
    .from('keyword_research')
    .select('*')
    .in('product_id', productIds.length > 0 ? productIds : ['none'])
    .order('priority', { ascending: false })
    .limit(20);

  // Fetch briefs
  const { data: briefs } = await supabase
    .from('seo_content_briefs')
    .select('*')
    .in('product_id', productIds.length > 0 ? productIds : ['none'])
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch rankings
  const { data: rankings } = await supabase
    .from('seo_rankings')
    .select('*')
    .in('product_id', productIds.length > 0 ? productIds : ['none'])
    .eq('active', true)
    .order('current_position', { ascending: true })
    .limit(10);

  // Calculate stats
  const totalKeywords = keywords?.length || 0;
  const avgVolume = keywords?.length
    ? Math.round(keywords.reduce((sum, k) => sum + (k.search_volume || 0), 0) / keywords.length)
    : 0;
  const totalBriefs = briefs?.length || 0;
  const completedBriefs = briefs?.filter(b => b.status === 'completed').length || 0;
  const trackedKeywords = rankings?.length || 0;
  const top10Keywords = rankings?.filter(r => (r.current_position || 101) <= 10).length || 0;

  const getDifficultyColor = (difficulty: number | null) => {
    if (!difficulty) return 'bg-gray-100 text-gray-800';
    if (difficulty <= 30) return 'bg-green-100 text-green-800';
    if (difficulty <= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPositionChange = (history: any[]) => {
    if (!history || history.length < 2) return null;
    const current = history[history.length - 1]?.position;
    const previous = history[history.length - 2]?.position;
    if (!current || !previous) return null;
    return previous - current; // Positive = improvement
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Content Engine</h1>
          <p className="text-muted-foreground">
            Research keywords, create briefs, and track rankings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/growth/seo/rankings">
              <BarChart3 className="mr-2 h-4 w-4" />
              Rankings
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/growth/seo/keywords/discover">
              <Search className="mr-2 h-4 w-4" />
              Discover Keywords
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Keywords</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalKeywords}</div>
            <p className="text-xs text-muted-foreground">avg. {avgVolume.toLocaleString()} monthly volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Briefs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBriefs}</div>
            <p className="text-xs text-muted-foreground">{completedBriefs} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tracked Rankings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trackedKeywords}</div>
            <p className="text-xs text-muted-foreground">keywords monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top 10</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{top10Keywords}</div>
            <p className="text-xs text-muted-foreground">keywords ranking</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/growth/seo/keywords">
          <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-500" />
                Keywords
              </CardTitle>
              <CardDescription>
                Research and track keywords for your content strategy
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/growth/seo/briefs">
          <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                Content Briefs
              </CardTitle>
              <CardDescription>
                Create AI-powered briefs for SEO-optimized content
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/growth/seo/rankings">
          <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-500" />
                Rank Tracking
              </CardTitle>
              <CardDescription>
                Monitor your search rankings over time
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Top Keywords */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top Keywords</CardTitle>
              <CardDescription>Your highest priority keyword targets</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/growth/seo/keywords">
                View All
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keywords && keywords.length > 0 ? (
            <div className="space-y-3">
              {keywords.slice(0, 5).map((keyword) => (
                <div
                  key={keyword.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{keyword.keyword}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{(keyword.search_volume || 0).toLocaleString()} vol</span>
                      <Badge className={getDifficultyColor(keyword.keyword_difficulty)}>
                        KD: {keyword.keyword_difficulty || 'N/A'}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {keyword.intent || 'informational'}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {keyword.status || 'discovered'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Search className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No keywords yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Start researching keywords for your SEO strategy
              </p>
              <Button asChild>
                <Link href="/dashboard/growth/seo/keywords/discover">
                  <Plus className="mr-2 h-4 w-4" />
                  Discover Keywords
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rankings */}
      {rankings && rankings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Rankings</CardTitle>
                <CardDescription>Your search engine positions</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/growth/seo/rankings">
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rankings.slice(0, 5).map((ranking) => {
                const change = getPositionChange(ranking.position_history);

                return (
                  <div
                    key={ranking.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{ranking.tracked_keyword}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {ranking.tracked_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {change !== null && (
                        <div className={`flex items-center gap-1 text-sm ${
                          change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {change > 0 ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : change < 0 ? (
                            <ArrowDown className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                          {Math.abs(change)}
                        </div>
                      )}
                      <Badge
                        className={
                          (ranking.current_position || 101) <= 3
                            ? 'bg-green-100 text-green-800'
                            : (ranking.current_position || 101) <= 10
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        #{ranking.current_position || '100+'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
