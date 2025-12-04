import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RoleRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (user.role === "CITIZEN") {
      navigate("/citizen", { replace: true });
    } else if (user.role === "AGENCY_STAFF") {
      navigate("/agency", { replace: true });
    } else if (user.role === "ADMIN") {
      navigate("/admin", { replace: true });
    }
  }, [user, loading, navigate]);

  return <div className="flex items-center justify-center h-screen">Redirecting…</div>;
};

export default RoleRedirect;
