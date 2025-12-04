import { useState, useEffect } from 'react';
import { supabase, Lead, Interaction } from '../lib/supabase';
import { X, MessageCircle, Plus, Pencil, Trash2, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import LeadStatusHistoryComponent from './LeadStatusHistory';
import NextStepSuggestion from './NextStepSuggestion';

type LeadWithRelations = Lead & {
  status_nome?: string | null;
  responsavel_label?: string | null;
};

type LeadDetailsProps = {
  lead: LeadWithRelations;
  onClose: () => void;
  onUpdate: () => void;
  onEdit: (lead: LeadWithRelations) => void;
  onDelete?: (lead: LeadWithRelations) => void;
};

export default function LeadDetails({ lead, onClose, onUpdate, onEdit, onDelete }: LeadDetailsProps) {
  const { isObserver } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [generatedFollowUp, setGeneratedFollowUp] = useState<string | null>(null);
  const [approvedFollowUp, setApprovedFollowUp] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Observação',
    descricao: '',
    responsavel: 'Luiza',
  });

  useEffect(() => {
    loadInteractions();
  }, [lead.id]);

  const loadInteractions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', lead.id)
        .order('data_interacao', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildConversationHistory = () => {
    if (interactions.length === 0) {
      return 'Nenhuma interação registrada ainda. Considere que esta pode ser a primeira mensagem após o cadastro.';
    }

    const chronological = [...interactions].reverse();

    return chronological
      .map(
        (interaction) =>
          `- [${formatDateTimeFullBR(interaction.data_interacao)}] ${interaction.responsavel} (${interaction.tipo}): ${interaction.descricao}`,
      )
      .join('\n');
  };

  const handleGenerateFollowUp = async () => {
    setGeneratingFollowUp(true);
    setFollowUpError(null);
    setGeneratedFollowUp(null);
    setApprovedFollowUp(null);
    setCopied(false);

    const conversationHistory = buildConversationHistory();
    const leadContext = [
      `Telefone: ${lead.telefone}`,
      lead.email ? `E-mail: ${lead.email}` : null,
      `Status: ${lead.status_nome ?? lead.status ?? 'Sem status'}`,
      `Responsável: ${lead.responsavel_label ?? lead.responsavel ?? 'Sem responsável'}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { data, error } = await supabase.functions.invoke<{ followUp?: string }>('generate-follow-up', {
        body: {
          leadName: lead.nome_completo,
          conversationHistory,
          leadContext,
        },
      });

      if (error) throw error;

      if (!data?.followUp) {
        throw new Error('Resposta vazia do gerador de follow-up.');
      }

      setGeneratedFollowUp(data.followUp.trim());
    } catch (error) {
      console.error('Erro ao gerar follow-up:', error);
      setFollowUpError('Não foi possível gerar o follow-up automaticamente. Tente novamente em instantes.');
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  const handleCopyFollowUp = async () => {
    if (!generatedFollowUp) return;

    try {
      await navigator.clipboard.writeText(generatedFollowUp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar follow-up:', error);
    }
  };

  const splitFollowUpIntoBlocks = (followUpText: string) =>
    followUpText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

  const getWhatsappMessageLink = (phone: string | null | undefined, message: string) => {
    if (!phone) return null;

    const normalized = phone.replace(/\D/g, '');
    if (!normalized) return null;

    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('interactions')
        .insert([
          {
            lead_id: lead.id,
            ...formData,
          },
        ]);

      if (error) throw error;

      await supabase
        .from('leads')
        .update({ ultimo_contato: new Date().toISOString() })
        .eq('id', lead.id);

      setFormData({ tipo: 'Observação', descricao: '', responsavel: 'Luiza' });
      setShowForm(false);
      loadInteractions();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      alert('Erro ao adicionar interação');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-stretch justify-center bg-slate-900/60 px-0 py-0 sm:items-center sm:px-4 sm:py-6">
      <div className="modal-panel relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="pr-4">
            <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">{lead.nome_completo}</h3>
            <p className="text-xs text-slate-600 sm:text-sm">Histórico de Interações</p>
          </div>
          <div className="flex items-center gap-2">
            {!isObserver && (
              <button
                type="button"
                onClick={() => onEdit(lead)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-200"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Editar Lead</span>
              </button>
            )}
            {!isObserver && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(lead)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Excluir</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              aria-label="Fechar detalhes do lead"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="font-medium text-slate-700">Telefone:</span>
                <span className="ml-2 text-slate-900">{lead.telefone}</span>
              </div>
              {lead.email && (
                <div>
                  <span className="font-medium text-slate-700">E-mail:</span>
                  <span className="ml-2 text-slate-900">{lead.email}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-slate-700">Status:</span>
                <span className="ml-2 text-slate-900">
                  {lead.status_nome ?? lead.status ?? 'Sem status'}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Responsável:</span>
                <span className="ml-2 text-slate-900">
                  {lead.responsavel_label ?? lead.responsavel ?? 'Sem responsável'}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <NextStepSuggestion
              leadStatus={lead.status_nome ?? null}
              lastContact={lead.ultimo_contato}
            />
          </div>

          <div className="mb-6">
            <LeadStatusHistoryComponent leadId={lead.id} />
          </div>

          <div className="mb-6 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                  <h4 className="text-lg font-semibold">Gerar follow-up com IA</h4>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use o histórico de interações para criar uma mensagem personalizada de retorno.
                </p>
              </div>
              <button
                onClick={handleGenerateFollowUp}
                disabled={generatingFollowUp}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-70 sm:w-auto"
              >
                {generatingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{generatingFollowUp ? 'Gerando...' : 'Gerar follow-up'}</span>
              </button>
            </div>

            {followUpError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{followUpError}</p>
            )}

            {generatingFollowUp && !followUpError && (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                <span>Analisando histórico do lead...</span>
              </div>
            )}

            {generatedFollowUp && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4">
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-slate-900">Sugestão pronta para envio</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovedFollowUp(generatedFollowUp)}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                      <Check className="h-4 w-4" />
                      <span>Aprovar follow-up</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateFollowUp}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
                      disabled={generatingFollowUp}
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Gerar outro</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyFollowUp}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-teal-600" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800">{generatedFollowUp}</p>
              </div>
            )}
            {approvedFollowUp && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3 text-sm font-semibold text-emerald-800">Follow-up aprovado</div>
                <p className="text-sm text-emerald-900">
                  O texto foi dividido em blocos. Clique em cada bloco para abrir o WhatsApp do lead com a mensagem pronta para
                  envio, seguindo a ordem sugerida.
                </p>
                <ol className="mt-3 space-y-3">
                  {splitFollowUpIntoBlocks(approvedFollowUp).map((block, index) => {
                    const whatsappLink = getWhatsappMessageLink(lead.telefone, block);

                    return (
                      <li key={`${index}-${block.slice(0, 10)}`} className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-semibold text-slate-900">Mensagem {index + 1}</div>
                          {whatsappLink ? (
                            <a
                              href={whatsappLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>Enviar no WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Telefone do lead indisponível para envio.</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{block}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-lg font-semibold text-slate-900">Interações</h4>
            {!isObserver && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Interação</span>
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleAddInteraction} className="mb-6 rounded-lg bg-teal-50 p-4">
              <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Interação
                  </label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Ligação">Ligação</option>
                    <option value="Mensagem">Mensagem</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Observação">Observação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Responsável
                  </label>
                  <select
                    required
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Luiza">Luiza</option>
                    <option value="Nick">Nick</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descreva o que foi tratado nesta interação..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full rounded-lg px-4 py-2 text-slate-700 transition-colors hover:bg-white sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-teal-600 px-4 py-2 text-white transition-colors hover:bg-teal-700 sm:w-auto"
                >
                  Adicionar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
            </div>
          ) : interactions.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-12 text-center">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">Nenhuma interação registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        {interaction.tipo}
                      </span>
                      <span className="text-sm text-slate-600">{interaction.responsavel}</span>
                    </div>
                    <span className="text-xs text-slate-500 sm:text-sm">
                      {formatDateTimeFullBR(interaction.data_interacao)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 sm:text-base">{interaction.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
