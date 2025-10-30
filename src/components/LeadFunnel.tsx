import { useEffect, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { TrendingDown, Users } from 'lucide-react';

const FUNNEL_STAGES = [
  { id: 'Novo', label: 'Novo', color: 'bg-blue-500' },
  { id: 'Contato iniciado', label: 'Contato Iniciado', color: 'bg-yellow-500' },
  { id: 'Em atendimento', label: 'Em Atendimento', color: 'bg-cyan-500' },
  { id: 'Cotando', label: 'Cotando', color: 'bg-orange-500' },
  { id: 'Proposta enviada', label: 'Proposta Enviada', color: 'bg-teal-500' },
  { id: 'Fechado', label: 'Fechado', color: 'bg-green-500' },
];

export default function LeadFunnel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .in('status', FUNNEL_STAGES.map(s => s.id));

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

  const calculateConversionRate = (fromStage: number): number => {
    if (fromStage === 0) return 100;

    const previousCount = getLeadsByStatus(FUNNEL_STAGES[fromStage - 1].id).length;
    const currentCount = getLeadsByStatus(FUNNEL_STAGES[fromStage].id).length;

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
        {FUNNEL_STAGES.map((stage, index) => {
          const stageLeads = getLeadsByStatus(stage.id);
          const count = stageLeads.length;
          const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
          const width = totalLeads > 0 ? Math.max((count / totalLeads) * maxWidth, 10) : 0;
          const conversionRate = calculateConversionRate(index);

          return (
            <div key={stage.id} className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                  <span className="font-medium text-slate-900">{stage.label}</span>
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
                  className={`absolute inset-y-0 left-0 ${stage.color} bg-opacity-80 transition-all duration-500 ease-out flex items-center justify-center`}
                  style={{ width: `${width}%` }}
                >
                  {count > 0 && (
                    <span className="text-white font-semibold text-sm px-3">
                      {count} {count === 1 ? 'lead' : 'leads'}
                    </span>
                  )}
                </div>
              </div>

              {index < FUNNEL_STAGES.length - 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-300"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Taxa de Conversão Geral</p>
            <p className="text-2xl font-bold text-slate-900">
              {totalLeads > 0
                ? ((getLeadsByStatus('Fechado').length / totalLeads) * 100).toFixed(1)
                : 0}%
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Leads Fechados</p>
            <p className="text-2xl font-bold text-green-600">
              {getLeadsByStatus('Fechado').length}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs text-slate-600 mb-1">Em Negociação</p>
            <p className="text-2xl font-bold text-orange-600">
              {getLeadsByStatus('Cotando').length + getLeadsByStatus('Proposta enviada').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
