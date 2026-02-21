import React, { useEffect, useState } from 'react';
import AppLayout from '../../layouts/AppLayout';
import api from '../../lib/api';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface StaffMember {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  agencyStaff?: {
    agencyId: number;
    staffRole: 'DISPATCHER' | 'RESPONDER' | 'SUPERVISOR';
  };
  // Fallback if needed but API returns flattened User with agencyStaff relation
  staffRole?: 'DISPATCHER' | 'RESPONDER' | 'SUPERVISOR';
  userId?: number;
  user?: any; // For backward compat just in case
}

import { Toaster, toast } from 'react-hot-toast';
import AddStaffModal from '../../components/modals/AddStaffModal';

const StaffManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state moved to AddStaffModal, except for list refresh trigger

  const fetchStaff = async () => {
    try {
      const res = await api.get('/agency/users');
      setStaff(res.data.staff || res.data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const toggleStatus = async (userId: number, currentStatus: boolean) => {
    if (currentStatus && !confirm('Are you sure you want to deactivate this staff member?')) return;

    // Store original copy to revert on failure
    const previousStaff = [...staff];

    // Optmistically toggle local state
    setStaff((prev) =>
      prev.map((member) =>
        member.id === userId ? { ...member, isActive: !currentStatus } : member,
      ),
    );

    try {
      await api.patch(`/agency/users/${userId}`, { isActive: !currentStatus });
      toast.success(
        currentStatus ? 'Staff deactivated successfully' : 'Staff activated successfully',
      );
    } catch (error: any) {
      // Revert optimism
      setStaff(previousStaff);
      const msg = error.response?.data?.message || 'Failed to update status';
      toast.error(msg);
      console.error(error);
    }
  };

  const deleteStaff = async (userId: number) => {
    if (
      !confirm(
        'Are you absolutely sure you want to permanently delete this staff member? This will anonymize their audit history.',
      )
    )
      return;
    try {
      await api.delete(`/agency/users/${userId}`);
      fetchStaff();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete staff');
    }
  };

  return (
    <AppLayout>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
        }}
      />

      <AddStaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchStaff}
      />

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

        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="table w-full">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Contact</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : !staff || staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                staff?.map((member) => (
                  <tr
                    key={member.userId}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="font-medium text-white p-4">
                      {member.fullName || member.user?.fullName}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold
                                        ${
                                          (member.agencyStaff?.staffRole || member.staffRole) ===
                                          'SUPERVISOR'
                                            ? 'bg-purple-900/50 text-purple-200 border border-purple-700'
                                            : (member.agencyStaff?.staffRole ||
                                                  member.staffRole) === 'DISPATCHER'
                                              ? 'bg-blue-900/50 text-blue-200 border border-blue-700'
                                              : 'bg-green-900/50 text-green-200 border border-green-700'
                                        }`}
                      >
                        {member.agencyStaff?.staffRole || member.staffRole}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-200">
                        {member.email || member.user?.email}
                      </div>
                      <div className="text-xs text-slate-500">
                        {member.phone || member.user?.phone}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={member.isActive ? 'text-green-400' : 'text-red-400'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4">
                      {/* Badge Logic already present? No, rewriting explicit status cell above */}
                      {/* Ah, I am replacing the cell content actually. */}
                      {/* Wait, the previous code had text. The user wants a "Badge". */}
                      <div
                        className={`badge ${member.isActive ? 'badge-success gap-2' : 'badge-error gap-2'} badge-outline`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${member.isActive ? 'bg-success' : 'bg-error'}`}
                        ></div>
                        {member.isActive ? 'Active' : 'Deactivated'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {member.userId !== user?.id && (
                          <>
                            <input
                              type="checkbox"
                              className="toggle toggle-success toggle-sm"
                              checked={member.isActive}
                              onChange={() => toggleStatus(member.id, member.isActive)}
                              title={member.isActive ? 'Deactivate User' : 'Activate User'}
                            />

                            {!member.isActive && (
                              <button
                                className="btn btn-xs btn-ghost text-error hover:bg-error/20"
                                onClick={() => deleteStaff(member.id)}
                                title="Delete Staff Member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
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
