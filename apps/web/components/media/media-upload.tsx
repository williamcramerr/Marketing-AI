'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MediaUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number; // in bytes
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const DEFAULT_ACCEPT = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
  'video/*': ['.mp4', '.webm', '.mov'],
  'audio/*': ['.mp3', '.wav', '.ogg'],
  'application/pdf': ['.pdf'],
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MediaUpload({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  className,
}: MediaUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setIsUploading(true);

      // Initialize uploading state
      const initialFiles = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: 'uploading' as const,
      }));
      setUploadingFiles(initialFiles);

      try {
        // Simulate progress (in real implementation, use XMLHttpRequest for progress)
        for (let i = 0; i < initialFiles.length; i++) {
          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress: 50 } : f
            )
          );
        }

        await onUpload(acceptedFiles);

        // Mark all as success
        setUploadingFiles((prev) =>
          prev.map((f) => ({ ...f, progress: 100, status: 'success' as const }))
        );

        // Clear after a delay
        setTimeout(() => {
          setUploadingFiles([]);
        }, 2000);
      } catch (error) {
        setUploadingFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Upload failed',
          }))
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('mb-4 h-10 w-10', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
        {isDragActive ? (
          <p className="text-primary">Drop files here...</p>
        ) : (
          <>
            <p className="text-center font-medium">
              Drag & drop files here, or click to select
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Max {maxFiles} files, up to {formatFileSize(maxSize)} each
            </p>
          </>
        )}
      </div>

      {/* File rejections */}
      {fileRejections.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-800 dark:text-red-200">
            Some files were rejected:
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-red-700 dark:text-red-300">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name}>
                {file.name} - {errors.map((e) => e.message).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {item.status === 'uploading' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {item.status === 'success' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {item.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                  {item.error && (
                    <span className="text-red-500"> - {item.error}</span>
                  )}
                </p>
                {item.status === 'uploading' && (
                  <Progress value={item.progress} className="mt-1 h-1" />
                )}
              </div>

              {/* Remove button */}
              {item.status !== 'uploading' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
