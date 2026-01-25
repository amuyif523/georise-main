export type ReportDraft = {
  category: string;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  image?: File | null; // Note: Files are not persisted to localStorage
  notAtScene?: boolean;
};

export type WizardStepProps = {
  onNext: () => void;
  onBack?: () => void;
};
