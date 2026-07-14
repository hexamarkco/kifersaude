import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../design-system';
import LoginPage from '../pages/LoginPage';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)]">
        <LoadingState className="min-h-screen" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
