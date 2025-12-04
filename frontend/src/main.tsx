import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import CitizenDashboard from "./pages/CitizenDashboard";
import MyReportsPage from "./pages/MyReportsPage";
import LoginPage from "./pages/LoginPage";
import ReportIncidentWizard from "./pages/ReportIncidentWizard";
import RoleRedirect from "./pages/RoleRedirect";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/redirect-after-login"
            element={
              <ProtectedRoute>
                <RoleRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizen"
            element={
              <ProtectedRoute allowedRoles={["CITIZEN"]}>
                <CitizenDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizen/report"
            element={
              <ProtectedRoute allowedRoles={["CITIZEN"]}>
                <ReportIncidentWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizen/my-reports"
            element={
              <ProtectedRoute allowedRoles={["CITIZEN"]}>
                <MyReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agency"
            element={
              <ProtectedRoute allowedRoles={["AGENCY_STAFF"]}>
                <AgencyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <RoleRedirect />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
