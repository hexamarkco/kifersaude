import { Text } from '../design-system';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  addLeadInteraction,
  getLeadTimeline,
  type Lead,
  type LeadTimelineInteraction,
  type LeadTimelineReminder,
  type LeadTimelineStatusHistory,
} from '../features/leads';
import { AlertCircle, MessageCircle, Plus, Pencil, Trash2, History, Bell, Clock, UserCircle, RefreshCw, ArrowLeft, FileText } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import NextStepSuggestion from './NextStepSuggestion';
import { LeadFavoriteToggle } from './LeadFavoriteStar';
import {
  Badge,
  Button,
  Alert,
  EmptyState,
  Field,
  LoadingState,
  SectionHeader,
  Surface,
  Textarea,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  PageHeader,
  Tabs,
  Avatar,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  RecordActions,
} from '../design-system';
import { toast } from '../lib/toast';

type LeadWithRelations = Lead & {
  status_nome?: string | null;
  responsavel_label?: string | null;
};

type LeadDetailsProps = {
  lead: LeadWithRelations;
  presentation?: 'dialog' | 'drawer' | 'page';
  onScheduleReminder?: (lead: LeadWithRelations) => void;
  onConvert?: (lead: LeadWithRelations) => void;
  onClose: () => void;
  onUpdate: () => void;
  onEdit: (lead: LeadWithRelations) => void;
  onDelete?: (lead: LeadWithRelations) => void;
  onOpenFullPage?: () => void;
};

export default function LeadDetails({ lead, presentation = 'dialog', onClose, onUpdate, onEdit, onDelete, onOpenFullPage, onScheduleReminder, onConvert }: LeadDetailsProps) {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canEditLead = getRoleModulePermission(role, 'leads').can_edit;
  const [activeSection, setActiveSection] = useState('overview');
  const [favorito, setFavorito] = useState(Boolean(lead.favorito));
  const [interactions, setInteractions] = useState<LeadTimelineInteraction[]>([]);
  const [statusHistory, setStatusHistory] = useState<LeadTimelineStatusHistory[]>([]);
  const [reminders, setReminders] = useState<LeadTimelineReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoadError, setTimelineLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const savingInteractionRef = useRef(false);
  const timelineRequestIdRef = useRef(0);
  const timelineMountedRef = useRef(false);
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
    setFavorito(Boolean(lead.favorito));
  }, [lead.id, lead.favorito]);

  const loadLeadTimeline = useCallback(async () => {
    if (!timelineMountedRef.current) {
      return;
    }

    const requestId = timelineRequestIdRef.current + 1;
    timelineRequestIdRef.current = requestId;
    setLoading(true);
    setTimelineLoadError(false);

    try {
      const timeline = await getLeadTimeline(lead.id);
      if (requestId !== timelineRequestIdRef.current) {
        return;
      }

      setInteractions(timeline.interactions);
      setStatusHistory(timeline.statusHistory);
      setReminders(timeline.reminders);
    } catch (error) {
      if (requestId === timelineRequestIdRef.current) {
        console.error('Erro ao carregar interações:', error);
        setTimelineLoadError(true);
      }
    } finally {
      if (requestId === timelineRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [lead.id]);

  useEffect(() => {
    timelineMountedRef.current = true;
    void loadLeadTimeline();
    return () => {
      timelineMountedRef.current = false;
      timelineRequestIdRef.current += 1;
    };
  }, [loadLeadTimeline]);

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingInteractionRef.current) {
      return;
    }

    savingInteractionRef.current = true;
    setSavingInteraction(true);

    try {
      await addLeadInteraction(lead.id, formData);

      setFormData({ tipo: 'Observação', descricao: '', responsavel: 'Luiza' });
      setShowForm(false);
      void loadLeadTimeline();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      toast.error('Não foi possível adicionar a interação.');
    } finally {
      savingInteractionRef.current = false;
      setSavingInteraction(false);
    }
  };

  const favorite = <LeadFavoriteToggle leadId={lead.id} favorito={favorito} onToggled={(next) => { setFavorito(next); onUpdate(); }} />;
  const deleteActions = canEditLead && onDelete
    ? [{ label: 'Excluir lead', icon: Trash2, onClick: () => onDelete(lead), destructive: true }]
    : [];
  const drawerActions = [
    ...(onOpenFullPage ? [{ label: 'Abrir ficha completa', icon: FileText, onClick: onOpenFullPage }] : []),
    ...deleteActions,
  ];
  const actions = <div className="kds-lead-detail-actions">
    {canEditLead && <Button onClick={() => onEdit(lead)}><Pencil className="kds-control-icon" aria-hidden="true" />Editar lead</Button>}
    {deleteActions.length > 0 && <RecordActions actions={deleteActions} visibleCount={0} label="Ações do lead" />}
  </div>;
  const contact = <Surface className="kds-detail-contact">
    <SectionHeader as="h2" title="Dados do contato" />
    <dl className="kds-detail-data-grid kds-detail-data-grid-compact">
      {[['Nome', lead.nome_completo], ['Telefone', lead.telefone], ['E-mail', lead.email], ['Origem', lead.origem], ['Tipo', lead.tipo_contratacao], ['Responsável', lead.responsavel_label ?? lead.responsavel], ['Cidade', lead.cidade], ['Próximo retorno', lead.proximo_retorno ? formatDateTimeFullBR(lead.proximo_retorno) : null]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Não informado'}</dd></div>)}
    </dl>
  </Surface>;
  const renderTimeline = (title = 'Linha do tempo') => (        <section className="kds-detail-timeline" aria-labelledby="lead-timeline-title">
          <SectionHeader
            as="h3"
            id="lead-timeline-title"
            title={title}
            className="mb-4"
            action={<History className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />}
          />
          {loading ? (
            <LoadingState compact label="Carregando linha do tempo" className="py-8" />
          ) : timelineLoadError ? (
            <Alert tone="danger" role="alert" className="items-start">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Text className="font-medium">Não foi possível carregar o histórico deste lead.</Text>
                  <Text className="mt-1 text-sm">Os dados não estão disponíveis no momento. Tente novamente.</Text>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => void loadLeadTimeline()}
                  >
                    <RefreshCw className="kds-control-icon" aria-hidden="true" />
                    Tentar novamente
                  </Button>
                </div>
              </div>
            </Alert>
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
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      {event.type === 'interaction' && <MessageCircle className="h-4 w-4" aria-hidden="true" />}
                      {event.type === 'reminder' && <Bell className="h-4 w-4" aria-hidden="true" />}
                      {event.type === 'status' && <Clock className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</Text>
                        {event.meta && (
                          <Badge tone="neutral" size="sm">{event.meta}</Badge>
                        )}
                      </div>
                      {event.description && (
                        <Text className="mt-1 break-words text-sm text-[var(--text-secondary)]">{event.description}</Text>
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

);
  const interaction = <Surface className="kds-detail-interactions">        <SectionHeader
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
              <Plus className="kds-control-icon" aria-hidden="true" />
              <span>Nova interação</span>
            </Button>
          ) : undefined}
        />

        {showForm && (
          <Surface variant="warning" padding="sm" className="mb-6">
            <form onSubmit={handleAddInteraction}>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo de interação">
                  <FilterSelect
                    icon={Clock}
                    value={formData.tipo}
                    disabled={savingInteraction}
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
                  <FilterSelect
                    icon={UserCircle}
                    value={formData.responsavel}
                    disabled={savingInteraction}
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
                  disabled={savingInteraction}
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
                  disabled={savingInteraction}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="w-full sm:w-auto" loading={savingInteraction}>
                  {savingInteraction ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </Surface>
        )}

        {loading ? (
          <LoadingState compact label="Carregando interações" className="py-12" />
        ) : timelineLoadError ? (
          <Text className="py-8 text-sm text-[var(--text-muted)]">
            As interações não estão disponíveis enquanto o histórico não for carregado.
          </Text>
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
                <Text className="break-words text-sm text-[var(--text-secondary)] sm:text-base">{interaction.descricao}</Text>
              </Surface>
            ))}
          </div>
        )}
</Surface>;
  const leadData = [
    ['Nome', lead.nome_completo], ['Telefone', lead.telefone], ['E-mail', lead.email],
    ['Origem', lead.origem], ['Tipo de contratação', lead.tipo_contratacao],
    ['Operadora atual', lead.operadora_atual], ['CEP', lead.cep], ['Endereço', lead.endereco],
    ['Cidade', lead.cidade], ['Estado', lead.estado], ['Região', lead.regiao],
    ['Responsável', lead.responsavel_label ?? lead.responsavel], ['Canal', lead.canal],
    ['Tags', lead.tags?.join(', ')], ['Limite diário de envios', lead.daily_send_limit?.toString()],
    ['Observações', lead.observacoes],
  ];

  if (presentation === 'page') return (
    <section className="kds-detail-workspace">
      <Button variant="text" size="sm" className="kds-lead-form-back" onClick={onClose}><ArrowLeft className="kds-control-icon" aria-hidden="true" />Gestão de leads</Button>
      <PageHeader eyebrow="Relacionamento" title={lead.nome_completo} identity={favorite} status={<Badge>{lead.status_nome ?? lead.status ?? 'Sem status'}</Badge>} description={`Responsável: ${lead.responsavel_label ?? lead.responsavel ?? 'Não atribuído'}`} actions={actions} />
      <Tabs ariaLabel="Seções do lead" listClassName="kds-lead-detail-tabs-list" triggerClassName="kds-lead-detail-tab" items={[{id:'overview',label:'Visão geral'},{id:'history',label:'Histórico'},{id:'followups',label:'Follow-ups'},{id:'data',label:'Dados do lead'}]} value={activeSection} onChange={setActiveSection} />
      {activeSection === 'overview' && <>
        <div className="kds-detail-overview-grid">
          {contact}
          <Surface>{renderTimeline()}</Surface>
          <Surface className="kds-detail-quick-actions">
            <SectionHeader as="h2" title="Ações rápidas" />
            {canEditLead && onScheduleReminder && <Button onClick={() => onScheduleReminder(lead)}><Bell className="kds-control-icon" aria-hidden="true" />Agendar follow-up</Button>}
            {canEditLead && <Button variant="secondary" onClick={() => { setActiveSection('history'); setShowForm(true); }}><Plus className="kds-control-icon" aria-hidden="true" />Registrar interação</Button>}
            {canEditLead && onConvert && <Button variant="secondary" onClick={() => onConvert(lead)}><FileText className="kds-control-icon" aria-hidden="true" />Converter em contrato</Button>}
            <NextStepSuggestion leadStatus={lead.status_nome ?? lead.status ?? 'Novo'} lastContact={lead.ultimo_contato ?? undefined} />
          </Surface>
        </div>
        {interaction}
      </>}
      {activeSection === 'history' && <><Surface>{renderTimeline()}</Surface>{interaction}</>}
      {activeSection === 'data' && <Surface><SectionHeader as="h2" title="Dados do lead" /><dl className="kds-detail-data-grid">{leadData.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl></Surface>}
      {activeSection === 'followups' && <Surface className="kds-detail-followups"><SectionHeader as="h2" title="Follow-ups" action={canEditLead && onScheduleReminder ? <Button onClick={() => onScheduleReminder(lead)}>Agendar follow-up</Button> : undefined} />
        {loading ? <LoadingState label="Carregando follow-ups" /> : timelineLoadError ? <Alert tone="danger">Não foi possível carregar os follow-ups. Consulte novamente o histórico.</Alert> : reminders.length === 0 ? <EmptyState title="Nenhum follow-up registrado" description="Agende o próximo contato para acompanhar este lead." /> : reminders.map(reminder => <Surface key={reminder.id} variant="muted"><div className="kds-detail-reminder-heading"><Text>{reminder.titulo}</Text><Badge tone={reminder.lido ? 'success' : 'warning'}>{reminder.lido ? 'Concluído' : 'Pendente'}</Badge></div><Text>{reminder.descricao}</Text><time dateTime={reminder.data_lembrete}>{formatDateTimeFullBR(reminder.data_lembrete)}</time></Surface>)}
      </Surface>}
    </section>
  );

  if (presentation === 'drawer') return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      side="right"
      size="md"
      aria-label="Detalhes do lead"
      className="kds-lead-details-drawer"
    >
      <DrawerHeader onClose={onClose}>
        <div className="min-w-0">
          <DialogTitle>Detalhes do lead</DialogTitle>
          <DialogDescription>Visualização e ações do registro</DialogDescription>
        </div>
      </DrawerHeader>
      <DrawerBody className="kds-lead-details-drawer-body">
        <div className="kds-lead-details-drawer-content">
          <Surface className="kds-lead-details-drawer-summary">
            <div className="kds-lead-details-drawer-identity">
              <Avatar name={lead.nome_completo} size="sm" tone="brand" />
              <div className="kds-lead-details-drawer-copy">
                <Text className="font-semibold text-[var(--text-primary)]">{lead.nome_completo}</Text>
                <Badge>{lead.status_nome ?? lead.status ?? 'Sem status'}</Badge>
              </div>
              {drawerActions.length > 0 && <RecordActions actions={drawerActions} visibleCount={0} label="Ações do lead" />}
            </div>
            <dl className="kds-lead-details-drawer-fields">
              {[
                ['Telefone', lead.telefone],
                ['E-mail', lead.email],
                ['Origem', lead.origem],
                ['Responsável', lead.responsavel_label ?? lead.responsavel],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || 'Não informado'}</dd>
                </div>
              ))}
            </dl>
          </Surface>
          {renderTimeline('Histórico de interações')}
        </div>
      </DrawerBody>
      <DrawerFooter className="kds-lead-details-drawer-footer">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        {canEditLead && <Button onClick={() => onEdit(lead)}><Pencil className="kds-control-icon" aria-hidden="true" />Editar lead</Button>}
      </DrawerFooter>
    </Drawer>
  );

  return <Dialog open onOpenChange={(open) => !open && onClose()} size="xl">
    <DialogHeader onClose={onClose}><div><DialogTitle className="flex items-center gap-2">{favorite}{lead.nome_completo}</DialogTitle><DialogDescription>Histórico de interações, status e lembretes.</DialogDescription></div></DialogHeader>
    <DialogBody><div className="kds-detail-workspace"><div className="kds-detail-dialog-actions">{actions}</div>{contact}<Surface>{renderTimeline()}</Surface>{interaction}</div></DialogBody>
  </Dialog>;
}
