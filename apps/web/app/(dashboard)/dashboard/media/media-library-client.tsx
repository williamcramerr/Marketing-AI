'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid3X3,
  List,
  Search,
  Upload,
  FolderPlus,
  Folder,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { MediaGrid } from '@/components/media/media-grid';
import { MediaUpload } from '@/components/media/media-upload';
import {
  uploadAsset,
  deleteAsset,
  createCollection,
  deleteCollection,
  type MediaAsset,
  type MediaCollection,
} from '@/lib/actions/media';
import { cn } from '@/lib/utils';

interface MediaLibraryClientProps {
  organizationId: string;
  initialAssets: MediaAsset[];
  initialTotal: number;
  collections: MediaCollection[];
}

export function MediaLibraryClient({
  organizationId,
  initialAssets,
  initialTotal,
  collections: initialCollections,
}: MediaLibraryClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [assets, setAssets] = useState(initialAssets);
  const [collections, setCollections] = useState(initialCollections);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const result = await uploadAsset(organizationId, file, {
          collectionId: selectedCollection || undefined,
        });
        if (result.success && result.asset) {
          setAssets((prev) => [result.asset!, ...prev]);
        }
      }
      setShowUploadDialog(false);
      router.refresh();
    },
    [organizationId, selectedCollection, router]
  );

  const handleDelete = useCallback(
    async (assetId: string) => {
      const result = await deleteAsset(assetId);
      if (result.success) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    },
    []
  );

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    const result = await createCollection(organizationId, newFolderName.trim());
    if (result.success && result.collection) {
      setCollections((prev) => [...prev, result.collection!]);
      setNewFolderName('');
      setShowNewFolderDialog(false);
    }
  }, [organizationId, newFolderName]);

  const handleDeleteCollection = useCallback(
    async (collectionId: string) => {
      const result = await deleteCollection(collectionId);
      if (result.success) {
        setCollections((prev) => prev.filter((c) => c.id !== collectionId));
        if (selectedCollection === collectionId) {
          setSelectedCollection(null);
        }
      }
    },
    [selectedCollection]
  );

  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  }, []);

  const filteredAssets = assets.filter(
    (asset) =>
      (!selectedCollection || asset.collection_id === selectedCollection) &&
      (!searchQuery || asset.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar - Collections */}
      <Card className="hidden w-64 flex-shrink-0 lg:block">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Collections</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setSelectedCollection(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
                !selectedCollection && 'bg-accent'
              )}
            >
              <Folder className="h-4 w-4" />
              All Assets
            </button>

            {collections.map((collection) => (
              <div key={collection.id} className="group flex items-center">
                <button
                  onClick={() => setSelectedCollection(collection.id)}
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
                    selectedCollection === collection.id && 'bg-accent'
                  )}
                >
                  <Folder className="h-4 w-4" />
                  <span className="truncate">{collection.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteCollection(collection.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="flex-1">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <button
            onClick={() => setSelectedCollection(null)}
            className="hover:text-foreground"
          >
            All Assets
          </button>
          {selectedCollection && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">
                {collections.find((c) => c.id === selectedCollection)?.name}
              </span>
            </>
          )}
          <span className="ml-auto">
            {filteredAssets.length} {filteredAssets.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Assets Grid */}
        <MediaGrid
          assets={filteredAssets}
          viewMode={viewMode}
          selectedIds={selectedAssets}
          onSelect={toggleAssetSelection}
          onDelete={handleDelete}
        />
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Assets</DialogTitle>
            <DialogDescription>
              Drag and drop files or click to browse
            </DialogDescription>
          </DialogHeader>
          <MediaUpload onUpload={handleUpload} />
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Create a new collection to organize your assets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Collection Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Marketing Images"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
