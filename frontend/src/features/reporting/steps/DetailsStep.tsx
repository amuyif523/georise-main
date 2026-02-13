import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowRight, Car, Flame, AlertTriangle, Zap, Check } from 'lucide-react';
import { useReportContext } from '../ReportWizardContext';

export const DetailsStep: React.FC<{ onNext: () => void; onBack: () => void }> = ({
  onNext,
  onBack,
}) => {
  const { draft, updateDraft } = useReportContext();
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Mock AI Analysis effect
  useEffect(() => {
    if (draft.description && draft.description.length > 10 && !draft.category) {
      setIsAnalyzing(true);
      const timer = setTimeout(() => {
        setIsAnalyzing(false);
        // Simple mock logic for demo purposes - normally this would come from backend
        if (draft.description.toLowerCase().includes('fire')) updateDraft({ category: 'FIRE' });
        else if (draft.description.toLowerCase().includes('crash'))
          updateDraft({ category: 'ACCIDENT' });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [draft.description]);

  const categories = [
    { id: 'ACCIDENT', label: 'Traffic', icon: <Car className="w-6 h-6" />, color: 'bg-orange-500' },
    { id: 'FIRE', label: 'Fire', icon: <Flame className="w-6 h-6" />, color: 'bg-red-600' },
    {
      id: 'CRIME',
      label: 'Crime',
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-blue-600',
    },
    {
      id: 'INFRASTRUCTURE',
      label: 'Infra',
      icon: <Zap className="w-6 h-6" />,
      color: 'bg-yellow-500',
    },
    {
      id: 'OTHER',
      label: 'Other',
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-gray-500',
    },
  ];

  const handleNext = () => {
    if (!draft.title || draft.title.length < 5) {
      setError('Title must be at least 5 characters.');
      return;
    }
    if (!draft.description || draft.description.length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }
    if (!draft.category) {
      setError('Please select a category.');
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-full max-w-lg mx-auto pb-10 px-4"
    >
      <h2 className="text-2xl font-bold mb-6">Incident Details</h2>
      {error && <div className="alert alert-error mb-6 text-sm shadow-sm">{error}</div>}

      <div className="space-y-6">
        {/* Title Input */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold text-base-content">Brief Title</span>
          </label>
          <input
            className="input input-bordered h-12 bg-base-200 focus:bg-base-100 transition-colors font-medium"
            placeholder="e.g. Broken hydrant causing flood"
            value={draft.title}
            onChange={(e) => updateDraft({ title: e.target.value })}
          />
        </div>

        {/* Description Textarea */}
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-semibold text-base-content">Situation Report</span>
            <span className="label-text-alt opacity-60">
              {(draft.description || '').length}/500
            </span>
          </label>
          <textarea
            className="textarea textarea-bordered min-h-[120px] bg-base-200 focus:bg-base-100 resize-none text-base leading-relaxed transition-colors"
            placeholder="Describe what you see..."
            value={draft.description}
            onChange={(e) => updateDraft({ description: e.target.value })}
            maxLength={500}
          ></textarea>
        </div>

        {/* Category Grid (AI Triage) */}
        <div className="form-control w-full">
          <label className="label flex justify-between items-center">
            <span className="label-text font-semibold text-base-content">Category</span>
            {isAnalyzing && (
              <span className="label-text-alt text-primary animate-pulse flex items-center gap-1">
                <span className="loading loading-dots loading-xs"></span>
                AI Analyzing
              </span>
            )}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {categories.map((cat) => {
              const isSelected = draft.category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => updateDraft({ category: cat.id })}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-base-200 bg-base-100 hover:bg-base-200 hover:border-base-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-primary">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`p-2 rounded-full text-white shadow-sm transition-transform group-hover:scale-110 ${cat.color}`}
                  >
                    {cat.icon}
                  </div>
                  <span
                    className={`text-xs font-medium ${isSelected ? 'text-primary' : 'opacity-70'}`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Image Upload */}
        <div className="p-4 bg-base-200/50 border border-base-200 rounded-xl flex items-center justify-between hover:bg-base-200 transition-colors cursor-pointer relative group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-base-300 rounded-lg group-hover:bg-base-100 transition-colors">
              <Camera className="w-5 h-5 opacity-60" />
            </div>
            <span className="text-sm font-medium opacity-80">
              {draft.image ? 'Photo Attached' : 'Attach Photo Evidence'}
            </span>
          </div>
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/*"
            onChange={(e) => updateDraft({ image: e.target.files?.[0] })}
          />
          {draft.image && <Check className="w-5 h-5 text-success" />}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        <button className="btn btn-ghost hover:bg-base-200" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary px-8 shadow-lg shadow-primary/20" onClick={handleNext}>
          Review <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
