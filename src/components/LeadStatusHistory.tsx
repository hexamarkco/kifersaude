import { useEffect, useState } from 'react';
import { supabase, LeadStatusHistory } from '../lib/supabase';
import { History, Clock } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useConfig } from '../contexts/ConfigContext';
import { getBadgeStyle } from '../lib/colorUtils';

type LeadStatusHistoryProps = {
  leadId: string;
};

export default function LeadStatusHistoryComponent({ leadId }: LeadStatusHistoryProps) {
  const [history, setHistory] = useState<LeadStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { leadStatuses } = useConfig();

  useEffect(() => {
    loadHistory();
  }, [leadId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_status_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyles = (status: string) => {
    const match = leadStatuses.find(s => s.nome === status);
    return getBadgeStyle(match?.cor || '#64748b', 0.35);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-lg">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 text-sm">Nenhuma mudança de status registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 mb-4">
        <History className="w-5 h-5 text-slate-600" />
        <h4 className="font-semibold text-slate-900">Histórico de Status</h4>
      </div>

      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-start space-x-3 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <Clock className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium border"
                  style={getStatusStyles(item.status_anterior)}
                >
                  {item.status_anterior}
                </span>
                <span className="text-slate-400">→</span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium border"
                  style={getStatusStyles(item.status_novo)}
                >
                  {item.status_novo}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">{item.responsavel}</span>
                <span>{formatDateTimeFullBR(item.created_at)}</span>
              </div>
              {item.observacao && (
                <p className="text-xs text-slate-500 mt-1">{item.observacao}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
