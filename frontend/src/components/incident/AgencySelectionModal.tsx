
import React, { useEffect, useState } from 'react';
import { X, Search, Building2, User, Send } from 'lucide-react';
import api from '../../lib/api';

type Agency = {
    id: number;
    name: string;
    type: string;
    city: string | null;
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (agencyId: number, reason: string, note: string) => void;
    isLoading?: boolean;
}

const AgencySelectionModal: React.FC<Props> = ({ isOpen, onClose, onSelect, isLoading }) => {
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [loadingAgencies, setLoadingAgencies] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchAgencies();
        }
    }, [isOpen]);

    const fetchAgencies = async () => {
        setLoadingAgencies(true);
        try {
            const res = await (api as any).getAgencies();
            setAgencies(res.data.agencies || []);
        } catch (err) {
            console.error('Failed to fetch agencies', err);
        } finally {
            setLoadingAgencies(false);
        }
    };

    const filteredAgencies = agencies.filter((agency) =>
        agency.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAgencyId && reason) {
            onSelect(selectedAgencyId, reason, note);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <Building2 className="text-cyan-400" size={20} />
                        Request Agency Assistance
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 space-y-4 overflow-y-auto">
                        {/* Search Agencies */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Select Agency</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search agencies..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    autoFocus
                                />
                            </div>

                            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border border-slate-700 rounded-lg bg-slate-800/50 p-1">
                                {loadingAgencies ? (
                                    <div className="p-2 text-center text-slate-500 text-sm">Loading...</div>
                                ) : filteredAgencies.length === 0 ? (
                                    <div className="p-2 text-center text-slate-500 text-sm">No agencies found</div>
                                ) : (
                                    filteredAgencies.map((agency) => (
                                        <div
                                            key={agency.id}
                                            onClick={() => setSelectedAgencyId(agency.id)}
                                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${selectedAgencyId === agency.id
                                                ? 'bg-cyan-500/20 border border-cyan-500/50'
                                                : 'hover:bg-slate-700/50 border border-transparent'
                                                }`}
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-100">{agency.name}</div>
                                                <div className="text-xs text-slate-400">
                                                    {agency.type} • {agency.city || 'N/A'}
                                                </div>
                                            </div>
                                            {selectedAgencyId === agency.id && (
                                                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Reason */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">
                                Reason for Request <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                required
                            >
                                <option value="">Select reason...</option>
                                <option value="Specialized Equipment Required">Specialized Equipment Required</option>
                                <option value="Additional Manpower Needed">Additional Manpower Needed</option>
                                <option value="Jurisdictional Handoff">Jurisdictional Handoff</option>
                                <option value="Medical Evacuation Support">Medical Evacuation Support</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Note */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Additional Notes</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Describe current situation and specific needs..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[80px]"
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedAgencyId || !reason || isLoading}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg shadow-cyan-500/20"
                        >
                            {isLoading ? 'Sending...' : 'Send Request'}
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AgencySelectionModal;
