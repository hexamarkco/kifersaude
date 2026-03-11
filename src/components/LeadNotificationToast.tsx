import { useEffect, useState } from 'react';
import { X, UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { Lead } from '../lib/supabase';
import Button from './ui/Button';

type LeadNotificationToastProps = {
  lead: Lead;
  onClose: () => void;
  onViewLead: () => void;
};

export default function LeadNotificationToast({
  lead,
  onClose,
  onViewLead,
}: LeadNotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  const statusLabel = lead.status ?? 'Não definido';
  const origemLabel = lead.origem ?? 'Não definida';
  const tipoContratacaoLabel = lead.tipo_contratacao ?? 'Não definido';
  const responsavelLabel = lead.responsavel ?? 'Não definido';

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 100);

    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(autoCloseTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleViewLead = () => {
    handleClose();
    onViewLead();
  };

  return (
    <div
      className={`painel-theme kifer-ds fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isDarkThemeActive ? 'theme-dark' : 'theme-light'
      } ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="max-w-md overflow-hidden rounded-xl border border-amber-300/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-3">
          <div className="flex items-center space-x-2 text-white">
            <UserPlus className="w-5 h-5 animate-bounce" />
            <h3 className="font-bold text-lg">Novo Lead Recebido!</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-teal-700 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="font-bold text-lg text-slate-900">{lead.nome_completo}</p>
            <p className="text-sm text-slate-600">
              Status:{' '}
              <span className="font-medium text-blue-600">
                {statusLabel}
              </span>
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-teal-600" />
              <span>{lead.telefone}</span>
            </div>

            {lead.email && (
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-teal-600" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}

            {lead.cidade && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>{lead.cidade}</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">
              <span className="font-medium">Origem:</span> {origemLabel} |
              <span className="font-medium ml-2">Tipo:</span> {tipoContratacaoLabel}
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-medium">Responsável:</span> {responsavelLabel}
            </p>
          </div>

          <Button onClick={handleViewLead} fullWidth>
            Ver Lead
          </Button>
        </div>
      </div>
    </div>
  );
}
