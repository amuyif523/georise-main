import React, { useEffect, useState } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../lib/api';
import { Users, UserPlus } from 'lucide-react';

interface StaffMember {
  userId: number;
  agencyId: number;
  staffRole: 'DISPATCHER' | 'RESPONDER' | 'SUPERVISOR';
  isActive: boolean;
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
  };
}

const StaffManagementPage: React.FC = () => {
  // const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    staffRole: 'RESPONDER',
  });

  const fetchStaff = async () => {
    try {
      const res = await api.get('/agency/staff');
      setStaff(res.data.staff);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/agency/staff', formData);
      alert('Staff added successfully');
      setIsModalOpen(false);
      setFormData({ fullName: '', email: '', phone: '', staffRole: 'RESPONDER' });
      fetchStaff();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add staff');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Users className="w-5 h-5" />
            Agency Staff ({staff.length})
          </h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff
          </button>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 text-black">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-200 text-left">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Staff Member</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    className="input input-bordered w-full bg-white text-gray-900 border-gray-300"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    className="input input-bordered w-full bg-white text-gray-900 border-gray-300"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    className="input input-bordered w-full bg-white text-gray-900 border-gray-300"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <select
                    className="select select-bordered w-full bg-white text-gray-900 border-gray-300"
                    value={formData.staffRole}
                    onChange={(e) => setFormData({ ...formData, staffRole: e.target.value })}
                  >
                    <option value="RESPONDER">Responder</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="SUPERVISOR">Supervisor</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-ghost text-gray-500"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="table w-full">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr
                    key={member.userId}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="font-medium text-white p-4">{member.user.fullName}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold
                                        ${
                                          member.staffRole === 'SUPERVISOR'
                                            ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                                            : member.staffRole === 'DISPATCHER'
                                              ? 'bg-blue-900/50 text-blue-200 border border-blue-700'
                                              : 'bg-green-900/50 text-green-200 border border-green-700'
                                        }`}
                      >
                        {member.staffRole}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-200">{member.user.email}</div>
                      <div className="text-xs text-slate-500">{member.user.phone}</div>
                    </td>
                    <td className="p-4">
                      <span className={member.isActive ? 'text-green-400' : 'text-red-400'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default StaffManagementPage;
