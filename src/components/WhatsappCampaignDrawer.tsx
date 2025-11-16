import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, PlayCircle, PauseCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  WhatsappCampaignTarget,
  WhatsappCampaignWithRelations,
} from '../types/whatsappCampaigns';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

type DrawerContext = {
  chatId?: string | null;
  leadId?: string | null;
  phone: string | null;
  displayName?: string | null;
};

type WhatsappCampaignDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  context: DrawerContext | null;
};

const normalizePhone = (phone: string | null | undefined) => phone?.replace(/\D+/g, '') ?? '';

const summarizeTargets = (targets: WhatsappCampaignTarget[] | undefined) => {
  const summary: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    waiting: 0,
    paused: 0,
    completed: 0,
    failed: 0,
  };

  (targets ?? []).forEach(target => {
    summary[target.status] = (summary[target.status] ?? 0) + 1;
  });

  return summary;
};

export default function WhatsappCampaignDrawer({ isOpen, onClose, context }: WhatsappCampaignDrawerProps) {
  const [campaigns, setCampaigns] = useState<WhatsappCampaignWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingCampaignId, setProcessingCampaignId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*, targets:whatsapp_campaign_targets(*)')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCampaigns((data ?? []) as WhatsappCampaignWithRelations[]);
    } catch (err) {
      console.error('Erro ao carregar campanhas do WhatsApp:', err);
      setErrorMessage('Não foi possível carregar as campanhas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadCampaigns();
    }
  }, [isOpen, loadCampaigns]);

  useEffect(() => {
    if (!isOpen) {
      setFeedback(null);
      setErrorMessage(null);
      setProcessingCampaignId(null);
    }
  }, [isOpen]);

  const currentPhone = useMemo(() => normalizePhone(context?.phone ?? null), [context?.phone]);

  const findTarget = useCallback(
    (campaign: WhatsappCampaignWithRelations) => {
      if (!context) {
        return null;
      }

      const candidates = campaign.targets ?? [];
      return (
        candidates.find(target => context.leadId && target.lead_id === context.leadId) ||
        candidates.find(target => context.chatId && target.chat_id === context.chatId) ||
        candidates.find(target => normalizePhone(target.phone) === currentPhone) ||
        null
      );
    },
    [context, currentPhone],
  );

  const handleEnroll = useCallback(
    async (campaignId: string) => {
      if (!context?.phone) {
        setErrorMessage('Número de telefone não disponível para este contato.');
        return;
      }

      setProcessingCampaignId(campaignId);
      setFeedback(null);
      setErrorMessage(null);

      try {
        const payload = {
          campaign_id: campaignId,
          chat_id: context.chatId ?? null,
          lead_id: context.leadId ?? null,
          phone: context.phone,
          status: 'pending',
        };

        const onConflict = context.leadId ? 'campaign_id,lead_id' : 'campaign_id,phone';
        const { error } = await supabase
          .from('whatsapp_campaign_targets')
          .upsert(payload, { onConflict });

        if (error) {
          throw error;
        }

        setFeedback('Contato adicionado à campanha.');
        await loadCampaigns();
      } catch (err) {
        console.error('Erro ao adicionar contato na campanha:', err);
        setErrorMessage('Não foi possível adicionar o contato.');
      } finally {
        setProcessingCampaignId(null);
      }
    },
    [context, loadCampaigns],
  );

  const updateTargetStatus = useCallback(
    async (target: WhatsappCampaignTarget, status: WhatsappCampaignTarget['status']) => {
      setProcessingCampaignId(target.campaign_id);
      setErrorMessage(null);
      setFeedback(null);

      try {
        const { error } = await supabase
          .from('whatsapp_campaign_targets')
          .update({ status, wait_until: null, condition_state: null, updated_at: new Date().toISOString() })
          .eq('id', target.id);

        if (error) {
          throw error;
        }

        setFeedback('Status atualizado com sucesso.');
        await loadCampaigns();
      } catch (err) {
        console.error('Erro ao atualizar status da campanha:', err);
        setErrorMessage('Não foi possível atualizar o status.');
      } finally {
        setProcessingCampaignId(null);
      }
    },
    [loadCampaigns],
  );

  const restartTarget = useCallback(
    async (target: WhatsappCampaignTarget) => {
      setProcessingCampaignId(target.campaign_id);
      setErrorMessage(null);
      setFeedback(null);

      try {
        const { error } = await supabase
          .from('whatsapp_campaign_targets')
          .update({
            status: 'pending',
            current_step_index: 0,
            wait_until: null,
            condition_state: null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', target.id);

        if (error) {
          throw error;
        }

        setFeedback('Execução reiniciada.');
        await loadCampaigns();
      } catch (err) {
        console.error('Erro ao reiniciar execução da campanha:', err);
        setErrorMessage('Não foi possível reiniciar a execução.');
      } finally {
        setProcessingCampaignId(null);
      }
    },
    [loadCampaigns],
  );

  if (!isOpen) {
    return null;
  }

  const renderCampaignCard = (campaign: WhatsappCampaignWithRelations) => {
    const target = findTarget(campaign);
    const summary = summarizeTargets(campaign.targets);
    const busy = processingCampaignId === campaign.id;

    return (
      <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{campaign.name}</p>
            <p className="text-xs text-slate-500">{campaign.description || 'Sem descrição'}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {STATUS_LABELS[campaign.status] ?? campaign.status}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(summary).map(([status, count]) => (
            <span
              key={`${campaign.id}-${status}`}
              className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {status.replace('_', ' ')}: {count}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {target ? (
            <>
              <p className="text-sm text-slate-600">
                Participando desta campanha ({target.status.replace('_', ' ')}).
              </p>
              <div className="flex flex-wrap gap-2">
                {target.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => updateTargetStatus(target, 'pending')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <PlayCircle className="h-4 w-4" /> Retomar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateTargetStatus(target, 'paused')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
                  >
                    <PauseCircle className="h-4 w-4" /> Pausar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => restartTarget(target)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" /> Reiniciar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleEnroll(campaign.id)}
              disabled={busy || !context?.phone}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
            >
              Adicionar ao fluxo
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div className="flex-1 bg-slate-900/50" onClick={onClose} role="presentation" />
      <div className="w-full max-w-md bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Campanhas de WhatsApp</p>
            <p className="text-xs text-slate-500">
              {context?.displayName ?? 'Contato selecionado'}
              {context?.phone ? ` • ${context.phone}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Fechar painel de campanhas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[90vh] overflow-y-auto px-5 py-4 space-y-4">
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {feedback ? <p className="text-sm text-emerald-600">{feedback}</p> : null}
          {loading ? (
            <p className="text-sm text-slate-500">Carregando campanhas...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma campanha configurada.</p>
          ) : (
            campaigns.map(renderCampaignCard)
          )}
        </div>
      </div>
    </div>
  );
}
