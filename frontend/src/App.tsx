import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { AppLayout } from '@/components/layout/app-layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { NewJobPage } from '@/pages/new-job';
import { JobsPage } from '@/pages/jobs';
import { JobDetailPage } from '@/pages/job-detail';
import { GeometriesPage } from '@/pages/geometries';
import { TemplatesPage } from '@/pages/templates';
import { TemplateDetailPage } from '@/pages/template-detail';
import { ComparePage } from '@/pages/compare';
import { SweepPage } from '@/pages/sweep';
import { MeshesPage } from '@/pages/meshes';
import { MeshDetailPage } from '@/pages/mesh-detail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AppInit({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [hydrate]);
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new-job" element={<NewJobPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/geometries" element={<GeometriesPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/templates/:id" element={<TemplateDetailPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/sweep" element={<SweepPage />} />
              <Route path="/meshes" element={<MeshesPage />} />
              <Route path="/meshes/:id" element={<MeshDetailPage />} />
            </Route>
          </Routes>
        </AppInit>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
