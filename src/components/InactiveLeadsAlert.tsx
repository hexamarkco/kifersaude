import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { AlertCircle, Clock, Phone, Mail } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';

type InactiveLeadsAlertProps = {
  onLeadClick?: (lead: Lead) => void;
};

export default function InactiveLeadsAlert({ onLeadClick }: InactiveLeadsAlertProps) {
  const [inactiveLeads, setInactiveLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysThreshold] = useState(7);
  const { leadStatuses } = useConfig();

  const statusLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    leadStatuses.forEach((status) => {
      if (status.id) {
        map[status.id] = status.nome;
      }
    });
    return map;
  }, [leadStatuses]);

  const closedStatusIds = useMemo(
    () =>
      leadStatuses
        .filter((status) => status.nome === 'Fechado' || status.nome === 'Perdido')
        .map((status) => status.id)
        .filter(Boolean) as string[],
    [leadStatuses],
  );

  const closedStatusIdSet = useMemo(() => new Set(closedStatusIds), [closedStatusIds]);

  const loadInactiveLeads = useCallback(async () => {
    setLoading(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .lt('ultimo_contato', cutoffDate.toISOString())
        .order('ultimo_contato', { ascending: true })
        .limit(10);

      if (error) throw error;
      const filteredLeads = (data as Lead[] | null | undefined) || [];
      const leadsWithoutClosedStatuses = closedStatusIdSet.size
        ? filteredLeads.filter((lead) => {
            const statusId = (lead as any).status_id as string | null | undefined;
            if (!statusId) return true;
            return !closedStatusIdSet.has(statusId);
          })
        : filteredLeads;

      const mappedLeads = leadsWithoutClosedStatuses.map((lead) => {
        const statusId = (lead as any).status_id as string | null | undefined;
        const resolvedStatus = lead.status ?? (statusId ? statusLabelById[statusId] : undefined);
        return { ...lead, status: resolvedStatus } as Lead;
      });

      setInactiveLeads(mappedLeads);
    } catch (error) {
      console.error('Erro ao carregar leads inativos:', error);
    } finally {
      setLoading(false);
    }
  }, [closedStatusIdSet, daysThreshold, statusLabelById]);

  useEffect(() => {
    loadInactiveLeads();

    const channel = supabase
      .channel('inactive-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        () => {
          loadInactiveLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [daysThreshold, loadInactiveLeads]);

  const getDaysInactive = (lastContact?: string): number => {
    if (!lastContact) return 999;
    const lastContactDate = new Date(lastContact);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastContactDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyColor = (days: number): string => {
    if (days >= 14) return 'bg-red-100 border-red-300 text-red-800';
    if (days >= 10) return 'bg-orange-100 border-orange-300 text-orange-800';
    return 'bg-yellow-100 border-yellow-300 text-yellow-800';
  };

  const getUrgencyBadge = (days: number): string => {
    if (days >= 14) return 'Urgente';
    if (days >= 10) return 'Atenção';
    return 'Avisar';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  if (inactiveLeads.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-orange-100 rounded-lg">
          <AlertCircle className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Leads Sem Contato</h3>
          <p className="text-sm text-slate-600">
            {inactiveLeads.length} {inactiveLeads.length === 1 ? 'lead' : 'leads'} sem contato há mais de {daysThreshold} dias
          </p>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {inactiveLeads.map((lead) => {
          const daysInactive = getDaysInactive(lead.ultimo_contato);
          const urgencyColor = getUrgencyColor(daysInactive);
          const urgencyBadge = getUrgencyBadge(daysInactive);

          return (
            <div
              key={lead.id}
              onClick={() => onLeadClick && onLeadClick(lead)}
              className={`border-2 rounded-lg p-4 ${urgencyColor} cursor-pointer hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold">{lead.nome_completo}</h4>
                    <span className="px-2 py-0.5 bg-white bg-opacity-70 rounded text-xs font-bold">
                      {urgencyBadge}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm opacity-90">
                    <div className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{lead.telefone}</span>
                    </div>
                    {lead.email && (
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-current border-opacity-20">
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">
                    {daysInactive} {daysInactive === 1 ? 'dia' : 'dias'} sem contato
                  </span>
                </div>
                <div className="text-xs font-medium">
                  <span className="opacity-70">Status:</span> {lead.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
