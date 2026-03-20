import { lazy } from 'react';

export const HomePage = lazy(() => import('../pages/public/HomePage'));
export const PlanosPage = lazy(() => import('../pages/public/PlanosPage'));
export const LandingPage = lazy(() => import('../pages/LandingPage'));
export const PainelWrapper = lazy(() => import('../pages/PainelWrapper'));
export const ProtectedRoute = lazy(() => import('../components/ProtectedRoute'));
export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const DashboardWrapper = lazy(() => import('../pages/routes/DashboardWrapper'));
export const LeadsManagerWrapper = lazy(() => import('../pages/routes/LeadsManagerWrapper'));
export const ContractsManagerWrapper = lazy(() => import('../pages/routes/ContractsManagerWrapper'));
export const RemindersManagerEnhanced = lazy(() => import('../components/RemindersManagerEnhanced'));
export const BlogTab = lazy(() => import('../components/config/BlogTab'));
export const WhatsAppTab = lazy(() => import('../features/whatsapp/inbox/WhatsAppInboxScreen'));
export const WhatsAppSettingsPage = lazy(() => import('../components/communication/WhatsAppSettingsPage'));
export const ConfigPage = lazy(() => import('../pages/ConfigPage'));
export const FinanceiroComissoesTab = lazy(() => import('../components/finance/FinanceiroComissoesTab'));
export const FinanceiroAgendaTab = lazy(() => import('../components/finance/FinanceiroAgendaTab'));

export function RouteLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
    </div>
  );
}
