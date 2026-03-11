import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { Eye, Lock } from 'lucide-react';

type ObserverRestrictionProps = {
  children: ReactNode;
  action?: string;
  showMessage?: boolean;
  moduleId?: string;
};

export default function ObserverRestriction({
  children,
  action = 'realizar esta acao',
  showMessage = true,
  moduleId = 'leads',
}: ObserverRestrictionProps) {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canEdit = getRoleModulePermission(role, moduleId).can_edit;

  if (canEdit) {
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
            <p className="text-xs text-slate-600">Seu perfil nao possui permissao para {action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ObserverBanner() {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canEditLeads = getRoleModulePermission(role, 'leads').can_edit;

  if (canEditLeads) {
    return null;
  }

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900">Modo somente leitura</p>
          <p className="text-xs text-blue-700">Seu perfil pode consultar os dados, mas nao possui permissao de edicao neste modulo.</p>
        </div>
      </div>
    </div>
  );
}
