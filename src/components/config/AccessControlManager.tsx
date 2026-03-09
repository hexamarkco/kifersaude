import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';

const MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Resumo geral das operações e indicadores-chave.',
  },
  {
    id: 'leads',
    label: 'Leads',
    description: 'Gestão completa do funil de leads.',
  },
  {
    id: 'contracts',
    label: 'Contratos',
    description: 'Gestão de contratos, titulares e dependentes.',
  },
  {
    id: 'reminders',
    label: 'Lembretes',
    description: 'Agenda e lembretes automáticos para acompanhamento.',
  },
  {
    id: 'financeiro-agenda',
    label: 'Financeiro - Tarefas',
    description: 'Acesso às tarefas do módulo financeiro.',
  },
  {
    id: 'financeiro-comissoes',
    label: 'Financeiro - Comissões',
    description: 'Acesso ao acompanhamento de comissões.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Gestão de conversas e mensagens do WhatsApp.',
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Gestão de conteúdo do blog e SEO.',
  },
  {
    id: 'config',
    label: 'Configurações',
    description: 'Personalização do sistema e cadastros auxiliares.',
  },
] as const;

type FeedbackMessage = { type: 'success' | 'error'; text: string };

const ensureRole = (roles: string[], role: string) =>
  (roles.includes(role) ? roles : [...roles, role]);

export default function AccessControlManager() {
  const { profilePermissions, refreshProfilePermissions } = useConfig();
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const roles = useMemo(() => {
    const unique = Array.from(new Set(profilePermissions.map((rule) => rule.role)));
    return ensureRole(ensureRole(unique, 'admin'), 'observer');
  }, [profilePermissions]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [message]);

  const showMessage = (type: FeedbackMessage['type'], text: string) => {
    setMessage({ type, text });
  };

  const getPermission = (role: string, module: string) => {
    const rule = profilePermissions.find((item) => item.role === role && item.module === module);
    if (rule) {
      return rule;
    }

    if (role === 'admin') {
      return {
        id: '',
        role,
        module,
        can_view: true,
        can_edit: true,
        created_at: '',
        updated_at: '',
      };
    }

    return {
      id: '',
      role,
      module,
      can_view: false,
      can_edit: false,
      created_at: '',
      updated_at: '',
    };
  };

  const updatePermission = async (
    role: string,
    module: string,
    updates: Record<string, boolean>,
  ) => {
    const key = `${role}:${module}`;
    setUpdatingKey(key);

    const { error } = await configService.upsertProfilePermission(role, module, updates);
    if (error) {
      showMessage('error', 'Erro ao atualizar permissão.');
      setUpdatingKey(null);
      return;
    }

    await refreshProfilePermissions();
    setUpdatingKey(null);
  };

  const handleToggleView = async (role: string, module: string, current: boolean) => {
    const updates: Record<string, boolean> = { can_view: !current };
    if (current && getPermission(role, module).can_edit) {
      updates.can_edit = false;
    }

    await updatePermission(role, module, updates);
  };

  const handleToggleEdit = async (role: string, module: string, current: boolean) => {
    const updates: Record<string, boolean> = { can_edit: !current };
    if (!current) {
      updates.can_view = true;
    }

    await updatePermission(role, module, updates);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start space-x-3">
        <ShieldCheck className="h-6 w-6 text-teal-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Permissões por Perfil</h3>
          <p className="text-sm text-slate-600">
            Defina quais módulos cada tipo de acesso pode visualizar ou editar.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Módulo</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Descrição</th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  {role === 'admin' ? 'Administradores' : role.charAt(0).toUpperCase() + role.slice(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {MODULES.map((module) => (
              <tr key={module.id}>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{module.label}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{module.description}</td>
                {roles.map((role) => {
                  const permission = getPermission(role, module.id);
                  const canEdit = permission.can_edit;
                  const canView = permission.can_view;
                  const isUpdating = updatingKey === `${role}:${module.id}`;

                  return (
                    <td key={role} className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-3">
                        <label className="inline-flex items-center space-x-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={canView}
                            onChange={() => void handleToggleView(role, module.id, canView)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            disabled={isUpdating}
                          />
                          <span>Ver</span>
                        </label>
                        <label className="inline-flex items-center space-x-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={canEdit}
                            onChange={() => void handleToggleEdit(role, module.id, canEdit)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            disabled={!canView || isUpdating}
                          />
                          <span>Editar</span>
                        </label>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
