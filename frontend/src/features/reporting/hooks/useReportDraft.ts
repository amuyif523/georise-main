import { useState, useEffect, useCallback } from 'react';

export type ReportDraft = {
  category: string;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  image?: File | null;
  notAtScene?: boolean;
};

const STORAGE_KEY = 'georise_report_draft_v1';

export const useReportDraft = () => {
  const [draft, setDraft] = useState<ReportDraft>({
    category: '',
    title: '',
    description: ''
  });

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraft(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to local storage on change
  const updateDraft = useCallback((updates: Partial<ReportDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...updates };
      // Don't save File objects to local storage (they won't serialize well)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { image, ...serializable } = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft({ category: '', title: '', description: '' });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { draft, updateDraft, clearDraft };
};
