'use client';

import { useState } from 'react';
import { Plus, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GuidelineListProps {
  type: 'do' | 'dont';
  items: string[];
  onChange: (items: string[]) => void;
  disabled?: boolean;
  maxItems?: number;
}

export function GuidelineList({
  type,
  items,
  onChange,
  disabled,
  maxItems = 10,
}: GuidelineListProps) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim() && items.length < maxItems) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const Icon = type === 'do' ? Check : AlertCircle;
  const colorClass = type === 'do'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const bgClass = type === 'do'
    ? 'bg-green-50 dark:bg-green-900/20'
    : 'bg-red-50 dark:bg-red-900/20';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', colorClass)} />
        <span className="text-sm font-medium">
          {type === 'do' ? 'DOs' : "DON'Ts"}
        </span>
        <span className="text-xs text-muted-foreground">
          ({items.length}/{maxItems})
        </span>
      </div>

      {/* Add new item */}
      {!disabled && items.length < maxItems && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={type === 'do' ? 'Add a guideline...' : 'Add something to avoid...'}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addItem}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* List of items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2',
              bgClass
            )}
          >
            <Icon className={cn('h-4 w-4 flex-shrink-0', colorClass)} />
            <span className="flex-1 text-sm">{item}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeItem(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          {type === 'do'
            ? 'No guidelines added yet. Add things your content should do.'
            : 'No restrictions added yet. Add things your content should avoid.'}
        </p>
      )}
    </div>
  );
}

// Combined component for both DOs and DON'Ts
interface BrandGuidelinesProps {
  dos: string[];
  donts: string[];
  onDosChange: (items: string[]) => void;
  onDontsChange: (items: string[]) => void;
  disabled?: boolean;
}

export function BrandGuidelines({
  dos,
  donts,
  onDosChange,
  onDontsChange,
  disabled,
}: BrandGuidelinesProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <GuidelineList
        type="do"
        items={dos}
        onChange={onDosChange}
        disabled={disabled}
      />
      <GuidelineList
        type="dont"
        items={donts}
        onChange={onDontsChange}
        disabled={disabled}
      />
    </div>
  );
}
