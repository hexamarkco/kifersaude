import { useEffect, useState } from 'react';
import { UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { Lead } from '../lib/supabase';
import { Toast } from '../design-system';

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
      <Toast
        className="w-[min(24rem,calc(100vw-2rem))]"
        title="Novo Lead Recebido!"
        variant="warning"
        icon={UserPlus}
        onDismiss={handleClose}
        actions={[{ label: 'Ver Lead', onClick: handleViewLead, fullWidth: true }]}
      >
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">{lead.nome_completo}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Status: <span className="font-medium text-[var(--info-text)]">{statusLabel}</span>
            </p>
          </div>

          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>{lead.telefone}</span>
            </div>

            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}

            {lead.cidade && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>{lead.cidade}</span>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-2">
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              <span className="font-medium">Origem:</span> {origemLabel} |
              <span className="ml-2 font-medium">Tipo:</span> {tipoContratacaoLabel}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-medium">Responsável:</span> {responsavelLabel}
            </p>
          </div>
        </div>
      </Toast>
    </div>
  );
}
