import { useEffect, useMemo, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { TrendingDown, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { getContrastTextColor } from '../lib/colorUtils';

export default function LeadFunnel() {
  const { leadStatuses } = useConfig();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const stages = useMemo(
    () => leadStatuses.filter(status => status.ativo).sort((a, b) => a.ordem - b.ordem),
    [leadStatuses]
  );

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('funnel-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: 'arquivado=eq.false'
        },
        () => {
          loadLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stages]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      if (stages.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .in('status', stages.map(stage => stage.nome));

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLeadsByStatus = (status: string) => {
    return leads.filter((lead) => lead.status === status);
  };

  const calculateConversionRate = (index: number): number => {
    if (index === 0) return 100;
    const previousCount = getLeadsByStatus(stages[index - 1].nome).length;
    const currentCount = getLeadsByStatus(stages[index].nome).length;
    if (previousCount === 0) return 0;
    return (currentCount / previousCount) * 100;
  };

  const totalLeads = leads.length;
  const maxWidth = 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
        Configure os status do funil para visualizar este gráfico.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Funil de Vendas</h3>
          <p className="text-sm text-slate-600 mt-1">Visualização do pipeline e taxas de conversão</p>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-900">{totalLeads}</span>
          <span className="text-slate-600">leads ativos</span>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const stageLeads = getLeadsByStatus(stage.nome);
          const count = stageLeads.length;
          const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
          const width = totalLeads > 0 ? Math.max((count / totalLeads) * maxWidth, 10) : 0;
          const conversionRate = calculateConversionRate(index);
          const color = stage.cor || '#0ea5e9';
          const textColor = getContrastTextColor(color);

          return (
            <div key={stage.id} className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="font-medium text-slate-900">{stage.nome}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  {index > 0 && (
                    <div className="flex items-center space-x-1">
                      <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-600">
                        {conversionRate.toFixed(0)}%
                      </span>
                    </div>
                  )}
                  <span className="font-semibold text-slate-900">{count}</span>
                  <span className="text-slate-500 w-16 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 flex items-center justify-center transition-all duration-500 ease-out"
                  style={{
                    width: `${width}%`,
                    backgroundColor: color,
                    color: textColor
                  }}
                >
                  {count > 0 && (
                    <span className="font-semibold text-sm px-3">
                      {count} {count === 1 ? 'lead' : 'leads'}
                    </span>
                  )}
                </div>
              </div>

              {index < stages.length - 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-300"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
