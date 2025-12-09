import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Lock } from 'lucide-react';

type ObserverRestrictionProps = {
  children: ReactNode;
  action?: string;
  showMessage?: boolean;
};

export default function ObserverRestriction({
  children,
  action = 'realizar esta ação',
  showMessage = true
}: ObserverRestrictionProps) {
  const { isObserver } = useAuth();

  if (!isObserver) {
    return <>{children}</>;
  }

  if (!showMessage) {
    return null;
  }

  return (
    <div className="relative group">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5 backdrop-blur-[1px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 flex items-center space-x-3">
          <Lock className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-slate-900">Acesso Restrito</p>
            <p className="text-xs text-slate-600">Você precisa de permissão de admin para {action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ObserverBanner() {
  const { isObserver } = useAuth();

  if (!isObserver) {
    return null;
  }

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">Modo Observador</p>
          <p className="text-xs text-blue-700">Você está visualizando o sistema em modo somente-leitura. Entre em contato com um administrador para obter acesso completo.</p>
        </div>
      </div>
    </div>
  );
}
