import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import {
  HomePage,
  SobrePage,
  ComoFuncionaPage,
  PlanosPage,
  PlanosPessoaFisicaPage,
  PlanosFamiliaPage,
  PlanosMeiCnpjPage,
  PlanosSeniorPage,
  OperadorasPage,
  PortabilidadePage,
  RioDeJaneiroPage,
  NiteroiPage,
  SaoGoncaloPage,
  BaixadaFluminensePage,
  DepoimentosPage,
  FaqPage,
  ContatoPage,
  PoliticaPrivacidadePage,
  TermosUsoPage,
  LandingPage,
  ConversionLandingPage,
  BlogPage,
  PainelWrapper,
  ProtectedRoute,
  LoginPage,
  DashboardWrapper,
  LeadsManagerWrapper,
  ContractsManagerWrapper,
  RemindersManagerEnhanced,
  BlogTab,
  WhatsAppTab,
  ConfigPage,
  FinanceiroComissoesTab,
  FinanceiroAgendaTab,
  RouteLoading,
} from './routes/lazyRouteComponents';
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
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/sobre" element={<SobrePage />} />
            <Route path="/como-funciona" element={<ComoFuncionaPage />} />
            <Route path="/planos" element={<PlanosPage />} />
            <Route path="/planos/pessoa-fisica" element={<PlanosPessoaFisicaPage />} />
            <Route path="/planos/familia" element={<PlanosFamiliaPage />} />
            <Route path="/planos/mei-cnpj" element={<PlanosMeiCnpjPage />} />
            <Route path="/planos/senior" element={<PlanosSeniorPage />} />
            <Route path="/operadoras" element={<OperadorasPage />} />
            <Route path="/portabilidade" element={<PortabilidadePage />} />
            <Route path="/rio-de-janeiro" element={<RioDeJaneiroPage />} />
            <Route path="/niteroi" element={<NiteroiPage />} />
            <Route path="/sao-goncalo" element={<SaoGoncaloPage />} />
            <Route path="/baixada-fluminense" element={<BaixadaFluminensePage />} />
            <Route path="/depoimentos" element={<DepoimentosPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/contato" element={<ContatoPage />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
            <Route path="/termos-de-uso" element={<TermosUsoPage />} />
            <Route path="/cotacao" element={<LandingPage />} />
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
