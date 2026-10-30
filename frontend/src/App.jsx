import { Routes, Route } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SubmissionsPage from './pages/SubmissionsPage.jsx';
import SubmissionDetailPage from './pages/SubmissionDetailPage.jsx';
import HospitalsPage from './pages/HospitalsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import IntegrationPage from './pages/IntegrationPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SystemStatusPage from './pages/SystemStatusPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// The route table: which page renders for which URL.
// Everything inside <ProtectedRoute> requires login; some pages also require a permission.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/status" element={<SystemStatusPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="submissions/secure/:token" element={<SubmissionDetailPage />} />
          <Route path="submissions/:submissionId" element={<SubmissionDetailPage />} />
          <Route path="hospitals" element={<ProtectedRoute permission="manageUsers"><HospitalsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute permission="manageUsers"><UsersPage /></ProtectedRoute>} />
          <Route path="audit-logs" element={<ProtectedRoute permission="viewAuditLogs"><AuditLogsPage /></ProtectedRoute>} />
          <Route path="integration" element={<ProtectedRoute permission="manageIntegration"><IntegrationPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
