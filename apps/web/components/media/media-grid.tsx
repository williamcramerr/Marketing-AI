'use client';

import { Image as ImageIcon, File, Film, Music, MoreVertical, Download, Trash2, Edit2, FolderInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EmptyMedia } from '@/components/common/empty-state';
import type { MediaAsset } from '@/lib/actions/media';

interface MediaGridProps {
  assets: MediaAsset[];
  viewMode?: 'grid' | 'list';
  selectedIds?: string[];
  onSelect?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onRename?: (assetId: string) => void;
  onMove?: (assetId: string) => void;
  onView?: (asset: MediaAsset) => void;
}

const getFileIcon = (contentType: string) => {
  if (contentType.startsWith('image/')) return ImageIcon;
  if (contentType.startsWith('video/')) return Film;
  if (contentType.startsWith('audio/')) return Music;
  return File;
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MediaGrid({
  assets,
  viewMode = 'grid',
  selectedIds = [],
  onSelect,
  onDelete,
  onRename,
  onMove,
  onView,
}: MediaGridProps) {
  if (assets.length === 0) {
    return <EmptyMedia />;
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {assets.map((asset) => {
          const Icon = getFileIcon(asset.content_type);
          const isSelected = selectedIds.includes(asset.id);

          return (
            <div
              key={asset.id}
              className={cn(
                'flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent cursor-pointer',
                isSelected && 'border-primary bg-primary/5'
              )}
              onClick={() => onView?.(asset)}
            >
              {/* Thumbnail */}
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                {asset.content_type.startsWith('image/') && asset.file_url ? (
                  <img
                    src={asset.thumbnail_url || asset.file_url}
                    alt={asset.name}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : (
                  <Icon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.content_type} · {formatFileSize(asset.file_size)}
                </p>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRename?.(asset.id)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove?.(asset.id)}>
                    <FolderInput className="mr-2 h-4 w-4" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={asset.file_url} download={asset.name} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(asset.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selection checkbox */}
              {onSelect && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelect(asset.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Grid view
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {assets.map((asset) => {
        const Icon = getFileIcon(asset.content_type);
        const isSelected = selectedIds.includes(asset.id);

        return (
          <div
            key={asset.id}
            className={cn(
              'group relative rounded-lg border bg-card p-2 transition-all hover:shadow-md cursor-pointer',
              isSelected && 'border-primary ring-2 ring-primary/20'
            )}
            onClick={() => onView?.(asset)}
          >
            {/* Selection checkbox */}
            {onSelect && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelect(asset.id)}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'h-4 w-4 rounded',
                    !isSelected && 'opacity-0 group-hover:opacity-100'
                  )}
                />
              </div>
            )}

            {/* Actions */}
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRename?.(asset.id)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove?.(asset.id)}>
                    <FolderInput className="mr-2 h-4 w-4" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={asset.file_url} download={asset.name} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(asset.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Thumbnail */}
            <div className="aspect-square overflow-hidden rounded-md bg-muted">
              {asset.content_type.startsWith('image/') && asset.file_url ? (
                <img
                  src={asset.thumbnail_url || asset.file_url}
                  alt={asset.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Name */}
            <p className="mt-2 truncate text-sm font-medium">{asset.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatFileSize(asset.file_size)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
