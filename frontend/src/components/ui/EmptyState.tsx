import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, description, actionText, onAction }: Props) {
  return (
    <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center text-sm text-slate-400">
      <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-slate-500" />
      <p className="font-medium text-slate-200 mb-1">{title}</p>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      {actionText && onAction && (
        <button className="btn btn-xs btn-outline btn-primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
