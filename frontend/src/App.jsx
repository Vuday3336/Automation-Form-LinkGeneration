import { Routes, Route } from 'react-router';
import SystemStatusPage from './pages/SystemStatusPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

// The route table: which page component renders for which URL.
// Phase 7 adds login, dashboard, submissions and the other pages here.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SystemStatusPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
