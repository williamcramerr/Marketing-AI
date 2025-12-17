'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'marketing-pilot-dismissed-tips';

export function useDismissedTips() {
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDismissedTips(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Failed to load dismissed tips:', error);
    }
    setIsLoaded(true);
  }, []);

  const dismissTip = useCallback((tipId: string) => {
    setDismissedTips((prev) => {
      const next = new Set(prev);
      next.add(tipId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch (error) {
        console.error('Failed to save dismissed tip:', error);
      }
      return next;
    });
  }, []);

  const isTipDismissed = useCallback(
    (tipId: string) => dismissedTips.has(tipId),
    [dismissedTips]
  );

  const resetTips = useCallback(() => {
    setDismissedTips(new Set());
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset tips:', error);
    }
  }, []);

  return {
    dismissTip,
    isTipDismissed,
    resetTips,
    isLoaded,
  };
}
