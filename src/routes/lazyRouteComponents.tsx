import {
  AppLoadingScreen,
} from '../design-system';
import { lazyWithChunkRecovery } from './lazyImport';

export const HomePage = lazyWithChunkRecovery(() => import('../pages/public/HomePage'));
export const LinksPage = lazyWithChunkRecovery(() => import('../pages/public/LinksPage'));
export const FormPage = lazyWithChunkRecovery(() => import('../pages/public/FormPage'));
export const OperatorLandingWrapper = lazyWithChunkRecovery(() => import('../pages/routes/OperatorLandingWrapper'));
export const AiSandboxChatWrapper = lazyWithChunkRecovery(() => import('../pages/routes/AiSandboxChatWrapper'));
export const DesignSystemShowcase = lazyWithChunkRecovery(() => import('../pages/dev/DesignSystemShowcase'));
export const PainelWrapper = lazyWithChunkRecovery(() => import('../pages/PainelWrapper'));
export const ProtectedRoute = lazyWithChunkRecovery(() => import('../components/ProtectedRoute'));
export const LoginPage = lazyWithChunkRecovery(() => import('../pages/LoginPage'));
export const DashboardWrapper = lazyWithChunkRecovery(() => import('../pages/routes/DashboardWrapper'));
export const LeadsManagerWrapper = lazyWithChunkRecovery(() => import('../pages/routes/LeadsManagerWrapper'));
export const ContractsManagerWrapper = lazyWithChunkRecovery(() => import('../pages/routes/ContractsManagerWrapper'));
export const WhatsAppInboxWrapper = lazyWithChunkRecovery(() => import('../pages/routes/WhatsAppInboxWrapper'));
export const WhatsAppCampaignsWrapper = lazyWithChunkRecovery(() => import('../pages/routes/WhatsAppCampaignsWrapper'));
export const WhatsAppCampaignDetailWrapper = lazyWithChunkRecovery(() => import('../pages/routes/WhatsAppCampaignDetailWrapper'));
export const BlogTab = lazyWithChunkRecovery(() => import('../features/blog/BlogTabScreen'));
export const ConfigPage = lazyWithChunkRecovery(() => import('../pages/ConfigPage'));
export const FinanceiroComissoesTab = lazyWithChunkRecovery(() => import('../features/commissions'));
export const FinanceiroAgendaTab = lazyWithChunkRecovery(() => import('../features/agenda/AgendaScreen'));

export function RouteLoading() {
  return <AppLoadingScreen />;
}
