import Link from 'next/link';
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
import { Plus, FileText, Mail, Share2, Image, File, Globe, ChevronRight } from 'lucide-react';
import { listContentAssets } from '@/lib/actions/content-assets';
import { getAssetTypeDisplayName, type AssetType } from '@/lib/utils/content-utils';
import { DeleteAssetButton } from './delete-asset-button';
import { TogglePublishButton } from './toggle-publish-button';

const assetTypeIcons: Record<AssetType, typeof FileText> = {
  blog_post: FileText,
  landing_page: Globe,
  email_template: Mail,
  social_post: Share2,
  image: Image,
  document: File,
};

const assetTypeBadgeVariants: Record<AssetType, 'default' | 'secondary' | 'info' | 'success' | 'warning'> = {
  blog_post: 'default',
  landing_page: 'info',
  email_template: 'success',
  social_post: 'warning',
  image: 'secondary',
  document: 'secondary',
};

export default async function ContentAssetsPage() {
  const result = await listContentAssets();

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h1 className="mb-2 text-2xl font-bold">Error Loading Content</h1>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const assets = result.data || [];

  // Group by type for summary
  const assetsByType = assets.reduce(
    (acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const publishedCount = assets.filter((a) => a.published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Assets</h1>
          <p className="text-muted-foreground">
            Manage your marketing content, templates, and media
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/content/new">
            <Plus className="mr-2 h-4 w-4" />
            New Content
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedCount}</div>
            <p className="text-xs text-muted-foreground">
              {assets.length > 0
                ? ((publishedCount / assets.length) * 100).toFixed(0)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetsByType.blog_post || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Email Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assetsByType.email_template || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Content</CardTitle>
          <CardDescription>
            Browse and manage your content assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => {
                  const Icon = assetTypeIcons[asset.type] || File;
                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{asset.title}</div>
                            {asset.task && (
                              <div className="text-xs text-muted-foreground">
                                From task: {asset.task.title}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={assetTypeBadgeVariants[asset.type]}>
                          {getAssetTypeDisplayName(asset.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{asset.product?.name || '-'}</TableCell>
                      <TableCell>
                        {asset.published ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="draft">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>v{asset.version}</TableCell>
                      <TableCell>
                        {new Date(asset.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <TogglePublishButton
                            assetId={asset.id}
                            published={asset.published}
                          />
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/content/${asset.id}`}>
                              Edit
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                          <DeleteAssetButton assetId={asset.id} title={asset.title} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No content yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first content asset to get started
              </p>
              <Button asChild>
                <Link href="/dashboard/content/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Content
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
