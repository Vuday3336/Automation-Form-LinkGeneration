import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../lib/permissions.js';
import { FullPageSpinner, ErrorState } from './ui/Feedback.jsx';

// Wraps pages that need login (and optionally a permission).
// Not logged in → go to /login?next=<this page>, and come back here after logging in.
// That's how a secure link survives the login step.
export default function ProtectedRoute({ permission, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <FullPageSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (permission && !can(user, permission)) {
    return <ErrorState title="Access denied" message="Your role doesn't have access to this page." />;
  }
  return children ?? <Outlet />;
}
