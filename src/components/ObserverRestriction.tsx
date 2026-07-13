import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { Eye, Lock } from 'lucide-react';
import { Alert, Surface } from '../design-system';

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
    <div className="group relative" aria-disabled="true">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-[var(--kds-radius-md)] bg-[var(--overlay)] p-3 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Surface variant="warning" padding="sm" className="flex items-center gap-3">
          <Lock className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Acesso Restrito</p>
            <p className="text-xs">Seu perfil nao possui permissao para {action}</p>
          </div>
        </Surface>
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
    <Alert tone="info" className="mb-6" role="status">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Modo somente leitura</p>
          <p className="text-xs">Seu perfil pode consultar os dados, mas nao possui permissao de edicao neste modulo.</p>
        </div>
      </div>
    </Alert>
  );
}
