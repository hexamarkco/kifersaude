import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import LandingPage from './pages/LandingPage';
import BlogPage from './pages/BlogPage';
import PainelPage from './pages/PainelPage';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/painel"
            element={
              <ProtectedRoute>
                <ConfigProvider>
                  <PainelPage />
                </ConfigProvider>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.info('Service worker registrado', registration.scope);
      })
      .catch((error) => {
        console.error('Falha ao registrar o service worker', error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
