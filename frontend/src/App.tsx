import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Shell } from './components/chrome';
import { useAuth } from './stores/auth';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import RunsPage from './pages/runs';
import RunDetailPage from './pages/run-detail';
import NewRunPage from './pages/new-run';
import MeshesPage from './pages/meshes';
import MeshDetailPage from './pages/mesh-detail';
import GeometriesPage from './pages/geometries';
import SweepPage from './pages/sweep';
import ComparePage from './pages/compare';
import TemplatesPage from './pages/templates';
import GroupsPage from './pages/groups';
import NotFoundPage from './pages/not-found';

function Protected({ children }: { children: ReactNode }) {
  const authed = useAuth((s) => s.isAuthenticated);
  const location = useLocation();
  if (!authed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/runs" element={<Protected><RunsPage /></Protected>} />
      <Route path="/runs/new" element={<Protected><NewRunPage /></Protected>} />
      <Route path="/runs/:id" element={<Protected><RunDetailPage /></Protected>} />
      <Route path="/meshes" element={<Protected><MeshesPage /></Protected>} />
      <Route path="/meshes/:id" element={<Protected><MeshDetailPage /></Protected>} />
      <Route path="/geometries" element={<Protected><GeometriesPage /></Protected>} />
      <Route path="/sweep" element={<Protected><SweepPage /></Protected>} />
      <Route path="/compare" element={<Protected><ComparePage /></Protected>} />
      <Route path="/templates" element={<Protected><TemplatesPage /></Protected>} />
      <Route path="/groups" element={<Protected><GroupsPage /></Protected>} />
      <Route path="*" element={<Protected><NotFoundPage /></Protected>} />
    </Routes>
  );
}
