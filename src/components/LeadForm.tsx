import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  Compass,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Search,
  UserCircle,
} from 'lucide-react';
import { supabase, type Lead } from '../lib/supabase';
import {
  convertLocalToUTC,
  formatDateForInput,
  formatDateTimeForInput,
} from '../lib/dateUtils';
import { BRAZIL_STATE_OPTIONS, fetchCitiesByState } from '../lib/brasilLocations';
import { consultarCep } from '../lib/cepService';
import { formatCep } from '../lib/inputFormatters';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { normalizeSentenceCase, normalizeTitleCase } from '../lib/textNormalization';
import {
  resolveOrigemIdByName,
  resolveResponsavelIdByLabel,
  resolveStatusIdByName,
  resolveTipoContratacaoIdByLabel,
} from '../lib/leadRelations';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import { toast } from '../lib/toast';
import DateTimePicker from './ui/DateTimePicker';
import Field from './ui/Field';
import Input from './ui/Input';
import ModalShell from './ui/ModalShell';
import Textarea from './ui/Textarea';

type LeadFormProps = {
  lead: Lead | null;
  initialValues?: Partial<Lead>;
  onClose: () => void;
  onSave: (lead: Lead, context?: { created: boolean }) => void;
};

type LeadFormState = {
  nome_completo: string;
  telefone: string;
  email: string;
  data_criacao: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  regiao: string;
  origem: string;
  tipo_contratacao: string;
  operadora_atual: string;
  status: string;
  responsavel: string;
  proximo_retorno: string;
  observacoes: string;
  blackout_dates: string;
  daily_send_limit: string;
};

type LeadPayload = Omit<
  LeadFormState,
  | 'proximo_retorno'
  | 'blackout_dates'
  | 'daily_send_limit'
  | 'email'
  | 'cidade'
  | 'estado'
  | 'regiao'
  | 'operadora_atual'
  | 'endereco'
> & {
  proximo_retorno: string | null;
  ultimo_contato: string;
  blackout_dates: string[] | null;
  daily_send_limit: number | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  regiao: string | null;
  operadora_atual: string | null;
  endereco: string | null;
};

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '');

const normalizeEmail = (value: string | null | undefined) =>
  (value || '').trim().toLowerCase();

const parseBlackoutDates = (value: string): string[] => {
  if (!value.trim()) return [];

  const dates = value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const uniqueDates = new Set<string>();
  dates.forEach((date) => {
    const normalized = date.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      uniqueDates.add(normalized);
    }
  });

  return Array.from(uniqueDates);
};

const buildInitialFormData = (
  lead: Lead | null,
  initialValues?: Partial<Lead>,
): LeadFormState => {
  const source = lead ?? initialValues ?? {};

  return {
    nome_completo: source.nome_completo || '',
    telefone: source.telefone || '',
    email: source.email || '',
    data_criacao: formatDateForInput(source.data_criacao || new Date().toISOString()),
    cep: source.cep || '',
    endereco: source.endereco || '',
    cidade: source.cidade || '',
    estado: source.estado || '',
    regiao: source.regiao || '',
    origem: source.origem || '',
    tipo_contratacao: source.tipo_contratacao || '',
    operadora_atual: source.operadora_atual || '',
    status: source.status || '',
    responsavel: source.responsavel || '',
    proximo_retorno: formatDateTimeForInput(source.proximo_retorno),
    observacoes: source.observacoes || '',
    blackout_dates: (source.blackout_dates || []).join(', '),
    daily_send_limit:
      typeof source.daily_send_limit === 'number' ? String(source.daily_send_limit) : '',
  };
};

export default function LeadForm({ lead, initialValues, onClose, onSave }: LeadFormProps) {
  const { loading: configLoading, leadStatuses, leadOrigins, options } = useConfig();
  const { isObserver } = useAuth();

  const [formData, setFormData] = useState<LeadFormState>(() =>
    buildInitialFormData(lead, initialValues),
  );

  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [skipAutomationOnCreate, setSkipAutomationOnCreate] = useState(false);
  const isNewLead = !lead;
  const lastFetchedCepRef = useRef('');

  const activeLeadStatuses = leadStatuses.filter((status) => status.ativo);
  const defaultStatus =
    activeLeadStatuses.find((status) => status.padrao) || activeLeadStatuses[0];

  const restrictedOriginNames = useMemo(
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.nome),
    [leadOrigins],
  );

  const activeOrigins = useMemo(
    () =>
      leadOrigins.filter(
        (origin) =>
          origin.ativo && (!isObserver || !restrictedOriginNames.includes(origin.nome)),
      ),
    [leadOrigins, isObserver, restrictedOriginNames],
  );

  const tipoContratacaoOptions = (options.lead_tipo_contratacao || []).filter(
    (option) => option.ativo,
  );
  const responsavelOptions = (options.lead_responsavel || []).filter(
    (option) => option.ativo,
  );

  useEffect(() => {
    if (!lead && !formData.status && defaultStatus) {
      setFormData((prev) => ({ ...prev, status: defaultStatus.nome }));
    }
  }, [defaultStatus, formData.status, lead]);

  useEffect(() => {
    if (!lead && !formData.origem && activeOrigins.length > 0) {
      setFormData((prev) => ({ ...prev, origem: activeOrigins[0].nome }));
    }
  }, [activeOrigins, formData.origem, lead]);

  useEffect(() => {
    if (!lead && !formData.tipo_contratacao && tipoContratacaoOptions.length > 0) {
      setFormData((prev) => ({
        ...prev,
        tipo_contratacao: tipoContratacaoOptions[0].label,
      }));
    }
  }, [formData.tipo_contratacao, lead, tipoContratacaoOptions]);

  useEffect(() => {
    if (!lead && !formData.responsavel && responsavelOptions.length > 0) {
      setFormData((prev) => ({ ...prev, responsavel: responsavelOptions[0].label }));
    }
  }, [formData.responsavel, lead, responsavelOptions]);

  useEffect(() => {
    const stateUf = formData.estado.trim().toUpperCase();

    if (!stateUf) {
      setCityOptions([]);
      setLoadingCities(false);
      return;
    }

    let cancelled = false;
    setLoadingCities(true);

    void fetchCitiesByState(stateUf)
      .then((cities) => {
        if (!cancelled) {
          setCityOptions(cities);
        }
      })
      .catch((error) => {
        console.error('Erro ao carregar cidades:', error);
        if (!cancelled) {
          setCityOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCities(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formData.estado]);

  const citySelectOptions = useMemo(
    () => [
      ...(formData.cidade && !cityOptions.includes(formData.cidade)
        ? [{ value: formData.cidade, label: formData.cidade }]
        : []),
      ...cityOptions.map((city) => ({ value: city, label: city })),
    ],
    [cityOptions, formData.cidade],
  );

  if (configLoading && !lead) {
    return (
      <ModalShell
        isOpen
        onClose={onClose}
        title="Carregando configuracoes"
        description="Aguarde enquanto buscamos as configuracoes para o formulario."
        size="md"
        panelClassName="max-w-md"
        showCloseButton={false}
        bodyClassName="flex min-h-[220px] flex-col items-center justify-center"
      >
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        <p className="mt-4 text-center text-sm text-slate-600">
          Carregando configuracoes...
        </p>
      </ModalShell>
    );
  }

  const handleCepSearch = async (cepValue?: string) => {
    const targetCep = cepValue ?? formData.cep;

    if (!targetCep || targetCep.replace(/\D/g, '').length !== 8) {
      toast.warning('Por favor, informe um CEP válido.');
      return;
    }

    setLoadingCep(true);
    try {
      const data = await consultarCep(targetCep);
      if (data) {
        const stateUf = data.uf.trim().toUpperCase();
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro,
          cidade: data.localidade,
          estado: stateUf,
          regiao: stateUf,
        }));
        lastFetchedCepRef.current = targetCep.replace(/\D/g, '');
      }
    } catch {
      toast.error('Erro ao consultar CEP. Verifique o CEP informado.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    const normalizedCep = formatted.replace(/\D/g, '');

    setFormData((prev) => ({ ...prev, cep: formatted }));

    if (normalizedCep.length === 8 && lastFetchedCepRef.current !== normalizedCep) {
      void handleCepSearch(formatted);
    }

    if (normalizedCep.length < 8) {
      lastFetchedCepRef.current = '';
    }
  };

  const handleStateChange = (nextState: string) => {
    const normalizedState = nextState.trim().toUpperCase();

    setFormData((prev) => ({
      ...prev,
      estado: normalizedState,
      regiao: normalizedState,
      cidade: prev.estado === normalizedState ? prev.cidade : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const requiredValues = [
        { value: formData.nome_completo.trim(), label: 'nome completo' },
        { value: formData.telefone.trim(), label: 'telefone' },
        { value: formData.origem.trim(), label: 'origem do lead' },
        { value: formData.tipo_contratacao.trim(), label: 'tipo de contratacao' },
        { value: formData.status.trim(), label: 'status' },
        { value: formData.responsavel.trim(), label: 'responsavel' },
      ];

      const missingRequired = requiredValues.find((item) => !item.value);
      if (missingRequired) {
      toast.warning(`Preencha o campo obrigatório: ${missingRequired.label}.`);
        return;
      }

      const creationDateIso = formData.data_criacao
        ? convertLocalToUTC(`${formData.data_criacao}T00:00`)
        : '';
      const nowIso = new Date().toISOString();
      const effectiveCreationDateIso =
        creationDateIso ||
        (formData.data_criacao
          ? new Date(`${formData.data_criacao}T00:00:00-03:00`).toISOString()
          : nowIso);

      const dataToSave: LeadPayload = {
        ...formData,
        data_criacao: effectiveCreationDateIso,
        proximo_retorno: formData.proximo_retorno
          ? convertLocalToUTC(formData.proximo_retorno)
          : null,
        ultimo_contato: formData.data_criacao ? effectiveCreationDateIso : nowIso,
        blackout_dates: (() => {
          const parsed = parseBlackoutDates(formData.blackout_dates);
          return parsed.length ? parsed : null;
        })(),
        daily_send_limit: (() => {
          const parsed = Number(formData.daily_send_limit);
          return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
        })(),
      };

      const normalizedLeadData: LeadPayload = {
        ...dataToSave,
        telefone: normalizePhoneNumber(dataToSave.telefone),
        email: normalizeEmail(dataToSave.email) || null,
        nome_completo: normalizeTitleCase(dataToSave.nome_completo) ?? '',
        cidade: normalizeTitleCase(dataToSave.cidade),
        estado: normalizeSentenceCase(dataToSave.estado),
        regiao: normalizeTitleCase(dataToSave.regiao),
        operadora_atual: normalizeTitleCase(dataToSave.operadora_atual),
        endereco: normalizeTitleCase(dataToSave.endereco),
      };

      const leadDataForDb: Record<string, unknown> = {
        ...normalizedLeadData,
        origem_id: resolveOrigemIdByName(leadOrigins, normalizedLeadData.origem),
        status_id: resolveStatusIdByName(leadStatuses, normalizedLeadData.status),
        tipo_contratacao_id: resolveTipoContratacaoIdByLabel(
          tipoContratacaoOptions,
          normalizedLeadData.tipo_contratacao,
        ),
        responsavel_id: resolveResponsavelIdByLabel(
          responsavelOptions,
          normalizedLeadData.responsavel,
        ),
      };

      if (!lead && skipAutomationOnCreate) {
        leadDataForDb.skip_automation = true;
      }

      delete leadDataForDb.origem;
      delete leadDataForDb.status;
      delete leadDataForDb.tipo_contratacao;
      delete leadDataForDb.responsavel;

      let savedLeadId = lead?.id;
      let savedLead: Lead | null = lead;

      if (lead) {
        const { data: updatedLead, error } = await supabase
          .from('leads')
          .update(leadDataForDb)
          .eq('id', lead.id)
          .select()
          .single<Lead>();

        if (error) throw error;
        savedLead = updatedLead as Lead;
      } else {
        const duplicateFilters = [
          normalizedLeadData.telefone
            ? `telefone.eq.${normalizedLeadData.telefone}`
            : null,
          normalizedLeadData.email ? `email.ilike.${normalizedLeadData.email}` : null,
        ].filter(Boolean);

        if (duplicateFilters.length > 0) {
          const { data: duplicateLead, error: duplicateCheckError } = await supabase
            .from('leads')
            .select('id')
            .or(duplicateFilters.join(','))
            .limit(1)
            .maybeSingle();

          if (duplicateCheckError) {
            throw duplicateCheckError;
          }

          if (duplicateLead) {
            const duplicateStatus = leadStatuses.find((status) => status.nome === 'Duplicado');
            if (duplicateStatus) {
              leadDataForDb.status_id = duplicateStatus.id;
            }
          }
        }

        const { data: insertedLead, error } = await supabase
          .from('leads')
          .insert([leadDataForDb])
          .select()
          .single<Lead>();

        if (error) throw error;

        savedLead = insertedLead as Lead;
        savedLeadId = insertedLead.id;
      }

      if (formData.proximo_retorno && savedLeadId) {
        const localDate = new Date(formData.proximo_retorno);
        localDate.setMinutes(localDate.getMinutes() - 1);
        const reminderDate = localDate.toISOString();

        const existingReminder = await supabase
          .from('reminders')
          .select('id')
          .eq('lead_id', savedLeadId)
          .eq('tipo', 'Retorno')
          .eq('lido', false)
          .maybeSingle();

        if (existingReminder.data) {
          await supabase
            .from('reminders')
            .update({
              titulo: `Retorno agendado: ${normalizedLeadData.nome_completo}`,
              descricao: `Retorno agendado para ${normalizedLeadData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              prioridade: 'alta',
            })
            .eq('id', existingReminder.data.id);
        } else {
          await supabase.from('reminders').insert([
            {
              lead_id: savedLeadId,
              tipo: 'Retorno',
              titulo: `Retorno agendado: ${normalizedLeadData.nome_completo}`,
              descricao: `Retorno agendado para ${normalizedLeadData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              lido: false,
              prioridade: 'alta',
            },
          ]);
        }
      }

      if (savedLead) {
        onSave(savedLead, { created: isNewLead });
      }
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      toast.error('Erro ao salvar lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={lead ? 'Editar Lead' : 'Novo Lead'}
      size="lg"
      panelClassName="sm:max-w-3xl"
      bodyClassName="p-0"
    >
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome Completo" htmlFor="lead-nome" required className="md:col-span-2">
            <Input
              id="lead-nome"
              type="text"
              required
              leftIcon={UserCircle}
              value={formData.nome_completo}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nome_completo: e.target.value }))
              }
            />
          </Field>

          <Field label="Telefone" htmlFor="lead-telefone" required>
            <Input
              id="lead-telefone"
              type="tel"
              required
              leftIcon={Phone}
              autoFormat="phone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, telefone: e.target.value }))
              }
            />
          </Field>

          <Field label="E-mail" htmlFor="lead-email">
            <Input
              id="lead-email"
              type="email"
              leftIcon={Mail}
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </Field>

          <Field label="CEP" htmlFor="lead-cep">
            <div className="relative">
              <Input
                id="lead-cep"
                type="text"
                leftIcon={MapPin}
                autoFormat="cep"
                value={formData.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className="pr-11"
              />
              {loadingCep ? (
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCepSearch()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-teal-600"
                  aria-label="Buscar CEP"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}
            </div>
          </Field>

          <Field label="Endereco" htmlFor="lead-endereco">
            <Input
              id="lead-endereco"
              type="text"
              leftIcon={MapPinned}
              value={formData.endereco}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, endereco: e.target.value }))
              }
            />
          </Field>

          <Field label="Estado">
            <FilterSingleSelect
              icon={MapPin}
              value={formData.estado}
              onChange={handleStateChange}
              placeholder="Selecione o estado"
              options={BRAZIL_STATE_OPTIONS}
            />
          </Field>

          <Field
            label="Cidade"
            helperText={
              formData.estado
                ? loadingCities
                  ? 'Carregando cidades...'
                  : 'Cidade filtrada pelo estado selecionado.'
                : 'Selecione um estado para liberar as cidades.'
            }
          >
            <FilterSingleSelect
              icon={MapPinned}
              value={formData.cidade}
              onChange={(value) => setFormData((prev) => ({ ...prev, cidade: value }))}
              placeholder={
                formData.estado
                  ? loadingCities
                    ? 'Carregando cidades'
                    : 'Selecione a cidade'
                  : 'Escolha primeiro o estado'
              }
              options={citySelectOptions}
              disabled={!formData.estado || loadingCities || citySelectOptions.length === 0}
            />
          </Field>

          <Field label="Origem do Lead" required>
            {activeOrigins.length > 0 ? (
              <FilterSingleSelect
                icon={Compass}
                value={formData.origem}
                onChange={(value) => setFormData((prev) => ({ ...prev, origem: value }))}
                placeholder="Origem do lead"
                includePlaceholderOption={false}
                options={[
                  ...(!activeOrigins.some((origin) => origin.nome === formData.origem) &&
                  formData.origem
                    ? [{ value: formData.origem, label: formData.origem }]
                    : []),
                  ...activeOrigins.map((origin) => ({
                    value: origin.nome,
                    label: origin.nome,
                  })),
                ]}
              />
            ) : (
              <Input
                type="text"
                required
                leftIcon={Compass}
                value={formData.origem}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, origem: e.target.value }))
                }
                placeholder="Informe a origem"
              />
            )}
          </Field>

          <Field label="Tipo de Contratacao" required>
            {tipoContratacaoOptions.length > 0 ? (
              <FilterSingleSelect
                icon={Briefcase}
                value={formData.tipo_contratacao}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    tipo_contratacao: value,
                  }))
                }
                placeholder="Tipo de contratacao"
                includePlaceholderOption={false}
                options={[
                  ...(!tipoContratacaoOptions.some(
                    (option) => option.label === formData.tipo_contratacao,
                  ) && formData.tipo_contratacao
                    ? [
                        {
                          value: formData.tipo_contratacao,
                          label: formData.tipo_contratacao,
                        },
                      ]
                    : []),
                  ...tipoContratacaoOptions.map((option) => ({
                    value: option.label,
                    label: option.label,
                  })),
                ]}
              />
            ) : (
              <Input
                type="text"
                required
                leftIcon={Briefcase}
                value={formData.tipo_contratacao}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tipo_contratacao: e.target.value,
                  }))
                }
                placeholder="Informe o tipo de contratacao"
              />
            )}
          </Field>

          <Field label="Operadora Atual" htmlFor="lead-operadora">
            <Input
              id="lead-operadora"
              type="text"
              leftIcon={Building2}
              value={formData.operadora_atual}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  operadora_atual: e.target.value,
                }))
              }
            />
          </Field>

          <Field label="Status" required>
            {activeLeadStatuses.length > 0 ? (
              <FilterSingleSelect
                icon={AlertCircle}
                value={formData.status}
                onChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                placeholder="Status"
                includePlaceholderOption={false}
                options={[
                  ...(!activeLeadStatuses.some((status) => status.nome === formData.status) &&
                  formData.status
                    ? [{ value: formData.status, label: formData.status }]
                    : []),
                  ...activeLeadStatuses.map((status) => ({
                    value: status.nome,
                    label: status.nome,
                  })),
                ]}
              />
            ) : (
              <Input
                type="text"
                required
                leftIcon={AlertCircle}
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                placeholder="Informe o status"
              />
            )}
          </Field>

          {isNewLead && (
            <div className="md:col-span-2">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <Checkbox
                  checked={skipAutomationOnCreate}
                  onChange={(event) => setSkipAutomationOnCreate(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Nao disparar automacoes ao criar este lead (ex.: ja abordado manualmente).
                </span>
              </label>
            </div>
          )}

          <Field label="Responsavel" required>
            {responsavelOptions.length > 0 ? (
              <FilterSingleSelect
                icon={UserCircle}
                value={formData.responsavel}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    responsavel: value,
                  }))
                }
                placeholder="Responsavel"
                includePlaceholderOption={false}
                options={[
                  ...(!responsavelOptions.some(
                    (option) => option.label === formData.responsavel,
                  ) && formData.responsavel
                    ? [{ value: formData.responsavel, label: formData.responsavel }]
                    : []),
                  ...responsavelOptions.map((option) => ({
                    value: option.label,
                    label: option.label,
                  })),
                ]}
              />
            ) : (
              <Input
                type="text"
                required
                leftIcon={UserCircle}
                value={formData.responsavel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    responsavel: e.target.value,
                  }))
                }
                placeholder="Informe o responsavel"
              />
            )}
          </Field>

          <Field label="Data de Criacao">
            <DateTimePicker
              type="date"
              value={formData.data_criacao}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, data_criacao: value }))
              }
              placeholder="Selecionar data"
              triggerClassName="focus:ring-teal-500"
            />
          </Field>

          <Field label="Proximo Retorno">
            <DateTimePicker
              type="datetime-local"
              value={formData.proximo_retorno}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  proximo_retorno: value,
                }))
              }
              placeholder="Selecionar data e hora"
              triggerClassName="focus:ring-teal-500"
            />
          </Field>

          <Field
            label="Limite Diario de Envios"
            htmlFor="lead-daily-send-limit"
            helperText="Defina um limite especifico para este lead ou deixe vazio para usar o limite do tenant."
          >
            <Input
              id="lead-daily-send-limit"
              type="number"
              min={1}
              leftIcon={CalendarDays}
              value={formData.daily_send_limit}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  daily_send_limit: e.target.value,
                }))
              }
              placeholder="Sem limite"
            />
          </Field>

          <Field label="Observacoes" className="md:col-span-2">
            <Textarea
              value={formData.observacoes}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  observacoes: e.target.value,
                }))
              }
              rows={3}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} fullWidth className="sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth className="sm:w-auto">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
