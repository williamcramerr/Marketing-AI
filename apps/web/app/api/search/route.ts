import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export type SearchResultType = 'task' | 'campaign' | 'product' | 'content_asset';

export interface SearchResult {
  id: string;
  title: string;
  type: SearchResultType;
  description?: string;
  url: string;
  relevance: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const types = searchParams.get('types')?.split(',') as SearchResultType[] | undefined;
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [], query: '' });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the global_search function from the migration
  const { data: searchResults, error } = await supabase.rpc('global_search', {
    search_query: query.trim(),
    result_limit: limit,
  });

  if (error) {
    console.error('Search error:', error);
    // Fall back to simple ILIKE search if the function doesn't exist
    return fallbackSearch(supabase, query, types, limit);
  }

  if (!searchResults || searchResults.length === 0) {
    // Try fallback search
    return fallbackSearch(supabase, query, types, limit);
  }

  const results: SearchResult[] = searchResults
    .filter((r: { result_type: string }) => !types || types.includes(r.result_type as SearchResultType))
    .map((r: { id: string; title: string; result_type: string; description?: string; relevance: number }) => ({
      id: r.id,
      title: r.title,
      type: r.result_type as SearchResultType,
      description: r.description,
      url: getResultUrl(r.result_type, r.id),
      relevance: r.relevance,
    }));

  return NextResponse.json({ results, query });
}

function getResultUrl(type: string, id: string): string {
  switch (type) {
    case 'task':
      return `/dashboard/tasks/${id}`;
    case 'campaign':
      return `/dashboard/campaigns/${id}`;
    case 'product':
      return `/dashboard/products/${id}`;
    case 'content_asset':
      return `/dashboard/content/${id}`;
    default:
      return `/dashboard`;
  }
}

async function fallbackSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  types: SearchResultType[] | undefined,
  limit: number
) {
  const searchTerm = `%${query}%`;
  const results: SearchResult[] = [];

  // Search tasks
  if (!types || types.includes('task')) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, type')
      .ilike('title', searchTerm)
      .limit(limit);

    if (tasks) {
      results.push(
        ...tasks.map((t) => ({
          id: t.id,
          title: t.title,
          type: 'task' as const,
          description: t.type,
          url: `/dashboard/tasks/${t.id}`,
          relevance: 1,
        }))
      );
    }
  }

  // Search campaigns
  if (!types || types.includes('campaign')) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, description')
      .ilike('name', searchTerm)
      .limit(limit);

    if (campaigns) {
      results.push(
        ...campaigns.map((c) => ({
          id: c.id,
          title: c.name,
          type: 'campaign' as const,
          description: c.description,
          url: `/dashboard/campaigns/${c.id}`,
          relevance: 1,
        }))
      );
    }
  }

  // Search products
  if (!types || types.includes('product')) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description')
      .ilike('name', searchTerm)
      .limit(limit);

    if (products) {
      results.push(
        ...products.map((p) => ({
          id: p.id,
          title: p.name,
          type: 'product' as const,
          description: p.description,
          url: `/dashboard/products/${p.id}`,
          relevance: 1,
        }))
      );
    }
  }

  // Search content assets
  if (!types || types.includes('content_asset')) {
    const { data: assets } = await supabase
      .from('content_assets')
      .select('id, name, content_type')
      .ilike('name', searchTerm)
      .limit(limit);

    if (assets) {
      results.push(
        ...assets.map((a) => ({
          id: a.id,
          title: a.name,
          type: 'content_asset' as const,
          description: a.content_type,
          url: `/dashboard/content/${a.id}`,
          relevance: 1,
        }))
      );
    }
  }

  return NextResponse.json({ results: results.slice(0, limit), query });
}
