import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ReportWizardProvider } from '../features/reporting/ReportWizardContext';
import { CategoryStep } from '../features/reporting/steps/CategoryStep';
import { LocationStep } from '../features/reporting/steps/LocationStep';
import { DetailsStep } from '../features/reporting/steps/DetailsStep';
import { ReviewStep } from '../features/reporting/steps/ReviewStep';

import { useAuth } from '../context/AuthContext';

const WizardFlow: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const { user } = useAuth();

  const handleClose = () => {
    if (user) {
      navigate('/citizen/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="fixed inset-0 bg-base-300 z-[9999] overflow-y-auto">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-base-300/80 backdrop-blur">
        <button onClick={handleClose} className="btn btn-circle btn-ghost">
          <X />
        </button>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 w-8 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-base-content/10'}`}
            />
          ))}
        </div>
        <div className="w-10"></div>
      </div>

      <div className="min-h-screen flex items-center justify-center p-4 pt-20">
        <AnimatePresence mode="wait">
          {step === 1 && <CategoryStep key="step1" onNext={() => setStep(2)} />}
          {step === 2 && (
            <LocationStep key="step2" onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <DetailsStep key="step3" onNext={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && <ReviewStep key="step4" onBack={() => setStep(3)} />}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ReportIncidentWizard: React.FC = () => {
  return (
    <ReportWizardProvider>
      <WizardFlow />
    </ReportWizardProvider>
  );
};

export default ReportIncidentWizard;
