import { lazy } from 'react';

export const HomePage = lazy(() => import('../pages/public/HomePage'));
export const SobrePage = lazy(() => import('../pages/public/SobrePage'));
export const ComoFuncionaPage = lazy(() => import('../pages/public/ComoFuncionaPage'));
export const PlanosPage = lazy(() => import('../pages/public/PlanosPage'));
export const PlanosPessoaFisicaPage = lazy(() => import('../pages/public/PlanosPessoaFisicaPage'));
export const PlanosFamiliaPage = lazy(() => import('../pages/public/PlanosFamiliaPage'));
export const PlanosMeiCnpjPage = lazy(() => import('../pages/public/PlanosMeiCnpjPage'));
export const PlanosSeniorPage = lazy(() => import('../pages/public/PlanosSeniorPage'));
export const OperadorasPage = lazy(() => import('../pages/public/OperadorasPage'));
export const PortabilidadePage = lazy(() => import('../pages/public/PortabilidadePage'));
export const RioDeJaneiroPage = lazy(() => import('../pages/public/RioDeJaneiroPage'));
export const NiteroiPage = lazy(() => import('../pages/public/NiteroiPage'));
export const SaoGoncaloPage = lazy(() => import('../pages/public/SaoGoncaloPage'));
export const BaixadaFluminensePage = lazy(() => import('../pages/public/BaixadaFluminensePage'));
export const DepoimentosPage = lazy(() => import('../pages/public/DepoimentosPage'));
export const FaqPage = lazy(() => import('../pages/public/FaqPage'));
export const ContatoPage = lazy(() => import('../pages/public/ContatoPage'));
export const PoliticaPrivacidadePage = lazy(() => import('../pages/public/PoliticaPrivacidadePage'));
export const TermosUsoPage = lazy(() => import('../pages/public/TermosUsoPage'));
export const LandingPage = lazy(() => import('../pages/LandingPage'));
export const ConversionLandingPage = lazy(() => import('../pages/ConversionLandingPage'));
export const BlogPage = lazy(() => import('../pages/BlogPage'));
export const PainelWrapper = lazy(() => import('../pages/PainelWrapper'));
export const ProtectedRoute = lazy(() => import('../components/ProtectedRoute'));
export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const DashboardWrapper = lazy(() => import('../pages/routes/DashboardWrapper'));
export const LeadsManagerWrapper = lazy(() => import('../pages/routes/LeadsManagerWrapper'));
export const ContractsManagerWrapper = lazy(() => import('../pages/routes/ContractsManagerWrapper'));
export const RemindersManagerEnhanced = lazy(() => import('../components/RemindersManagerEnhanced'));
export const BlogTab = lazy(() => import('../components/config/BlogTab'));
export const WhatsAppTab = lazy(() => import('../components/communication/WhatsAppTab'));
export const ConfigPage = lazy(() => import('../pages/ConfigPage'));
export const FinanceiroComissoesTab = lazy(() => import('../components/finance/FinanceiroComissoesTab'));
export const FinanceiroAgendaTab = lazy(() => import('../components/finance/FinanceiroAgendaTab'));

export function RouteLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
    </div>
  );
}
