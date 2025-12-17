'use client';

import { useState, useMemo } from 'react';
import { Monitor, Smartphone, Moon, Sun } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface EmailPreviewProps {
  subject: string;
  previewText?: string;
  htmlContent: string;
  from?: {
    name: string;
    email: string;
  };
}

type ViewMode = 'desktop' | 'mobile';
type ClientMode = 'gmail' | 'outlook' | 'generic';
type ThemeMode = 'light' | 'dark';

export function EmailPreview({
  subject,
  previewText,
  htmlContent,
  from = { name: 'Marketing Pilot', email: 'hello@example.com' },
}: EmailPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [clientMode, setClientMode] = useState<ClientMode>('gmail');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
        'td', 'th', 'thead', 'tr', 'u', 'ul', 'hr', 'blockquote', 'pre', 'code',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'style', 'class', 'width', 'height',
        'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'bgcolor',
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [htmlContent]);

  const getClientStyles = () => {
    switch (clientMode) {
      case 'gmail':
        return {
          header: 'bg-white border-b',
          body: themeMode === 'dark' ? 'bg-gray-900' : 'bg-white',
          text: themeMode === 'dark' ? 'text-gray-100' : 'text-gray-900',
        };
      case 'outlook':
        return {
          header: themeMode === 'dark' ? 'bg-[#1f1f1f]' : 'bg-[#0078d4]',
          body: themeMode === 'dark' ? 'bg-[#1f1f1f]' : 'bg-white',
          text: themeMode === 'dark' ? 'text-gray-100' : 'text-gray-900',
        };
      default:
        return {
          header: 'bg-gray-100',
          body: themeMode === 'dark' ? 'bg-gray-900' : 'bg-white',
          text: themeMode === 'dark' ? 'text-gray-100' : 'text-gray-900',
        };
    }
  };

  const styles = getClientStyles();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* View Mode */}
        <div className="flex items-center gap-2 rounded-lg border p-1">
          <Button
            variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('desktop')}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('mobile')}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        {/* Email Client */}
        <Tabs value={clientMode} onValueChange={(v) => setClientMode(v as ClientMode)}>
          <TabsList>
            <TabsTrigger value="gmail">Gmail</TabsTrigger>
            <TabsTrigger value="outlook">Outlook</TabsTrigger>
            <TabsTrigger value="generic">Generic</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Theme Mode */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
        >
          {themeMode === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Preview Container */}
      <div
        className={cn(
          'mx-auto overflow-hidden rounded-lg border shadow-lg transition-all',
          viewMode === 'desktop' ? 'w-full max-w-3xl' : 'w-full max-w-sm'
        )}
      >
        {/* Email Client Header */}
        <div className={cn('px-4 py-3', styles.header)}>
          {clientMode === 'gmail' && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {from.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{from.name}</span>
                  <span className="text-sm text-muted-foreground">
                    &lt;{from.email}&gt;
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">to me</p>
              </div>
            </div>
          )}
          {clientMode === 'outlook' && (
            <div className={themeMode === 'dark' ? 'text-white' : 'text-white'}>
              <p className="font-medium">{from.name}</p>
              <p className="text-sm opacity-80">{from.email}</p>
            </div>
          )}
          {clientMode === 'generic' && (
            <div>
              <p className="font-medium">From: {from.name} &lt;{from.email}&gt;</p>
              <p className="text-sm text-muted-foreground">To: recipient@example.com</p>
            </div>
          )}
        </div>

        {/* Subject Line */}
        <div className={cn('border-b px-4 py-2', styles.body, styles.text)}>
          <h2 className="font-semibold">{subject}</h2>
          {previewText && (
            <p className="text-sm text-muted-foreground">{previewText}</p>
          )}
        </div>

        {/* Email Content - Sanitized with DOMPurify */}
        <div
          className={cn(
            'min-h-[400px] overflow-auto',
            styles.body,
            viewMode === 'mobile' ? 'max-h-[600px]' : 'max-h-[500px]'
          )}
        >
          <div
            className={cn('p-4', styles.text)}
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        </div>
      </div>

      {/* Preview Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Preview showing {viewMode} view in {clientMode} ({themeMode} mode)
        </p>
      </div>
    </div>
  );
}
