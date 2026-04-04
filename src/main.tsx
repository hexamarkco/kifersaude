import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import ToastViewport from './components/ui/ToastViewport';
import {
  BlogTab,
  ConfigPage,
  ContractsManagerWrapper,
  CotadorWrapper,
  DashboardWrapper,
  FinanceiroAgendaTab,
  FinanceiroComissoesTab,
  HomePage,
  LeadsManagerWrapper,
  LoginPage,
  PainelWrapper,
  ProtectedRoute,
  RouteLoading,
  WhatsAppInboxWrapper,
} from './routes/lazyRouteComponents';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/planos" element={<Navigate to="/" replace />} />
            <Route path="/lp" element={<Navigate to="/" replace />} />
            <Route path="/lp/*" element={<Navigate to="/" replace />} />
            <Route path="/cotacao" element={<Navigate to="/" replace />} />
            <Route path="/operadoras" element={<Navigate to="/" replace />} />
            <Route path="/como-funciona" element={<Navigate to="/" replace />} />
            <Route path="/depoimentos" element={<Navigate to="/" replace />} />
            <Route path="/faq" element={<Navigate to="/" replace />} />
            <Route path="/planos/*" element={<Navigate to="/" replace />} />
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
              <Route path="cotador" element={<CotadorWrapper />} />
              <Route path="contratos" element={<ContractsManagerWrapper />} />
              <Route path="comissoes" element={<FinanceiroComissoesTab />} />
              <Route path="agenda" element={<FinanceiroAgendaTab />} />
              <Route path="inbox" element={<WhatsAppInboxWrapper />} />
              <Route path="tarefas" element={<Navigate to="/painel/agenda" replace />} />
              <Route path="lembretes" element={<Navigate to="/painel/agenda" replace />} />
              <Route path="blog" element={<BlogTab />} />
              <Route path="config" element={<ConfigPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <ToastViewport />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
