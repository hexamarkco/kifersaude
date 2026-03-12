import { useState, useEffect, useMemo } from 'react';
import { supabase, Contract, ContractHolder, Dependent, Interaction, ContractValueAdjustment } from '../lib/supabase';
import { User, Users, Plus, Edit, Trash2, MessageCircle, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import HolderForm from './HolderForm';
import ContractForm from './ContractForm';
import DependentForm from './DependentForm';
import FilterSingleSelect from './FilterSingleSelect';
import ModalShell from './ui/ModalShell';
import Button from './ui/Button';
import { panelInputBaseClass, panelInputStateClasses } from './ui/standards';
import { formatDateOnly } from '../lib/dateUtils';
import { getContractBonusSummary } from '../lib/contractBonus';
import { getCommissionInstallmentSummary } from '../lib/contractCommission';
import { getContractSignupFeeValue, isAdesaoContract } from '../lib/contractSignupFee';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import { toast } from '../lib/toast';

const AGE_ADJUSTMENT_MILESTONES = [19, 24, 29, 34, 39, 44, 49, 54, 59];
const detailPanelClass = 'rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)]';
const detailPanelMutedClass = 'rounded-lg bg-[var(--panel-surface-muted,#f7f0e7)]';
const detailDividerClass = 'mt-4 border-t border-[var(--panel-border-subtle,#e7dac8)] pt-4';
const detailTitleClass = 'text-lg font-semibold text-[var(--panel-text,#1a120d)]';
const detailHeadingTextClass = 'font-semibold text-[var(--panel-text,#1a120d)]';
const detailBodyTextClass = 'text-sm text-[var(--panel-text-soft,#5b4635)]';
const detailBodyStrongClass = 'text-sm font-medium text-[var(--panel-text-soft,#5b4635)]';
const detailMutedTextClass = 'text-xs text-[var(--panel-text-muted,#876f5c)]';
const detailLabelTextClass = 'font-medium text-[var(--panel-text-soft,#5b4635)]';
const detailEmptyStateClass =
  'rounded-lg border-2 border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-muted,#f7f0e7)] py-8 text-center';
const detailEmptyCompactClass =
  'rounded-lg border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] p-6 text-center text-sm text-[var(--panel-text-muted,#876f5c)]';
const detailAccentLinkClass =
  'text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)] hover:text-[var(--panel-accent-ink-strong,#4a2411)]';
const detailPanelSoftClass =
  'rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-muted,#f7f0e7)]';
const detailNestedPanelClass =
  'rounded-lg border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]';
const detailSectionHeadingClass = `flex items-center gap-2 ${detailTitleClass}`;
const detailSectionIconClass = 'h-5 w-5 text-[var(--panel-accent-ink,#6f3f16)]';
const detailMetricValueClass = 'text-lg font-bold text-[var(--panel-accent-ink,#6f3f16)]';
const detailEmptyIconClass = 'mx-auto mb-3 h-12 w-12 text-[var(--panel-border-strong,#9d7f5a)]/70';
const detailFormLabelClass = 'mb-1 block text-sm font-medium text-[var(--panel-text-soft,#5b4635)]';
const detailTextareaClass =
  `${panelInputBaseClass} ${panelInputStateClasses.valid} min-h-[96px] py-2 text-sm`;

type ContractDetailsProps = {
  contract: Contract;
  onClose: () => void;
  onUpdate: () => void;
  onDelete?: (contract: Contract) => void;
};

type ContractDocument = {
  id: string;
  entity_type: string;
  entity_id: string;
  tipo_documento: string;
  nome_arquivo: string;
  url_arquivo: string;
  created_at: string;
};

export default function ContractDetails({ contract, onClose, onUpdate, onDelete }: ContractDetailsProps) {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const canEditContracts = getRoleModulePermission(role, 'contracts').can_edit;
  const [holders, setHolders] = useState<ContractHolder[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [adjustments, setAdjustments] = useState<ContractValueAdjustment[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHolderForm, setShowHolderForm] = useState(false);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [editingHolder, setEditingHolder] = useState<ContractHolder | null>(null);
  const [selectedHolderId, setSelectedHolderId] = useState<string | null>(null);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const initialInteractionData = {
    tipo: 'Observacao',
    descricao: '',
    responsavel: 'Luiza',
  };
  const [interactionData, setInteractionData] = useState(initialInteractionData);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const commissionInstallments = Array.isArray(contract.comissao_parcelas) ? contract.comissao_parcelas : [];
  const commissionBaseValue = contract.comissao_prevista || 0;
  const commissionSummary = getCommissionInstallmentSummary(contract);

  const parseDate = (date?: string | null) => {
    if (!date) return null;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const getContractStartDate = () => {
    const start = parseDate(contract.data_inicio) || parseDate(contract.created_at);
    if (!start) return null;
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getFidelityEndDate = (monthValue?: string | null) => {
    if (!monthValue) return null;
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) return null;
    const endOfMonth = new Date(year, month, 0);
    endOfMonth.setHours(0, 0, 0, 0);
    return endOfMonth;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getNextAdjustmentDate = (monthNumber?: number | null) => {
    if (!monthNumber) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const contractStart = getContractStartDate();
    const currentYear = today.getFullYear();
    const adjustmentMonthIndex = monthNumber - 1;
    let nextDate = new Date(currentYear, adjustmentMonthIndex, 1);
    nextDate.setHours(0, 0, 0, 0);

    while (
      nextDate.getTime() <= today.getTime() ||
      (contractStart && nextDate.getTime() <= contractStart.getTime())
    ) {
      nextDate = new Date(nextDate.getFullYear() + 1, adjustmentMonthIndex, 1);
      nextDate.setHours(0, 0, 0, 0);
    }

    return nextDate;
  };

  const daysUntil = (date?: Date | null) => {
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = date.getTime() - today.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const buildDatePill = (label: string, date?: Date | null) => {
    const remaining = daysUntil(date);
    if (remaining === null || !date) return null;

    const formattedDate = date.toLocaleDateString('pt-BR');
    const tone = remaining < 0
      ? 'comm-badge-neutral'
      : remaining <= 7
        ? 'comm-badge-danger'
        : remaining <= 15
          ? 'comm-badge-warning'
          : 'comm-badge-success';

    const suffix = remaining === 0
      ? 'hoje'
      : remaining > 0
        ? `em ${remaining} dia${remaining === 1 ? '' : 's'}`
        : `ha ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? '' : 's'}`;

    return (
      <div key={`${label}-${date}`} className={`comm-badge gap-2 px-3 py-2 text-xs font-medium ${tone}`}>
        <span className="font-semibold">{label}</span>
        <span>{formattedDate}</span>
        <span className="text-[11px] font-normal">{suffix}</span>
      </div>
    );
  };

  const getAgeAdjustmentAlerts = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const holdersToAdjust = holders.filter((holder) => {
      const birthDate = parseDate(holder.data_nascimento);
      if (!birthDate) return false;

      const ageThisYear = currentYear - birthDate.getFullYear();
      return birthDate.getMonth() === currentMonth && AGE_ADJUSTMENT_MILESTONES.includes(ageThisYear);
    });

    const dependentsToAdjust = dependents.filter((dependent) => {
      const birthDate = parseDate(dependent.data_nascimento);
      if (!birthDate) return false;

      const ageThisYear = currentYear - birthDate.getFullYear();
      return birthDate.getMonth() === currentMonth && AGE_ADJUSTMENT_MILESTONES.includes(ageThisYear);
    });

    return [
      ...holdersToAdjust.map((holder) => ({
        id: holder.id,
        name: holder.nome_completo,
        role: 'Titular',
      })),
      ...dependentsToAdjust.map((dependent) => ({
        id: dependent.id,
        name: dependent.nome_completo,
        role: dependent.relacao,
      })),
    ];
  };

  const ageAdjustmentAlerts = getAgeAdjustmentAlerts();

  const upcomingAgeAdjustments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 120);

    const contractStart = getContractStartDate();

    const getNextMilestone = (birthDate: Date) => {
      for (const age of AGE_ADJUSTMENT_MILESTONES) {
        const targetDate = new Date(birthDate);
        targetDate.setFullYear(birthDate.getFullYear() + age);
        targetDate.setHours(0, 0, 0, 0);
        if (targetDate > today && (!contractStart || targetDate > contractStart)) {
          return { age, date: targetDate };
        }
      }
      return null;
    };

    const results: Array<{ id: string; name: string; role: string; age: number; date: Date }> = [];

    holders.forEach((holder) => {
      const birthDate = parseDate(holder.data_nascimento);
      if (!birthDate) return;
      const milestone = getNextMilestone(birthDate);
      if (!milestone) return;
      if (milestone.date <= windowEnd) {
        results.push({
          id: holder.id,
          name: holder.nome_completo,
          role: 'Titular',
          age: milestone.age,
          date: milestone.date,
        });
      }
    });

    dependents.forEach((dependent) => {
      const birthDate = parseDate(dependent.data_nascimento);
      if (!birthDate) return;
      const milestone = getNextMilestone(birthDate);
      if (!milestone) return;
      if (milestone.date <= windowEnd) {
        results.push({
          id: dependent.id,
          name: dependent.nome_completo,
          role: dependent.relacao,
          age: milestone.age,
          date: milestone.date,
        });
      }
    });

    return results.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dependents, holders, parseDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [contract.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [holdersRes, dependentsRes, interactionsRes, adjustmentsRes] = await Promise.all([
        supabase.from('contract_holders').select('*').eq('contract_id', contract.id).order('created_at'),
        supabase.from('dependents').select('*').eq('contract_id', contract.id).order('created_at'),
        supabase.from('interactions').select('*').eq('contract_id', contract.id).order('data_interacao', { ascending: false }),
        supabase.from('contract_value_adjustments').select('*').eq('contract_id', contract.id).order('created_at'),
      ]);

      const holdersData = holdersRes.data || [];
      setHolders(holdersData);
      setSelectedHolderId((current) => current || holdersData[0]?.id || null);
      setDependents(dependentsRes.data || []);
      setInteractions(interactionsRes.data || []);
      setAdjustments(adjustmentsRes.data || []);

      const entityIds = [
        ...holdersData.map((holder) => holder.id),
        ...dependentsRes.data?.map((dependent) => dependent.id) || [],
      ];

      if (entityIds.length > 0) {
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select('*')
          .in('entity_id', entityIds);

        if (docsError) {
          console.error('Erro ao carregar documentos:', docsError);
        } else {
          setDocuments(docsData || []);
        }
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAdjustedValue = (baseValue: number): number => {
    let total = baseValue;
    adjustments.forEach(adj => {
      if (adj.tipo === 'acrescimo') {
        total += adj.valor;
      } else {
        total -= adj.valor;
      }
    });
    return total;
  };

  const totalLivesInRecords = holders.length + dependents.length;
  const bonusEligibleLivesFromRecords = totalLivesInRecords > 0
    ? holders.filter(holder => (holder.bonus_por_vida_aplicado ?? contract.bonus_por_vida_aplicado ?? true)).length
      + dependents.filter(dependent => (dependent.bonus_por_vida_aplicado ?? contract.bonus_por_vida_aplicado ?? true)).length
    : 0;
  const defaultBonusLives = totalLivesInRecords > 0
    ? bonusEligibleLivesFromRecords
    : (contract.vidas || 1);
  const bonusSummary = getContractBonusSummary(contract, defaultBonusLives);
  const bonusEligibleLives = bonusSummary.eligibleLives;
  const bonusTotal = bonusSummary.total || null;
  const signupFeeValue = getContractSignupFeeValue(contract);
  const hasSignupFeeConfig = isAdesaoContract(contract.modalidade) && (
    contract.taxa_adesao_tipo === 'percentual_mensalidade' || contract.taxa_adesao_tipo === 'valor_fixo'
  );

  const documentsByEntity = useMemo(() => {
    const map = new Map<string, ContractDocument[]>();
    documents.forEach((doc) => {
      const list = map.get(doc.entity_id) || [];
      list.push(doc);
      map.set(doc.entity_id, list);
    });
    return map;
  }, [documents]);

  const renderDocumentList = (entityId: string) => {
    const docs = documentsByEntity.get(entityId) || [];
    if (docs.length === 0) {
      return <p className={detailBodyTextClass}>Sem documentos enviados.</p>;
    }

    return (
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className={`${detailPanelClass} flex items-center justify-between px-3 py-2 text-sm`}>
            <div className="min-w-0">
              <p className={`${detailHeadingTextClass} truncate`}>{doc.tipo_documento}</p>
              <p className={`${detailMutedTextClass} truncate`}>{doc.nome_arquivo}</p>
            </div>
            <a
              href={doc.url_arquivo}
              target="_blank"
              rel="noreferrer"
              className={detailAccentLinkClass}
            >
              Abrir
            </a>
          </div>
        ))}
      </div>
    );
  };

  const formatDateTimeShort = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const contractTimeline = useMemo(() => {
    const events: Array<{ id: string; label: string; date: Date; description?: string }> = [];
    const createdAt = parseDate(contract.created_at);
    if (createdAt) {
      events.push({ id: 'created', label: 'Contrato criado', date: createdAt });
    }

    const startDate = parseDate(contract.data_inicio);
    if (startDate) {
      events.push({ id: 'start', label: 'Inicio de vigencia', date: startDate });
    }

    const fidelityEnd = getFidelityEndDate(contract.data_renovacao);
    if (fidelityEnd) {
      events.push({ id: 'fidelity', label: 'Fim da fidelidade', date: fidelityEnd });
    }

    const adjustmentDate = getNextAdjustmentDate(contract.mes_reajuste);
    if (adjustmentDate) {
      events.push({ id: 'adjustment', label: 'Proximo reajuste anual', date: adjustmentDate });
    }

    const commissionDate = parseDate(contract.previsao_recebimento_comissao);
    if (commissionDate) {
      events.push({ id: 'commission', label: 'Recebimento comissao', date: commissionDate });
    }

    const bonusDate = parseDate(contract.previsao_pagamento_bonificacao);
    if (bonusDate) {
      events.push({ id: 'bonus', label: 'Pagamento bonificacao', date: bonusDate });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [contract, getNextAdjustmentDate]);

  const auditEvents = useMemo(() => {
    const events: Array<{ id: string; label: string; date: string; description?: string }> = [];
    if (contract.created_at) {
      events.push({ id: 'audit-created', label: 'Contrato criado', date: contract.created_at });
    }
    if (contract.updated_at) {
      events.push({ id: 'audit-updated', label: 'Contrato atualizado', date: contract.updated_at });
    }
    adjustments.forEach((adjustment) => {
      events.push({
        id: `audit-adjustment-${adjustment.id}`,
        label: `Ajuste de valor (${adjustment.tipo})`,
        date: adjustment.created_at,
        description: adjustment.motivo,
      });
    });
    interactions.forEach((interaction) => {
      events.push({
        id: `audit-interaction-${interaction.id}`,
        label: `Interacao: ${interaction.tipo}`,
        date: interaction.data_interacao,
        description: interaction.descricao,
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, contract.created_at, contract.updated_at, interactions]);

  useEffect(() => {
    if (!contract.bonus_por_vida_aplicado) return;

    if (bonusSummary.hasConfigurations) {
      if (contract.vidas_elegiveis_bonus === bonusSummary.eligibleLives) return;
    } else {
      if (totalLivesInRecords === 0) return;
      if (contract.vidas_elegiveis_bonus === bonusEligibleLivesFromRecords) return;
    }

    const updateEligibleLives = async () => {
      try {
        const { error } = await supabase
          .from('contracts')
          .update({
            vidas_elegiveis_bonus: bonusSummary.hasConfigurations
              ? bonusSummary.eligibleLives
              : bonusEligibleLivesFromRecords,
          })
          .eq('id', contract.id);
        if (error) throw error;
        onUpdate();
      } catch (error) {
        console.error('Erro ao atualizar vidas elegiveis para bonus:', error);
      }
    };

    updateEligibleLives();
  }, [
    bonusEligibleLivesFromRecords,
    bonusSummary.eligibleLives,
    bonusSummary.hasConfigurations,
    contract.bonus_por_vida_aplicado,
    contract.id,
    contract.vidas_elegiveis_bonus,
    onUpdate,
    totalLivesInRecords,
  ]);

  const handleDeleteDependent = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Remover dependente',
      description: 'Deseja remover este dependente? Esta acao nao pode ser desfeita.',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('dependents').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao remover dependente:', error);
      toast.error('Erro ao remover dependente.');
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = editingInteraction
        ? await supabase
            .from('interactions')
            .update({
              tipo: interactionData.tipo,
              descricao: interactionData.descricao,
              responsavel: interactionData.responsavel,
            })
            .eq('id', editingInteraction.id)
        : await supabase
            .from('interactions')
            .insert([{
              contract_id: contract.id,
              ...interactionData,
            }]);

      if (error) throw error;

      setInteractionData(initialInteractionData);
      setShowInteractionForm(false);
      setEditingInteraction(null);
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar interacao:', error);
      toast.error('Erro ao adicionar interação.');
    }
  };

  const handleEditInteraction = (interaction: Interaction) => {
    setEditingInteraction(interaction);
    setInteractionData({
      tipo: interaction.tipo,
      descricao: interaction.descricao,
      responsavel: interaction.responsavel,
    });
    setShowInteractionForm(true);
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    const confirmed = await requestConfirmation({
      title: 'Remover interacao',
      description: 'Deseja remover esta interacao? Esta acao nao pode ser desfeita.',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('interactions').delete().eq('id', interactionId);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao remover interacao:', error);
      toast.error('Erro ao remover interação.');
    }
  };

  if (loading) {
    return (
      <ModalShell
        isOpen
        onClose={onClose}
        title="Carregando contrato"
        description="Aguarde enquanto reunimos os dados mais recentes."
        size="xl"
        panelClassName="sm:max-w-5xl"
        showCloseButton={false}
        bodyClassName="flex min-h-[260px] items-center justify-center"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--panel-focus,#c86f1d)] border-t-transparent" />
      </ModalShell>
    );
  }

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={contract.codigo_contrato}
      description={`${contract.operadora} - ${contract.produto_plano}`}
      size="xl"
      panelClassName="sm:max-w-5xl"
    >
      <div className="mb-4 flex items-center justify-end gap-2">
        {canEditContracts && (
          <Button
            onClick={() => setShowEditForm(true)}
            variant="info"
            size="sm"
          >
            Editar
          </Button>
        )}
        {canEditContracts && onDelete && (
          <Button
            onClick={() => onDelete(contract)}
            variant="danger"
            size="sm"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        )}
      </div>

      <div className="p-1">
          <div className={`mb-6 ${detailPanelMutedClass} p-4`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className={detailLabelTextClass}>Status:</span>
                <span className={`ml-2 ${detailHeadingTextClass}`}>{contract.status}</span>
              </div>
              <div>
                <span className={detailLabelTextClass}>Modalidade:</span>
                <span className={`ml-2 ${detailHeadingTextClass}`}>{contract.modalidade}</span>
              </div>
              <div>
                <span className={detailLabelTextClass}>Responsavel:</span>
                <span className={`ml-2 ${detailHeadingTextClass}`}>{contract.responsavel}</span>
              </div>
              {contract.mensalidade_total && (
                <div>
                  <span className={detailLabelTextClass}>Mensalidade:</span>
                  <span className={`ml-2 ${detailHeadingTextClass}`}>R$ {contract.mensalidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className={`${detailPanelClass} p-3`}>
                <p className={detailMutedTextClass}>Comissao prevista</p>
                <p className={detailTitleClass}>
                  {contract.comissao_prevista
                    ? `R$ ${contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'Nao informado'}
                </p>
                {contract.previsao_recebimento_comissao && (
                  <p className={detailMutedTextClass}>
                    Previsto: {new Date(contract.previsao_recebimento_comissao).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className={`${detailPanelClass} p-3`}>
                <p className={detailMutedTextClass}>Bonus total</p>
                <p className={detailTitleClass}>
                  {bonusTotal
                    ? `R$ ${bonusTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'Nao aplicado'}
                </p>
                {contract.previsao_pagamento_bonificacao && (
                  <p className={detailMutedTextClass}>
                    Previsto: {new Date(contract.previsao_pagamento_bonificacao).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div className={`${detailPanelClass} p-3`}>
                <p className={detailMutedTextClass}>Reajuste anual</p>
                <p className={detailTitleClass}>
                  {getNextAdjustmentDate(contract.mes_reajuste)
                    ? getNextAdjustmentDate(contract.mes_reajuste)?.toLocaleDateString('pt-BR')
                    : 'Nao definido'}
                </p>
                <p className={detailMutedTextClass}>
                  Mes de reajuste: {contract.mes_reajuste ? String(contract.mes_reajuste).padStart(2, '0') : '--'}
                </p>
              </div>
            </div>

            {(contract.data_renovacao || contract.previsao_recebimento_comissao || contract.previsao_pagamento_bonificacao) && (
              <div className={detailDividerClass}>
                <div className={`${detailBodyStrongClass} mb-2`}>Datas-chave</div>
                <div className="flex flex-wrap gap-2">
                  {buildDatePill('Fim da fidelidade', getFidelityEndDate(contract.data_renovacao))}
                  {buildDatePill('Proximo reajuste anual', getNextAdjustmentDate(contract.mes_reajuste))}
                  {buildDatePill('Prev. comissao', parseDate(contract.previsao_recebimento_comissao))}
                  {buildDatePill('Prev. bonificacao', parseDate(contract.previsao_pagamento_bonificacao))}
                </div>
              </div>
            )}

            {contractTimeline.length > 0 && (
              <div className={detailDividerClass}>
                <div className={`${detailBodyStrongClass} mb-2`}>Linha do tempo do contrato</div>
                <div className="space-y-2">
                  {contractTimeline.map((event) => (
                    <div key={event.id} className={`${detailPanelClass} flex items-center justify-between px-3 py-2 text-sm`}>
                      <div className={detailBodyStrongClass}>{event.label}</div>
                      <div className={detailMutedTextClass}>{event.date.toLocaleDateString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(ageAdjustmentAlerts.length > 0 || upcomingAgeAdjustments.length > 0) && (
              <div className={detailDividerClass}>
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--panel-accent-ink,#6f3f16)]">
                  <AlertCircle className="h-4 w-4" />
                  <span>Gestao de reajuste por idade</span>
                </div>
                {upcomingAgeAdjustments.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {upcomingAgeAdjustments.map((person) => (
                      <div
                        key={`age-${person.id}`}
                        className="comm-card comm-card-warning flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className={detailHeadingTextClass}>
                          {person.name} - {person.role} - {person.age} anos
                        </span>
                        <span className={detailBodyStrongClass}>
                          {person.date.toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--panel-text-soft,#5b4635)]">Nenhum reajuste por idade previsto nos proximos 120 dias.</p>
                )}
                <p className="mt-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                  Os planos reajustam por idade quando um titular ou dependente completa 19, 24, 29, 34, 39, 44, 49, 54 ou 59 anos.
                </p>
              </div>
            )}

            {adjustments.length > 0 && contract.mensalidade_total && (
              <div className={detailDividerClass}>
                <div className={`${detailBodyStrongClass} mb-2`}>Ajustes de valor:</div>
                <div className="space-y-2">
                  {adjustments.map((adj) => {
                    const isIncrease = adj.tipo === 'acrescimo';

                    return (
                      <div
                        key={adj.id}
                        className={`comm-card ${isIncrease ? 'comm-card-success' : 'comm-card-danger'} flex items-start gap-2 p-3 text-sm`}
                      >
                        {isIncrease ? (
                          <TrendingUp className="mt-0.5 h-4 w-4 text-[var(--panel-text-soft,#5b4635)]" />
                        ) : (
                          <TrendingDown className="mt-0.5 h-4 w-4 text-[var(--panel-text-soft,#5b4635)]" />
                        )}
                        <div className="flex-1">
                          <span className={`comm-badge ${isIncrease ? 'comm-badge-success' : 'comm-badge-danger'} px-2.5 py-1 text-xs font-semibold`}>
                            {isIncrease ? '+' : '-'} R$ {adj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`ml-2 ${detailBodyTextClass}`}>{adj.motivo}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--panel-border-subtle,#e7dac8)] pt-3">
                  <span className={detailLabelTextClass}>Mensalidade final:</span>
                  <span className={detailMetricValueClass}>
                    R$ {calculateAdjustedValue(contract.mensalidade_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {contract.comissao_multiplicador && contract.comissao_multiplicador !== 2.8 && (
              <div className={detailDividerClass}>
                <div className="comm-card comm-card-warning flex items-center gap-2 px-3 py-3">
                  <AlertCircle className="h-5 w-5 text-[var(--panel-accent-ink,#6f3f16)]" />
                  <span className={detailBodyStrongClass}>Multiplicador de comissao:</span>
                  <span className={detailMetricValueClass}>{contract.comissao_multiplicador}x</span>
                  <span className={detailMutedTextClass}>(padrao: 2.8x)</span>
                </div>
              </div>
            )}

            {contract.comissao_prevista && (
              <div className={detailDividerClass}>
                <div className="flex items-center justify-between">
                  <span className={detailBodyStrongClass}>Comissao prevista:</span>
                  <span className={detailMetricValueClass}>
                    R$ {contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {contract.comissao_recebimento_adiantado === false ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                      <AlertCircle className="h-4 w-4 text-[var(--panel-accent-ink,#6f3f16)]" />
                      <span>Recebimento parcelado com percentuais e datas personalizadas.</span>
                    </div>
                    {commissionInstallments.length > 0 ? (
                      <div className="comm-card comm-card-warning space-y-2 p-3">
                        {commissionSummary.installments.map((parcel, index) => (
                          <div key={`parcel-${index}`} className="flex items-center justify-between text-xs text-[var(--panel-text-soft,#5b4635)]">
                            <div className="flex items-center gap-2">
                              <span className={detailHeadingTextClass}>Parcela {index + 1}</span>
                              <span>
                                R$ {parcel.resolvedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {parcel.data_pagamento && (
                                <span>Pagamento: {formatDateOnly(parcel.data_pagamento)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-[var(--panel-border-subtle,#e7dac8)] pt-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                          <span className={detailHeadingTextClass}>Total</span>
                          <span className={detailHeadingTextClass}>
                            R$ {commissionSummary.totalResolvedValue.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className={detailMutedTextClass}>
                        Defina os percentuais e datas para acompanhar o recebimento parcelado desta comissao.
                      </p>
                    )}
                  </div>
                ) : contract.comissao_recebimento_adiantado ? (
                  <div className="comm-card comm-card-success mt-2 flex items-center gap-2 px-3 py-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                    <TrendingUp className="h-4 w-4 text-[var(--panel-accent-ink,#6f3f16)]" />
                    <span>Recebimento adiantado previsto (pagamento unico).</span>
                  </div>
                ) : null}
              </div>
            )}

            {hasSignupFeeConfig && (
              <div className={detailDividerClass}>
                <div className="comm-card comm-card-warning p-4">
                  <div className="flex items-center justify-between">
                    <span className={detailBodyStrongClass}>Taxa de adesao:</span>
                    <span className={detailMetricValueClass}>
                      R$ {signupFeeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                    {contract.taxa_adesao_tipo === 'percentual_mensalidade'
                      ? `Cobrada como ${contract.taxa_adesao_percentual || 0}% da mensalidade.`
                      : 'Cobrada como valor fixo.'}
                  </div>
                </div>
              </div>
            )}

            {contract.bonus_por_vida_aplicado && bonusTotal && (
              <div className={detailDividerClass}>
                <div className="comm-card comm-card-success p-4">
                  {bonusSummary.hasConfigurations ? (
                    <div className="mb-3 space-y-2">
                      {bonusSummary.configurations.map((item, index) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--panel-border-subtle,#e7dac8)] px-3 py-2">
                          <span className={detailBodyTextClass}>Faixa {index + 1}: {item.quantidade} vida(s)</span>
                          <span className={detailHeadingTextClass}>
                            R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-2 flex items-center justify-between">
                      <span className={detailBodyStrongClass}>Bonus por vida:</span>
                      <span className={detailMetricValueClass}>
                        R$ {(bonusSummary.legacyValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={detailBodyTextClass}>Vidas elegiveis:</span>
                    <span className={detailHeadingTextClass}>{bonusEligibleLives}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={detailMutedTextClass}>Vidas no contrato:</span>
                    <span className={detailBodyStrongClass}>{contract.vidas || 1}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--panel-border-subtle,#e7dac8)] pt-2">
                    <span className={detailBodyStrongClass}>Total do bonus:</span>
                    <span className={detailMetricValueClass}>
                      R$ {(bonusTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {contract.previsao_pagamento_bonificacao && (
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--panel-border-subtle,#e7dac8)] pt-2">
                      <span className={detailBodyStrongClass}>Pagamento previsto:</span>
                      <span className={detailHeadingTextClass}>
                        {new Date(contract.previsao_pagamento_bonificacao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                  Pagamento por vida do contrato, previsto conforme a data de bonificacao.
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className={detailSectionHeadingClass}>
                <User className={detailSectionIconClass} />
                <span>Titulares ({holders.length})</span>
              </h4>
              {canEditContracts && (
                <Button
                  onClick={() => {
                    setEditingHolder(null);
                    setShowHolderForm(true);
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar titular</span>
                </Button>
              )}
            </div>

            {holders.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {holders.map((holderItem) => (
                  <div key={holderItem.id} className={`${detailPanelClass} p-4`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h5 className={`mb-3 ${detailHeadingTextClass}`}>{holderItem.nome_completo}</h5>
                        <div className={`grid grid-cols-2 gap-3 text-sm md:grid-cols-3 ${detailBodyTextClass}`}>
                          <div><span className={detailLabelTextClass}>CPF:</span> {holderItem.cpf}</div>
                          <div><span className={detailLabelTextClass}>Data nasc.:</span> {formatDateOnly(holderItem.data_nascimento)}</div>
                          <div><span className={detailLabelTextClass}>Telefone:</span> {holderItem.telefone}</div>
                          {holderItem.email && <div><span className={detailLabelTextClass}>E-mail:</span> {holderItem.email}</div>}
                          {holderItem.cidade && <div><span className={detailLabelTextClass}>Cidade:</span> {holderItem.cidade}/{holderItem.estado}</div>}
                          {holderItem.cnpj && <div><span className={detailLabelTextClass}>CNPJ:</span> {holderItem.cnpj}</div>}
                        </div>
                      </div>
                      {canEditContracts && (
                        <Button
                          onClick={() => {
                            setEditingHolder(holderItem);
                            setShowHolderForm(true);
                          }}
                          variant="info"
                          size="icon"
                          aria-label={`Editar titular ${holderItem.nome_completo}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={detailEmptyStateClass}>
                <User className={detailEmptyIconClass} />
                <p className={`${detailBodyTextClass} mb-3`}>Nenhum titular cadastrado</p>
                {canEditContracts && (
                  <Button
                    onClick={() => {
                      setEditingHolder(null);
                      setShowHolderForm(true);
                    }}
                    size="sm"
                  >
                    Adicionar titular
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className={detailSectionHeadingClass}>
                <Users className={detailSectionIconClass} />
                <span>Dependentes ({dependents.length})</span>
              </h4>
              {canEditContracts && (
                <Button
                  onClick={() => {
                    if (holders.length === 0) {
      toast.warning('Cadastre um titular antes de adicionar dependentes.');
                      return;
                    }
                    setEditingDependent(null);
                    setSelectedHolderId(holders[0]?.id || null);
                    setShowDependentForm(true);
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar</span>
                </Button>
              )}
            </div>

            {holders.length > 0 ? (
              <div className="space-y-4">
                {holders.map((holderItem) => {
                  const holderDependents = dependents.filter((d) => d.holder_id === holderItem.id);
                  return (
                    <div key={holderItem.id} className={detailPanelClass}>
                      <div className="flex items-center justify-between border-b border-[var(--panel-border-subtle,#e7dac8)] px-4 py-3">
                        <div>
                          <p className={detailBodyTextClass}>Titular</p>
                          <p className={detailHeadingTextClass}>{holderItem.nome_completo}</p>
                        </div>
                        {canEditContracts && (
                          <Button
                            onClick={() => {
                              setSelectedHolderId(holderItem.id);
                              setEditingDependent(null);
                              setShowDependentForm(true);
                            }}
                            variant="secondary"
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Adicionar dependente</span>
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3 p-4">
                        {holderDependents.length > 0 ? (
                          holderDependents.map((dependent) => (
                            <div key={dependent.id} className={`${detailNestedPanelClass} flex items-start justify-between gap-4 p-3`}>
                              <div className="flex-1">
                                <h5 className={`mb-1 ${detailHeadingTextClass}`}>{dependent.nome_completo}</h5>
                                <div className={`grid grid-cols-2 gap-3 text-sm md:grid-cols-3 ${detailBodyTextClass}`}>
                                  <div><span className={detailLabelTextClass}>Relacao:</span> {dependent.relacao}</div>
                                  <div><span className={detailLabelTextClass}>Data nasc.:</span> {formatDateOnly(dependent.data_nascimento)}</div>
                                  {dependent.cpf && <div><span className={detailLabelTextClass}>CPF:</span> {dependent.cpf}</div>}
                                  {dependent.valor_individual && (
                                    <div>
                                      <span className={detailLabelTextClass}>Valor:</span>{' '}
                                      R$ {dependent.valor_individual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {canEditContracts && (
                                <div className="ml-4 flex items-center gap-2">
                                  <Button
                                    onClick={() => {
                                      setEditingDependent(dependent);
                                      setSelectedHolderId(dependent.holder_id);
                                      setShowDependentForm(true);
                                    }}
                                    variant="info"
                                    size="icon"
                                    aria-label={`Editar dependente ${dependent.nome_completo}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteDependent(dependent.id)}
                                    variant="danger"
                                    size="icon"
                                    aria-label={`Remover dependente ${dependent.nome_completo}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className={detailBodyTextClass}>Nenhum dependente para este titular.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={detailEmptyStateClass}>
                <Users className={detailEmptyIconClass} />
                <p className={detailBodyTextClass}>Cadastre um titular para incluir dependentes.</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className={detailTitleClass}>Documentos</h4>
              <span className={detailMutedTextClass}>{documents.length} arquivo(s)</span>
            </div>
            <div className="space-y-4">
              {holders.map((holderItem) => (
                <div key={`docs-holder-${holderItem.id}`} className={`${detailPanelSoftClass} p-4`}>
                  <p className={`mb-2 ${detailBodyStrongClass}`}>Titular: {holderItem.nome_completo}</p>
                  {renderDocumentList(holderItem.id)}
                </div>
              ))}
              {dependents.map((dependent) => (
                <div key={`docs-dependent-${dependent.id}`} className={`${detailPanelSoftClass} p-4`}>
                  <p className={`mb-2 ${detailBodyStrongClass}`}>Dependente: {dependent.nome_completo}</p>
                  {renderDocumentList(dependent.id)}
                </div>
              ))}
              {holders.length === 0 && dependents.length === 0 && (
                <div className={detailEmptyCompactClass}>
                  Cadastre um titular para comecar a anexar documentos.
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className={detailTitleClass}>Auditoria</h4>
              <span className={detailMutedTextClass}>{auditEvents.length} evento(s)</span>
            </div>
            {auditEvents.length === 0 ? (
              <div className={`${detailPanelSoftClass} p-6 text-sm text-[var(--panel-text-muted,#876f5c)]`}>
                Nenhum evento de auditoria disponivel.
              </div>
            ) : (
              <div className="space-y-2">
                {auditEvents.map((event) => (
                  <div key={event.id} className={`${detailNestedPanelClass} flex items-start justify-between gap-3 px-3 py-2 text-sm`}>
                    <div className="min-w-0">
                      <p className={detailBodyStrongClass}>{event.label}</p>
                      {event.description && (
                        <p className={`truncate ${detailMutedTextClass}`}>{event.description}</p>
                      )}
                    </div>
                    <span className={`whitespace-nowrap ${detailMutedTextClass}`}>
                      {formatDateTimeShort(event.date) ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className={detailTitleClass}>Historico de interacoes</h4>
              {canEditContracts && (
                <Button
                  onClick={() => {
                    setEditingInteraction(null);
                    setInteractionData(initialInteractionData);
                    setShowInteractionForm(!showInteractionForm);
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Nova interacao</span>
                </Button>
              )}
            </div>

            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className={`mb-6 ${detailPanelSoftClass} p-4`}>
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={detailFormLabelClass}>Tipo de interacao</label>
                    <FilterSingleSelect
                      icon={MessageCircle}
                      value={interactionData.tipo}
                      onChange={(value) => setInteractionData({ ...interactionData, tipo: value })}
                      placeholder="Tipo de interacao"
                      includePlaceholderOption={false}
                      options={[
                        { value: 'Ligacao', label: 'Ligacao' },
                        { value: 'Mensagem', label: 'Mensagem' },
                        { value: 'E-mail', label: 'E-mail' },
                        { value: 'Reuniao', label: 'Reuniao' },
                        { value: 'Observacao', label: 'Observacao' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className={detailFormLabelClass}>Responsavel</label>
                    <FilterSingleSelect
                      icon={User}
                      value={interactionData.responsavel}
                      onChange={(value) =>
                        setInteractionData({ ...interactionData, responsavel: value })
                      }
                      placeholder="Responsavel"
                      includePlaceholderOption={false}
                      options={[
                        { value: 'Luiza', label: 'Luiza' },
                        { value: 'Nick', label: 'Nick' },
                      ]}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={detailFormLabelClass}>Descricao</label>
                  <textarea
                    required
                    value={interactionData.descricao}
                    onChange={(e) => setInteractionData({ ...interactionData, descricao: e.target.value })}
                    rows={3}
                    placeholder="Descreva o que foi tratado..."
                    className={detailTextareaClass}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowInteractionForm(false);
                      setEditingInteraction(null);
                      setInteractionData(initialInteractionData);
                    }}
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingInteraction ? 'Salvar alteracoes' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            )}

            {interactions.length === 0 ? (
              <div className={detailEmptyStateClass}>
                <MessageCircle className={detailEmptyIconClass} />
                <p className={detailBodyTextClass}>Nenhuma interacao registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <div key={interaction.id} className={`${detailNestedPanelClass} p-4`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="comm-badge comm-badge-info px-2.5 py-1 text-xs font-semibold">
                          {interaction.tipo}
                        </span>
                        <span className={detailBodyTextClass}>{interaction.responsavel}</span>
                      </div>
                      <div className={`flex items-center gap-3 text-sm ${detailMutedTextClass}`}>
                        <span>
                          {new Date(interaction.data_interacao).toLocaleDateString('pt-BR')} as{' '}
                          {new Date(interaction.data_interacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {canEditContracts && (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleEditInteraction(interaction)}
                              variant="info"
                              size="icon"
                              aria-label={`Editar interacao de ${interaction.responsavel}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteInteraction(interaction.id)}
                              variant="danger"
                              size="icon"
                              aria-label={`Remover interacao de ${interaction.responsavel}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={detailBodyStrongClass}>{interaction.descricao}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>

      {showHolderForm && (
        <HolderForm
          contractId={contract.id}
          modalidade={contract.modalidade}
          holder={editingHolder || undefined}
          bonusPorVidaDefault={contract.bonus_por_vida_aplicado ?? true}
          onClose={() => {
            setShowHolderForm(false);
            setEditingHolder(null);
          }}
          onSave={() => {
            setShowHolderForm(false);
            setEditingHolder(null);
            loadData();
            onUpdate();
          }}
        />
      )}

      {showDependentForm && (
        <DependentForm
          contractId={contract.id}
          holders={holders}
          dependent={editingDependent}
          selectedHolderId={selectedHolderId}
          bonusPorVidaDefault={contract.bonus_por_vida_aplicado ?? true}
          onClose={() => {
            setShowDependentForm(false);
            setEditingDependent(null);
            setSelectedHolderId(null);
          }}
          onSave={() => {
            setShowDependentForm(false);
            setEditingDependent(null);
            setSelectedHolderId(null);
            loadData();
          }}
        />
      )}
      {showEditForm && (
        <ContractForm
          contract={contract}
          onClose={() => setShowEditForm(false)}
          onSave={() => {
            setShowEditForm(false);
            onUpdate();
          }}
        />
      )}
      {ConfirmationDialog}
    </ModalShell>
  );
}
