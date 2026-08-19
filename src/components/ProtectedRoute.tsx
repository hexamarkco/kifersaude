import { useAuth } from '../contexts/AuthContext';
import { AppLoadingScreen } from '../design-system';
import LoginPage from '../pages/LoginPage';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
