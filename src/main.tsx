import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import HomePage from './pages/public/HomePage';
import SobrePage from './pages/public/SobrePage';
import ComoFuncionaPage from './pages/public/ComoFuncionaPage';
import PlanosPage from './pages/public/PlanosPage';
import PlanosPessoaFisicaPage from './pages/public/PlanosPessoaFisicaPage';
import PlanosFamiliaPage from './pages/public/PlanosFamiliaPage';
import PlanosMeiCnpjPage from './pages/public/PlanosMeiCnpjPage';
import PlanosSeniorPage from './pages/public/PlanosSeniorPage';
import OperadorasPage from './pages/public/OperadorasPage';
import PortabilidadePage from './pages/public/PortabilidadePage';
import DepoimentosPage from './pages/public/DepoimentosPage';
import FaqPage from './pages/public/FaqPage';
import ContatoPage from './pages/public/ContatoPage';
import PoliticaPrivacidadePage from './pages/public/PoliticaPrivacidadePage';
import TermosUsoPage from './pages/public/TermosUsoPage';
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
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
