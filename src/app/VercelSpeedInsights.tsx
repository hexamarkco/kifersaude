import { SpeedInsights } from '@vercel/speed-insights/react';
import type { BeforeSendMiddleware } from '@vercel/speed-insights';
import { useLocation } from 'react-router-dom';

const STATIC_ROUTES = new Set([
  '/',
  '/chat',
  '/login',
  '/links',
  '/design-system',
  '/planos',
  '/painel',
  '/painel/dashboard',
  '/painel/leads',
  '/painel/contratos',
  '/painel/comissoes',
  '/painel/agenda',
  '/painel/inbox',
  '/painel/disparos',
  '/painel/tarefas',
  '/painel/lembretes',
  '/painel/blog',
  '/painel/config',
]);

function normalizeRoute(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (/^\/planos\/[^/]+\/[^/]+$/.test(path)) return '/planos/:slug/:variant';
  if (/^\/planos\/[^/]+$/.test(path)) return '/planos/:slug';
  if (/^\/forms\/[^/]+$/.test(path)) return '/forms/:slug';
  if (/^\/painel\/disparos\/[^/]+$/.test(path)) return '/painel/disparos/:campaignId';

  return STATIC_ROUTES.has(path) ? path : '/other';
}

const sanitizeEvent: BeforeSendMiddleware = (event) => {
  try {
    const url = new URL(event.url, window.location.origin);
    const route = normalizeRoute(url.pathname);

    return {
      ...event,
      url: `${url.origin}${route}`,
      route,
    };
  } catch {
    return null;
  }
};

export function VercelSpeedInsights() {
  const { pathname } = useLocation();

  if (!import.meta.env.PROD) return null;

  return <SpeedInsights route={normalizeRoute(pathname)} beforeSend={sanitizeEvent} />;
}
