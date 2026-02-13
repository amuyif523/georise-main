import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import './i18n'; // Initialize i18n
import ProtectedRoute from './components/ProtectedRoute';
import OnlineStatusBanner from './components/OnlineStatusBanner';
import NotificationManager from './components/NotificationManager';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { registerSW } from 'virtual:pwa-register';
import AdminDashboard from './pages/AdminDashboard';
import AgencyDashboard from './pages/AgencyDashboard';
import CitizenDashboard from './pages/CitizenDashboard';
import MyReportsPage from './pages/MyReportsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ReportIncidentWizard from './pages/ReportIncidentWizard';
import ReportHazardPage from './pages/ReportHazardPage';
import RoleRedirect from './pages/RoleRedirect';
import { SystemProvider } from './context/SystemContext';
import CrisisBanner from './components/CrisisBanner';
import BroadcastModal from './components/BroadcastModal';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SyncManager from './components/SyncManager';

const AgencyMap = React.lazy(() => import('./pages/AgencyMap'));
const AgenciesPage = React.lazy(() => import('./pages/admin/AgenciesPage'));
const SystemPage = React.lazy(() => import('./pages/admin/SystemPage'));
const UsersPage = React.lazy(() => import('./pages/admin/UsersPage'));
const AuditLogsPage = React.lazy(() => import('./pages/admin/AuditLogsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/admin/AnalyticsPage'));
const ActivityFeed = React.lazy(() => import('./pages/admin/ActivityFeed'));
const AdminDemoControlPage = React.lazy(() => import('./pages/admin/AdminDemoControlPage'));
const AgencyAnalyticsPage = React.lazy(() => import('./pages/AgencyAnalyticsPage'));
const StaffManagementPage = React.lazy(() => import('./pages/agency/StaffManagementPage'));
const CitizenVerificationPage = React.lazy(() => import('./pages/CitizenVerificationPage'));
const ReviewQueuePage = React.lazy(() => import('./pages/admin/ReviewQueuePage'));
const VerificationPage = React.lazy(() => import('./pages/admin/VerificationPage'));
const SystemStatusPage = React.lazy(() => import('./pages/admin/SystemStatusPage'));
import LandingPage from './pages/LandingPage';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of GEORISE is available. Reload now?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('PWA offline cache ready');
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <SystemProvider>
        <NotificationProvider>
          <BrowserRouter>
            <OnlineStatusBanner />
            {/* NotificationManager is now redundant or can be updated to use Context logic for handling 'received' alerts if needed, but Context handles subscription */}
            <NotificationManager />
            <SyncManager />
            <CrisisBanner />
            <BroadcastModal />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/report" element={<ReportIncidentWizard />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                  <ProtectedRoute allowedRoles={['CITIZEN']}>
                    <CitizenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/citizen/report"
                element={
                  <ProtectedRoute allowedRoles={['CITIZEN']}>
                    <ReportIncidentWizard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/citizen/report-hazard"
                element={
                  <ProtectedRoute allowedRoles={['CITIZEN']}>
                    <ReportHazardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/citizen/my-reports"
                element={
                  <ProtectedRoute allowedRoles={['CITIZEN']}>
                    <MyReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/citizen/verify"
                element={
                  <ProtectedRoute allowedRoles={['CITIZEN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading…</div>}>
                      <CitizenVerificationPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/agency"
                element={
                  <ProtectedRoute allowedRoles={['AGENCY_STAFF', 'ADMIN']}>
                    <AgencyDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agency/map"
                element={
                  <ProtectedRoute allowedRoles={['AGENCY_STAFF', 'ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading map…</div>}>
                      <AgencyMap />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agency/analytics"
                element={
                  <ProtectedRoute allowedRoles={['AGENCY_STAFF', 'ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading analytics…</div>}
                    >
                      <AgencyAnalyticsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agency/staff"
                element={
                  <ProtectedRoute allowedRoles={['AGENCY_STAFF', 'ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading staff management…</div>}
                    >
                      <StaffManagementPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/agencies"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading agencies…</div>}
                    >
                      <AgenciesPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading users…</div>}>
                      <UsersPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading audit…</div>}>
                      <AuditLogsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading analytics…</div>}
                    >
                      <AnalyticsPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/system-status"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading system status…</div>}
                    >
                      <SystemStatusPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/activity"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense
                      fallback={<div className="p-4 text-slate-200">Loading activity…</div>}
                    >
                      <ActivityFeed />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/review"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading review…</div>}>
                      <ReviewQueuePage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/verification"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading…</div>}>
                      <VerificationPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/system"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading...</div>}>
                      <SystemPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/demo"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Suspense fallback={<div className="p-4 text-slate-200">Loading…</div>}>
                      <AdminDemoControlPage />
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
        </NotificationProvider>
      </SystemProvider>
    </AuthProvider>
  </React.StrictMode>,
);
