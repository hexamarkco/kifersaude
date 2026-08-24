import { lazy } from 'react';

import { AppLoadingScreen } from '../design-system';

export const HomePage = lazy(() => import('../pages/public/HomePage'));
export const LinksPage = lazy(() => import('../pages/public/LinksPage'));
export const FormPage = lazy(() => import('../pages/public/FormPage'));
export const AiSandboxChatWrapper = lazy(() => import('../pages/routes/AiSandboxChatWrapper'));
export const DesignSystemShowcase = lazy(() => import('../pages/dev/DesignSystemShowcase'));
export const PainelWrapper = lazy(() => import('../pages/PainelWrapper'));
export const ProtectedRoute = lazy(() => import('../components/ProtectedRoute'));
export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const DashboardWrapper = lazy(() => import('../pages/routes/DashboardWrapper'));
export const LeadsManagerWrapper = lazy(() => import('../pages/routes/LeadsManagerWrapper'));
export const ContractsManagerWrapper = lazy(() => import('../pages/routes/ContractsManagerWrapper'));
export const WhatsAppInboxWrapper = lazy(() => import('../pages/routes/WhatsAppInboxWrapper'));
export const WhatsAppCampaignsWrapper = lazy(() => import('../pages/routes/WhatsAppCampaignsWrapper'));
export const WhatsAppCampaignDetailWrapper = lazy(() => import('../pages/routes/WhatsAppCampaignDetailWrapper'));
export const BlogTab = lazy(() => import('../features/blog/BlogTabScreen'));
export const ConfigPage = lazy(() => import('../pages/ConfigPage'));
export const FinanceiroComissoesTab = lazy(() => import('../features/commissions/FinanceiroComissoesScreen'));
export const FinanceiroAgendaTab = lazy(() => import('../components/finance/FinanceiroAgendaTab'));

export function RouteLoading() {
  return <AppLoadingScreen />;
}
