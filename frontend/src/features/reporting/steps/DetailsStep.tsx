import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowRight } from 'lucide-react';
import { useReportContext } from '../ReportWizardContext';

export const DetailsStep: React.FC<{ onNext: () => void; onBack: () => void }> = ({ onNext, onBack }) => {
    const { draft, updateDraft } = useReportContext();
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => {
        if (!draft.title || draft.title.length < 5) {
            setError('Title must be at least 5 characters.');
            return;
        }
        if (!draft.description || draft.description.length < 10) {
            setError('Description must be at least 10 characters.');
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
            className="w-full max-w-lg mx-auto"
        >
            <h2 className="text-2xl font-bold mb-6">Incident Intel</h2>
            {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}

            <div className="space-y-4">
                <div className="form-control">
                    <label className="label font-bold">Brief Title</label>
                    <input
                        className="input input-bordered h-14 bg-base-200"
                        placeholder="e.g. Broken hydrants causing flood"
                        value={draft.title}
                        onChange={e => updateDraft({ title: e.target.value })}
                    />
                </div>
                <div className="form-control">
                    <label className="label font-bold">Situation Report</label>
                    <textarea
                        className="textarea textarea-bordered h-32 bg-base-200 text-base"
                        placeholder="Describe what you see..."
                        value={draft.description}
                        onChange={e => updateDraft({ description: e.target.value })}
                    ></textarea>
                </div>

                <div className="p-4 bg-base-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Camera className="w-5 h-5 opacity-60" />
                        <span className="text-sm opacity-80">{draft.image ? 'Photo Attached' : 'Attach Evidence'}</span>
                    </div>
                    <input
                        type="file"
                        className="file-input file-input-sm file-input-ghost w-full max-w-xs"
                        accept="image/*"
                        onChange={e => updateDraft({ image: e.target.files?.[0] })}
                    />
                </div>
            </div>

            <div className="flex justify-between mt-8">
                <button className="btn btn-ghost" onClick={onBack}>Back</button>
                <button className="btn btn-primary px-8" onClick={handleNext}>Review <ArrowRight className="w-4 h-4" /></button>
            </div>
        </motion.div>
    );
};
