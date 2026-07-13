import { lazy } from 'react';

export const HomePage = lazy(() => import('../pages/public/HomePage'));
export const CotadorSharePage = lazy(() => import('../pages/public/CotadorSharePage'));
export const PlanosPage = lazy(() => import('../pages/public/PlanosPage'));
export const LandingPage = lazy(() => import('../pages/LandingPage'));
export const PainelWrapper = lazy(() => import('../pages/PainelWrapper'));
export const ProtectedRoute = lazy(() => import('../components/ProtectedRoute'));
export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const DashboardWrapper = lazy(() => import('../pages/routes/DashboardWrapper'));
export const LeadsManagerWrapper = lazy(() => import('../pages/routes/LeadsManagerWrapper'));
export const ContractsManagerWrapper = lazy(() => import('../pages/routes/ContractsManagerWrapper'));
export const CotadorWrapper = lazy(() => import('../pages/routes/CotadorWrapper'));
export const WhatsAppInboxWrapper = lazy(() => import('../pages/routes/WhatsAppInboxWrapper'));
export const WhatsAppCampaignsWrapper = lazy(() => import('../pages/routes/WhatsAppCampaignsWrapper'));
export const WhatsAppCampaignDetailWrapper = lazy(() => import('../pages/routes/WhatsAppCampaignDetailWrapper'));
export const RemindersManagerEnhanced = lazy(() => import('../components/RemindersManagerEnhanced'));
export const BlogTab = lazy(() => import('../components/config/BlogTab'));
export const ConfigPage = lazy(() => import('../pages/ConfigPage'));
export const FinanceiroComissoesTab = lazy(() => import('../components/finance/FinanceiroComissoesTab'));
export const FinanceiroAgendaTab = lazy(() => import('../components/finance/FinanceiroAgendaTab'));

export function RouteLoading() {
  return (
    <div className="kifer-ds flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--brand-primary)]" />
    </div>
  );
}
