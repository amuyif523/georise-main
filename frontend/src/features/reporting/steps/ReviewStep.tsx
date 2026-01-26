import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useReportContext } from '../ReportWizardContext';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { addToIncidentQueue } from '../../../offline/incidentQueue';

import { useAuth } from '../../../context/AuthContext';

export const ReviewStep: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { draft, clearDraft } = useReportContext();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async () => {
    // ... existing logic ...
    setSubmitting(true);
    try {
      // Construct clean payload (remove image/File object and internal flags)
      const payload = {
        title: draft.title,
        description: draft.description,
        category: draft.category || undefined, // Send undefined if empty string
        latitude: draft.latitude,
        longitude: draft.longitude,
        isReporterAtScene: !draft.notAtScene,
      };

      console.log('Submitting Payload:', payload);

      try {
        // Online submit
        const res = await api.post('/incidents', payload);
        if (res.data?.incident?.id && draft.image) {
          const fd = new FormData();
          fd.append('photo', draft.image);
          await api.post(`/incidents/${res.data.incident.id}/photos`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      } catch {
        // Offline fallback
        await addToIncidentQueue(payload);
      }
      clearDraft();
      if (user) {
        navigate('/citizen/my-reports');
      } else {
        alert('Report submitted successfully. Thank you.'); // Simple feedback for guest
        navigate('/');
      }
    } catch (e) {
      console.error(e);
      alert('Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Confirm Transmission</h2>
        <p className="text-sm opacity-60">Ready to dispatch to command?</p>
      </div>

      <div className="card bg-base-200 p-6 space-y-4 mb-8 text-sm">
        <div className="flex justify-between border-b border-base-content/10 pb-2">
          <span className="opacity-60">Type</span>
          <span className="font-bold">{draft.category}</span>
        </div>
        <div className="flex justify-between border-b border-base-content/10 pb-2">
          <span className="opacity-60">Location</span>
          <span className="font-mono">
            {draft.latitude?.toFixed(4)}, {draft.longitude?.toFixed(4)}
          </span>
        </div>
        <div>
          <span className="opacity-60 block mb-1">Report</span>
          <p className="font-medium">{draft.title}</p>
        </div>
      </div>

      <button
        className="btn btn-primary w-full h-14 text-lg shadow-xl shadow-primary/20"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <span className="loading loading-spinner"></span> : 'TRANSMIT NOW'}
      </button>
      <button className="btn btn-ghost w-full mt-2" onClick={onBack} disabled={submitting}>
        Edit Details
      </button>
    </motion.div>
  );
};
