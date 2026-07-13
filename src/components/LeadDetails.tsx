import { useState, useEffect, useMemo } from 'react';
import { supabase, Lead, Interaction, Reminder, LeadStatusHistory } from '../lib/supabase';
import { MessageCircle, Plus, Pencil, Trash2, History, Bell, Clock, UserCircle } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import NextStepSuggestion from './NextStepSuggestion';
import FilterSingleSelect from './FilterSingleSelect';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  SectionHeader,
  Surface,
  Textarea,
  Dialog,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from '../design-system';
import { toast } from '../lib/toast';

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
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canEditLead = getRoleModulePermission(role, 'leads').can_edit;
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [statusHistory, setStatusHistory] = useState<LeadStatusHistory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Observação',
    descricao: '',
    responsavel: 'Luiza',
  });

  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      type: 'interaction' | 'status' | 'reminder';
      date: string;
      title: string;
      description?: string | null;
      meta?: string | null;
    }> = [];

    interactions.forEach((interaction) => {
      events.push({
        id: `interaction-${interaction.id}`,
        type: 'interaction',
        date: interaction.data_interacao,
        title: interaction.tipo,
        description: interaction.descricao,
        meta: interaction.responsavel,
      });
    });

    statusHistory.forEach((item) => {
      events.push({
        id: `status-${item.id}`,
        type: 'status',
        date: item.created_at,
        title: `Status: ${item.status_anterior} -> ${item.status_novo}`,
        description: item.observacao ?? null,
        meta: item.responsavel,
      });
    });

    reminders.forEach((reminder) => {
      events.push({
        id: `reminder-${reminder.id}`,
        type: 'reminder',
        date: reminder.data_lembrete,
        title: `Lembrete: ${reminder.titulo}`,
        description: reminder.descricao ?? null,
        meta: reminder.lido ? 'Concluído' : 'Pendente',
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [interactions, reminders, statusHistory]);

  useEffect(() => {
    loadLeadTimeline();
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeadTimeline = async () => {
    setLoading(true);
    try {
      const [interactionsRes, statusRes, remindersRes] = await Promise.all([
        supabase
          .from('interactions')
          .select('*')
          .eq('lead_id', lead.id)
          .order('data_interacao', { ascending: false }),
        supabase
          .from('lead_status_history')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reminders')
          .select('*')
          .eq('lead_id', lead.id)
          .order('data_lembrete', { ascending: false }),
      ]);

      if (interactionsRes.error) throw interactionsRes.error;
      if (statusRes.error) throw statusRes.error;
      if (remindersRes.error) throw remindersRes.error;

      setInteractions(interactionsRes.data || []);
      setStatusHistory(statusRes.data || []);
      setReminders(remindersRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
    } finally {
      setLoading(false);
    }
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
      loadLeadTimeline();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      toast.error('Erro ao adicionar interação.');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="lg">
      <DialogHeader onClose={onClose}>
        <div><DialogTitle>{lead.nome_completo}</DialogTitle><p className="kds-dialog-description">Historico de Interacoes</p></div>
      </DialogHeader>
      <DialogBody>
      <div className="flex-1 overflow-y-auto text-[var(--text-secondary)]">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {canEditLead && (
            <Button
              type="button"
              onClick={() => onEdit(lead)}
              variant="secondary"
              size="sm"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Editar Lead</span>
            </Button>
          )}
          {canEditLead && onDelete && (
            <Button
              type="button"
              onClick={() => onDelete(lead)}
              variant="danger"
              size="sm"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}
        </div>

        <Surface variant="muted" padding="sm" className="mb-6">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline font-medium text-[var(--text-secondary)]">Telefone:</dt>
              <dd className="ml-2 inline text-[var(--text-primary)]">{lead.telefone}</dd>
            </div>
            {lead.email && (
              <div>
                <dt className="inline font-medium text-[var(--text-secondary)]">E-mail:</dt>
                <dd className="ml-2 inline break-all text-[var(--text-primary)]">{lead.email}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium text-[var(--text-secondary)]">Status:</dt>
              <dd className="ml-2 inline text-[var(--text-primary)]">
                {lead.status_nome ?? lead.status ?? 'Sem status'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-[var(--text-secondary)]">Responsável:</dt>
              <dd className="ml-2 inline text-[var(--text-primary)]">
                {lead.responsavel_label ?? lead.responsavel ?? 'Sem responsável'}
              </dd>
            </div>
          </dl>
        </Surface>

        <div className="mb-6">
          <NextStepSuggestion
            leadStatus={lead.status_nome ?? lead.status ?? 'Novo'}
            lastContact={lead.ultimo_contato ?? undefined}
          />
        </div>

        <section className="mb-6" aria-labelledby="lead-timeline-title">
          <SectionHeader
            as="h3"
            id="lead-timeline-title"
            title="Linha do tempo"
            className="mb-4"
            action={<History className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />}
          />
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Carregando linha do tempo">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--brand-primary)]" />
            </div>
          ) : timelineEvents.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title="Nenhum evento registrado."
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {timelineEvents.map((event) => (
                <Surface key={event.id} variant="muted" padding="sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-[var(--bg-elevated)] p-2 text-[var(--text-muted)]">
                      {event.type === 'interaction' && <MessageCircle className="h-4 w-4" aria-hidden="true" />}
                      {event.type === 'reminder' && <Bell className="h-4 w-4" aria-hidden="true" />}
                      {event.type === 'status' && <Clock className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</p>
                        {event.meta && (
                          <Badge tone="neutral" size="xs">{event.meta}</Badge>
                        )}
                      </div>
                      {event.description && (
                        <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{event.description}</p>
                      )}
                      <time
                        dateTime={event.date}
                        className="mt-2 block text-xs text-[var(--text-muted)]"
                      >
                        {formatDateTimeFullBR(event.date)}
                      </time>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          )}
        </section>

        <SectionHeader
          as="h3"
          title="Interações"
          className="mb-4"
          action={canEditLead ? (
            <Button
              onClick={() => setShowForm(!showForm)}
              aria-expanded={showForm}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Nova Interação</span>
            </Button>
          ) : undefined}
        />

        {showForm && (
          <Surface variant="warning" padding="sm" className="mb-6">
            <form onSubmit={handleAddInteraction}>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo de Interação">
                  <FilterSingleSelect
                    icon={Clock}
                    value={formData.tipo}
                    onChange={(value) => setFormData({ ...formData, tipo: value })}
                    placeholder="Tipo de interação"
                    includePlaceholderOption={false}
                    options={[
                      { value: 'Ligação', label: 'Ligação' },
                      { value: 'Mensagem', label: 'Mensagem' },
                      { value: 'E-mail', label: 'E-mail' },
                      { value: 'Reunião', label: 'Reunião' },
                      { value: 'Observação', label: 'Observação' },
                    ]}
                  />
                </Field>
                <Field label="Responsável">
                  <FilterSingleSelect
                    icon={UserCircle}
                    value={formData.responsavel}
                    onChange={(value) => setFormData({ ...formData, responsavel: value })}
                    placeholder="Responsável"
                    includePlaceholderOption={false}
                    options={[
                      { value: 'Luiza', label: 'Luiza' },
                      { value: 'Nick', label: 'Nick' },
                    ]}
                  />
                </Field>
              </div>
              <Field label="Descrição" htmlFor="lead-interaction-description" className="mb-4">
                <Textarea
                  id="lead-interaction-description"
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descreva o que foi tratado nesta interação..."
                />
              </Field>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2">
                <Button
                  type="button"
                  onClick={() => setShowForm(false)}
                  variant="ghost"
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  Adicionar
                </Button>
              </div>
            </form>
          </Surface>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Carregando interações">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-strong)] border-t-[var(--brand-primary)]" />
          </div>
        ) : interactions.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-10 w-10" />}
            title="Nenhuma interação registrada ainda"
          />
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <Surface key={interaction.id} variant="muted" padding="sm">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{interaction.tipo}</Badge>
                    <span className="text-sm text-[var(--text-secondary)]">{interaction.responsavel}</span>
                  </div>
                  <time
                    dateTime={interaction.data_interacao}
                    className="text-xs text-[var(--text-muted)] sm:text-sm"
                  >
                    {formatDateTimeFullBR(interaction.data_interacao)}
                  </time>
                </div>
                <p className="break-words text-sm text-[var(--text-secondary)] sm:text-base">{interaction.descricao}</p>
              </Surface>
            ))}
          </div>
        )}
      </div>
      </DialogBody>
    </Dialog>
  );
}
