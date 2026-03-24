import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('CITIZEN' | 'AGENCY_STAFF' | 'AGENCY_MANAGER' | 'ADMIN')[];
  allowPasswordSetup?: boolean;
}

const PASSWORD_SETUP_PATH = '/auth/setup-password';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  allowPasswordSetup = false,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    if (allowPasswordSetup) {
      return children;
    }

    return (
      <Navigate
        to={PASSWORD_SETUP_PATH}
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (allowPasswordSetup) {
    return <Navigate to="/redirect-after-login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-8 text-center">You do not have access to this page.</div>;
  }

  return children;
};

export default ProtectedRoute;
