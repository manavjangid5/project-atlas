import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./app/ErrorBoundary";
import RequireAuth from "./app/RequireAuth";
import RedirectIfAuthed from "./app/RedirectIfAuthed";
import DashboardLayout from "./app/DashboardLayout";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import SharePage from "./features/files/SharePage";
import AcceptInvitePage from "./features/organizations/AcceptInvitePage";

const WorkflowsPage = lazy(() => import("./features/workflows/WorkflowsPage"));
const FormsPage = lazy(() => import("./features/forms/FormsPage"));
const RulesPage = lazy(() => import("./features/rules/RulesPage"));
const AnalyticsPage = lazy(() => import("./features/analytics/AnalyticsPage"));
const FilesPage = lazy(() => import("./features/files/FilesPage"));
const ApiKeysPage = lazy(() => import("./features/apiKeys/ApiKeysPage"));
const FeatureFlagsPage = lazy(() => import("./features/featureFlags/FeatureFlagsPage"));
const AuditLogPage = lazy(() => import("./features/audit/AuditLogPage"));
const MembersPage = lazy(() => import("./features/organizations/MembersPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));

function PageFallback() {
  return <div className="p-8 text-muted text-sm">Loading…</div>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<RedirectIfAuthed />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route path="/share/:token" element={<SharePage />} />
            <Route path="/invitations/:token/accept" element={<AcceptInvitePage />} />

            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Navigate to="workflows" />} />
                <Route path="workflows" element={<WorkflowsPage />} />
                <Route path="forms" element={<FormsPage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="files" element={<FilesPage />} />
                <Route path="api-keys" element={<ApiKeysPage />} />
                <Route path="feature-flags" element={<FeatureFlagsPage />} />
                <Route path="audit" element={<AuditLogPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}