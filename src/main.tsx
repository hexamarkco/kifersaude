import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import LandingPage from './pages/LandingPage';
import ConversionLandingPage from './pages/ConversionLandingPage';
import BlogPage from './pages/BlogPage';
import PainelWrapper from './pages/PainelWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardWrapper from './pages/routes/DashboardWrapper';
import LeadsManagerWrapper from './pages/routes/LeadsManagerWrapper';
import ContractsManagerWrapper from './pages/routes/ContractsManagerWrapper';
import RemindersManagerEnhanced from './components/RemindersManagerEnhanced';
import BlogTab from './components/config/BlogTab';
import WhatsAppTab from './components/communication/WhatsAppTab';
import ConfigPage from './pages/ConfigPage';
import FinanceiroComissoesTab from './components/finance/FinanceiroComissoesTab';
import FinanceiroAgendaTab from './components/finance/FinanceiroAgendaTab';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
<Route path="/" element={<LandingPage />} />
          <Route path="/lp" element={<ConversionLandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/painel"
            element={
              <ProtectedRoute>
                <ConfigProvider>
                  <PainelWrapper />
                </ConfigProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/painel/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardWrapper />} />
            <Route path="leads" element={<LeadsManagerWrapper />} />
            <Route path="contratos" element={<ContractsManagerWrapper />} />
            <Route path="comissoes" element={<FinanceiroComissoesTab />} />
            <Route path="tarefas" element={<FinanceiroAgendaTab />} />
            <Route path="lembretes" element={<RemindersManagerEnhanced />} />
            <Route path="whatsapp" element={<WhatsAppTab />} />
            <Route path="blog" element={<BlogTab />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
