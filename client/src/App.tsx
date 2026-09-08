import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppHeader } from './components/AppHeader';
import { EmptyState } from './components/States';
import ProblemListPage from './pages/ProblemListPage';
import WorkspacePage from './pages/WorkspacePage';

export default function App() {
  return (
    <BrowserRouter>
      <AppHeader />
      <main>
        <Routes>
          <Route path="/" element={<ProblemListPage />} />
          <Route path="/problems/:problemId" element={<WorkspacePage />} />
          <Route
            path="/404"
            element={<EmptyState title="Page not found">That route does not exist.</EmptyState>}
          />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
