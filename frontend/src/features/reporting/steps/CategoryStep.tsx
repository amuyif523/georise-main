import React from 'react';
import { motion } from 'framer-motion';
import { Car, Flame, AlertTriangle, Zap } from 'lucide-react';
import { useReportContext } from '../ReportWizardContext';

export const CategoryStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
    const { updateDraft } = useReportContext();

    const categories = [
        { id: 'ACCIDENT', label: 'Traffic Accident', icon: <Car className="w-8 h-8" />, color: 'bg-orange-500' },
        { id: 'FIRE', label: 'Fire Emergency', icon: <Flame className="w-8 h-8" />, color: 'bg-red-600' },
        { id: 'CRIME', label: 'Criminal Activity', icon: <AlertTriangle className="w-8 h-8" />, color: 'bg-blue-600' },
        { id: 'INFRASTRUCTURE', label: 'Infrastructure', icon: <Zap className="w-8 h-8" />, color: 'bg-yellow-500' },
        { id: 'OTHER', label: 'Other Hazard', icon: <AlertTriangle className="w-8 h-8" />, color: 'bg-gray-500' },
    ];

    const handleSelect = (id: string) => {
        updateDraft({ category: id });
        onNext();
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg mx-auto"
        >
            <h2 className="text-3xl font-bold text-center mb-8">What's the emergency?</h2>
            <div className="grid grid-cols-2 gap-4">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => handleSelect(cat.id)}
                        className="card bg-base-100 border border-base-content/5 hover:border-primary hover:scale-[1.02] transition-all p-6 flex flex-col items-center gap-4 group"
                    >
                        <div className={`p-4 rounded-full text-white shadow-lg group-hover:animate-pulse ${cat.color}`}>
                            {cat.icon}
                        </div>
                        <span className="font-bold">{cat.label}</span>
                    </button>
                ))}
            </div>
        </motion.div>
    );
};
