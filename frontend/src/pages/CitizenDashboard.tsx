import React from "react";
import { useAuth } from "../context/AuthContext";

const CitizenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Citizen Dashboard</h1>
        <button className="btn btn-outline btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
      <p>Welcome, {user?.fullName}. Here you will see incident reporting and “My Reports”.</p>
    </div>
  );
};

export default CitizenDashboard;
