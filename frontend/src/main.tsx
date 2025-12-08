import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import ProtectedRoute from "./components/ProtectedRoute";
import OnlineStatusBanner from "./components/OnlineStatusBanner";
import { AuthProvider } from "./context/AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import CitizenDashboard from "./pages/CitizenDashboard";
import MyReportsPage from "./pages/MyReportsPage";
import LoginPage from "./pages/LoginPage";
import ReportIncidentWizard from "./pages/ReportIncidentWizard";
import RoleRedirect from "./pages/RoleRedirect";
const AgencyMap = React.lazy(() => import("./pages/AgencyMap"));
const AgenciesPage = React.lazy(() => import("./pages/admin/AgenciesPage"));
const UsersPage = React.lazy(() => import("./pages/admin/UsersPage"));
const AuditLogsPage = React.lazy(() => import("./pages/admin/AuditLogsPage"));
const AnalyticsPage = React.lazy(() => import("./pages/admin/AnalyticsPage"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <OnlineStatusBanner />
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
            path="/agency/map"
            element={
              <ProtectedRoute allowedRoles={["AGENCY_STAFF"]}>
                <Suspense fallback={<div className="p-4 text-slate-200">Loading map…</div>}>
                  <AgencyMap />
                </Suspense>
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
            path="/admin/agencies"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Suspense fallback={<div className="p-4 text-slate-200">Loading agencies…</div>}>
                  <AgenciesPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Suspense fallback={<div className="p-4 text-slate-200">Loading users…</div>}>
                  <UsersPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Suspense fallback={<div className="p-4 text-slate-200">Loading audit…</div>}>
                  <AuditLogsPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Suspense fallback={<div className="p-4 text-slate-200">Loading analytics…</div>}>
                  <AnalyticsPage />
                </Suspense>
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
