import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./features/auth/LoginPage";
import DashboardLayout from "./app/DashboardLayout";
import WorkflowsPage from "./features/workflows/WorkflowsPage";
import FormsPage from "./features/forms/FormsPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import MembersPage from "./features/organizations/MembersPage";
import SettingsPage from "./features/settings/SettingsPage";
import AuditLogPage from "./features/audit/AuditLogPage";
import RulesPage from "./features/rules/RulesPage";
import FilesPage from "./features/files/FilesPage";
import ApiKeysPage from "./features/apiKeys/ApiKeysPage";
import FeatureFlagsPage from "./features/featureFlags/FeatureFlagsPage";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="workflows" />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="forms" element={<FormsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="feature-flags" element={<FeatureFlagsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}