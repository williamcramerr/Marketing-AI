'use client';

import { useState } from 'react';
import { Twitter, Linkedin, Heart, MessageCircle, Repeat2, Share, ThumbsUp, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface SocialPreviewProps {
  content: string;
  platform?: 'twitter' | 'linkedin';
  imageUrl?: string;
  linkPreview?: {
    title: string;
    description: string;
    url: string;
    image?: string;
  };
  author?: {
    name: string;
    handle: string;
    avatar?: string;
  };
}

const TWITTER_CHAR_LIMIT = 280;
const LINKEDIN_CHAR_LIMIT = 3000;

export function SocialPreview({
  content,
  platform = 'twitter',
  imageUrl,
  linkPreview,
  author = { name: 'Marketing Pilot', handle: 'marketingpilot' },
}: SocialPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<'twitter' | 'linkedin'>(platform);

  const charLimit = activePlatform === 'twitter' ? TWITTER_CHAR_LIMIT : LINKEDIN_CHAR_LIMIT;
  const isOverLimit = content.length > charLimit;
  const charCount = content.length;

  return (
    <div className="space-y-4">
      <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as 'twitter' | 'linkedin')}>
        <TabsList>
          <TabsTrigger value="twitter" className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            X / Twitter
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex items-center gap-2">
            <Linkedin className="h-4 w-4" />
            LinkedIn
          </TabsTrigger>
        </TabsList>

        {/* Twitter/X Preview */}
        <TabsContent value="twitter" className="mt-4">
          <div className="mx-auto max-w-lg rounded-xl border bg-white p-4 shadow-sm dark:bg-black dark:border-gray-800">
            {/* Author */}
            <div className="flex gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {author.avatar ? (
                  <img src={author.avatar} alt={author.name} className="h-10 w-10 rounded-full" />
                ) : (
                  author.name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-900 dark:text-white">{author.name}</span>
                  <span className="text-gray-500">@{author.handle}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500">now</span>
                </div>

                {/* Content */}
                <div className="mt-1">
                  <p className="whitespace-pre-wrap text-gray-900 dark:text-white">{content}</p>
                </div>

                {/* Image */}
                {imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border dark:border-gray-800">
                    <img src={imageUrl} alt="Post image" className="w-full" />
                  </div>
                )}

                {/* Link Preview */}
                {linkPreview && !imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border dark:border-gray-800">
                    {linkPreview.image && (
                      <img src={linkPreview.image} alt="" className="w-full h-32 object-cover" />
                    )}
                    <div className="p-3">
                      <p className="text-xs text-gray-500">{new URL(linkPreview.url).hostname}</p>
                      <p className="font-medium text-gray-900 dark:text-white">{linkPreview.title}</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{linkPreview.description}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex justify-between text-gray-500">
                  <button className="flex items-center gap-1 hover:text-blue-500">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">0</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-green-500">
                    <Repeat2 className="h-4 w-4" />
                    <span className="text-xs">0</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-red-500">
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">0</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-blue-500">
                    <Share className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* LinkedIn Preview */}
        <TabsContent value="linkedin" className="mt-4">
          <div className="mx-auto max-w-lg rounded-lg border bg-white shadow-sm dark:bg-[#1b1f23] dark:border-gray-700">
            {/* Author */}
            <div className="flex gap-3 p-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {author.avatar ? (
                  <img src={author.avatar} alt={author.name} className="h-12 w-12 rounded-full" />
                ) : (
                  author.name.charAt(0)
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{author.name}</p>
                <p className="text-xs text-gray-500">Marketing Professional</p>
                <p className="text-xs text-gray-500">Just now · <span className="text-gray-400">🌐</span></p>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
              <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{content}</p>
            </div>

            {/* Image */}
            {imageUrl && (
              <div className="border-t dark:border-gray-700">
                <img src={imageUrl} alt="Post image" className="w-full" />
              </div>
            )}

            {/* Link Preview */}
            {linkPreview && !imageUrl && (
              <div className="border-t dark:border-gray-700">
                {linkPreview.image && (
                  <img src={linkPreview.image} alt="" className="w-full h-48 object-cover" />
                )}
                <div className="bg-gray-100 dark:bg-gray-800 p-3">
                  <p className="font-medium text-gray-900 dark:text-white">{linkPreview.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{new URL(linkPreview.url).hostname}</p>
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            <div className="border-t dark:border-gray-700 px-4 py-2 text-xs text-gray-500">
              <span>0 reactions</span>
              <span className="mx-1">·</span>
              <span>0 comments</span>
            </div>

            {/* Actions */}
            <div className="flex justify-around border-t dark:border-gray-700 py-1">
              <button className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mx-1">
                <ThumbsUp className="h-5 w-5" />
                Like
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mx-1">
                <MessageCircle className="h-5 w-5" />
                Comment
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mx-1">
                <Repeat2 className="h-5 w-5" />
                Repost
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mx-1">
                <Send className="h-5 w-5" />
                Send
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Character Count */}
      <div className="text-center">
        <span
          className={cn(
            'text-sm',
            isOverLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'
          )}
        >
          {charCount} / {charLimit} characters
          {isOverLimit && ` (${charCount - charLimit} over limit)`}
        </span>
      </div>
    </div>
  );
}
