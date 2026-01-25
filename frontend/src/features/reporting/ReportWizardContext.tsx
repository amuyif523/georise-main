import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useReportDraft } from './hooks/useReportDraft';
import type { ReportDraft } from './hooks/useReportDraft';

type ContextType = {
  draft: ReportDraft;
  updateDraft: (updates: Partial<ReportDraft>) => void;
  clearDraft: () => void;
};

const ReportWizardContext = createContext<ContextType | null>(null);

export const ReportWizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const draftLogic = useReportDraft();

  return <ReportWizardContext.Provider value={draftLogic}>{children}</ReportWizardContext.Provider>;
};

export const useReportContext = () => {
  const ctx = useContext(ReportWizardContext);
  if (!ctx) throw new Error('useReportContext must be used within ReportWizardProvider');
  return ctx;
};
