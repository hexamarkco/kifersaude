import { FieldLabel } from '../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Clock, DollarSign, Fingerprint, Search, UserCircle, Users } from 'lucide-react';
import {
  saveContractDependent,
  type ContractHolder,
  type Dependent,
} from '../features/contracts';
import { formatDateForInput } from '../lib/dateUtils';
import { formatCpf, formatCurrencyInput, parseFormattedNumber } from '../lib/inputFormatters';
import { consultarPessoaPorCPF } from '../lib/receitaService';
import { toast } from '../lib/toast';
import {
  Button,
  Checkbox,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Surface,
  IconButton,
  FilterSelect,
} from '../design-system';

type DependentFormProps = {
  contractId: string;
  holders: ContractHolder[];
  dependent: Dependent | null;
  selectedHolderId?: string | null;
  bonusPorVidaDefault?: boolean;
  onClose: () => void;
  onSave: () => void;
};

type DependentFormState = {
  holder_id: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  relacao: string;
  elegibilidade: string;
  valor_individual: string;
  carencia_individual: string;
  bonus_por_vida_aplicado: boolean;
};

type DependentFormErrors = Partial<
  Record<'nome_completo' | 'data_nascimento', string>
>;

const buildDependentFormState = (
  dependent: Dependent | null,
  defaultHolderId: string,
  bonusPorVidaDefault?: boolean,
): DependentFormState => ({
  holder_id: defaultHolderId,
  nome_completo: dependent?.nome_completo || '',
  cpf: formatCpf(dependent?.cpf || ''),
  data_nascimento: formatDateForInput(dependent?.data_nascimento) || '',
  relacao: dependent?.relacao || 'Filho(a)',
  elegibilidade: dependent?.elegibilidade || '',
  valor_individual:
    typeof dependent?.valor_individual === 'number'
      ? formatCurrencyInput(String(Math.round(dependent.valor_individual * 100)))
      : '',
  carencia_individual: dependent?.carencia_individual || '',
  bonus_por_vida_aplicado:
    dependent?.bonus_por_vida_aplicado ?? bonusPorVidaDefault ?? true,
});

const withCurrentOption = (
  options: Array<{ value: string; label: string }>,
  value?: string | null,
  label?: string | null,
) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue || options.some((option) => option.value === normalizedValue)) {
    return options;
  }

  return [{ value: normalizedValue, label: label?.trim() || normalizedValue }, ...options];
};

export default function DependentForm({
  contractId,
  holders,
  dependent,
  selectedHolderId,
  bonusPorVidaDefault,
  onClose,
  onSave,
}: DependentFormProps) {
  const holderOptions = useMemo(
    () => holders.map((holder) => ({ value: holder.id, label: holder.nome_completo })),
    [holders],
  );

  const defaultHolderId =
    dependent?.holder_id || selectedHolderId || holderOptions[0]?.value || '';

  const initialFormData = useMemo(
    () => buildDependentFormState(dependent, defaultHolderId, bonusPorVidaDefault),
    [bonusPorVidaDefault, defaultHolderId, dependent],
  );
  const [formData, setFormData] = useState<DependentFormState>(initialFormData);
  const [fieldErrors, setFieldErrors] = useState<DependentFormErrors>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const lastFetchedCpfKeyRef = useRef('');
  const cpfRequestIdRef = useRef(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const birthDateInputRef = useRef<HTMLButtonElement>(null);
  const holderSelectOptions = useMemo(() => {
    const currentHolderLabel =
      holders.find((holder) => holder.id === formData.holder_id)?.nome_completo ||
      'Titular atual';

    return withCurrentOption(holderOptions, formData.holder_id, currentHolderLabel);
  }, [formData.holder_id, holderOptions, holders]);
  const relacaoOptions = useMemo(
    () =>
      withCurrentOption(
        [
          { value: 'Conjuge', label: 'Cônjuge' },
          { value: 'Filho(a)', label: 'Filho(a)' },
          { value: 'Enteado(a)', label: 'Enteado(a)' },
          { value: 'Pai/Mae', label: 'Pai/mãe' },
          { value: 'Outro', label: 'Outro' },
        ],
        formData.relacao,
      ),
    [formData.relacao],
  );
  const carenciaOptions = useMemo(
    () =>
      withCurrentOption(
        [
          { value: '', label: 'Mesma do titular' },
          { value: 'padrao', label: 'Padrão' },
          { value: 'reduzida', label: 'Reduzida' },
          { value: 'portabilidade', label: 'Portabilidade' },
          { value: 'zero', label: 'Zero' },
        ],
        formData.carencia_individual,
      ),
    [formData.carencia_individual],
  );

  useEffect(() => {
    cpfRequestIdRef.current += 1;
    setFormData(initialFormData);
    setCpfLookupError(null);
    setCpfLoading(false);
    setFieldErrors({});
    lastFetchedCpfKeyRef.current = '';
  }, [initialFormData]);

  const updateField = <Key extends keyof DependentFormState>(
    key: Key,
    value: DependentFormState[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
    if (key === 'nome_completo' || key === 'data_nascimento') {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
  };

  const handleConsultarCPF = useCallback(
    async ({ force = false, silent = false }: { force?: boolean; silent?: boolean } = {}) => {
      const requestId = cpfRequestIdRef.current + 1;
      cpfRequestIdRef.current = requestId;
      const cleanCpf = formData.cpf.replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        setCpfLoading(false);
        if (!silent) {
          setCpfLookupError('Informe um CPF válido para buscar.');
        }
        return;
      }

      const fetchKey = `${cleanCpf}:${formData.data_nascimento || 'sem-data'}`;
      if (!force && lastFetchedCpfKeyRef.current === fetchKey) {
        setCpfLoading(false);
        return;
      }

      setCpfLookupError(null);
      setCpfLoading(true);

      try {
        const pessoa = await consultarPessoaPorCPF(formData.cpf, formData.data_nascimento || undefined);
        if (requestId !== cpfRequestIdRef.current) return;

        setFormData((prev) => ({
          ...prev,
          nome_completo: pessoa.nome || prev.nome_completo,
          data_nascimento: formatDateForInput(pessoa.data_nascimento) || prev.data_nascimento,
        }));
        lastFetchedCpfKeyRef.current = fetchKey;
      } catch (error) {
        console.error('Erro ao consultar CPF do dependente:', error);
        if (requestId === cpfRequestIdRef.current && !silent) {
          setCpfLookupError(
            error instanceof Error ? error.message : 'Nao foi possivel consultar CPF',
          );
        }
      } finally {
        if (requestId === cpfRequestIdRef.current) {
          setCpfLoading(false);
        }
      }
    },
    [formData.cpf, formData.data_nascimento],
  );

  useEffect(() => {
    const cleanCpf = formData.cpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      cpfRequestIdRef.current += 1;
      lastFetchedCpfKeyRef.current = '';
      setCpfLoading(false);
      return;
    }

    void handleConsultarCPF({ silent: true });
  }, [formData.cpf, formData.data_nascimento, handleConsultarCPF]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;

    const nextErrors: DependentFormErrors = {};

    if (!formData.nome_completo.trim()) {
      nextErrors.nome_completo = 'Informe o nome completo.';
    }

    if (!formData.data_nascimento.trim()) {
      nextErrors.data_nascimento = 'Informe a data de nascimento.';
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.nome_completo) {
        nameInputRef.current?.focus();
      } else {
        birthDateInputRef.current?.focus();
      }
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      if (!formData.holder_id) {
        throw new Error('Selecione um titular para o dependente');
      }

      const dataToSave = {
        contract_id: contractId,
        holder_id: formData.holder_id,
        nome_completo: formData.nome_completo,
        cpf: formData.cpf || null,
        data_nascimento: formData.data_nascimento,
        relacao: formData.relacao,
        elegibilidade: formData.elegibilidade || null,
        valor_individual: formData.valor_individual
          ? parseFormattedNumber(formData.valor_individual)
          : null,
        carencia_individual: formData.carencia_individual || null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
      };

      await saveContractDependent(dataToSave, dependent?.id);

      onSave();
    } catch (error) {
      console.error('Erro ao salvar dependente:', error);
      toast.error('Erro ao salvar dependente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()} size="md" initialFocus="first-content">
      <DialogHeader onClose={saving ? undefined : onClose}>
        <DialogTitle>{dependent ? 'Editar dependente' : 'Novo dependente'}</DialogTitle>
        <DialogDescription>Vincule o dependente ao titular e informe as condições individuais.</DialogDescription>
      </DialogHeader>
      <DialogBody>
      <form id="dependent-form" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Titular" required className="md:col-span-2">
            <FilterSelect
              icon={Users}
              value={formData.holder_id}
              onChange={(value) => setFormData({ ...formData, holder_id: value })}
              placeholder="Selecione um titular"
              includePlaceholderOption={false}
              options={[
                { value: '', label: 'Selecione um titular' },
                ...holderSelectOptions,
              ]}
            />
          </Field>

          <Field label="CPF" error={cpfLookupError || undefined}>
            <div className="relative">
            <Input
              type="text"
              leftIcon={Fingerprint}
              autoFormat="cpf"
              value={formData.cpf}
              onChange={(e) => updateField('cpf', e.target.value)}
              />
              <IconButton
                type="button"
                onClick={() => void handleConsultarCPF({ force: true })}
                disabled={cpfLoading || formData.cpf.replace(/\D/g, '').length !== 11}
                aria-label="Buscar CPF"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2"
               size="sm">
                <Search className={`h-5 w-5 ${cpfLoading ? 'animate-pulse' : ''}`} />
              </IconButton>
            </div>
          </Field>

          <Field label="Nome completo" required error={fieldErrors.nome_completo}>
            <Input
              ref={nameInputRef}
              type="text"
              invalid={Boolean(fieldErrors.nome_completo)}
              leftIcon={UserCircle}
              value={formData.nome_completo}
              onChange={(e) => updateField('nome_completo', e.target.value)}
            />
          </Field>

          <Field label="Data de nascimento" required error={fieldErrors.data_nascimento}>
            <DateTimePicker
              ref={birthDateInputRef}
              type="date"
              value={formData.data_nascimento}
              onChange={(event) => updateField('data_nascimento', event.target.value)}
              placeholder="Selecionar data"
              aria-invalid={Boolean(fieldErrors.data_nascimento)}
            />
          </Field>

          <Surface variant="muted" padding="sm" className="md:col-span-2">
            <FieldLabel className="flex items-start gap-3">
              <Checkbox
                size="md"
                checked={formData.bonus_por_vida_aplicado}
                onChange={(e) =>
                  setFormData({ ...formData, bonus_por_vida_aplicado: e.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-medium text-[var(--text-primary)]">
                  Aplicar bônus por vida
                </span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  Marque se este dependente é elegível ao bônus por vida deste contrato.
                </span>
              </span>
            </FieldLabel>
          </Surface>

          <Field label="Relação com titular *">
            <FilterSelect
              icon={Users}
              value={formData.relacao}
              onChange={(value) => updateField('relacao', value)}
              placeholder="Relação com titular"
              includePlaceholderOption={false}
              options={relacaoOptions}
            />
          </Field>

          <Field label="Valor individual (R$)">
            <Input
              type="text"
              leftIcon={DollarSign}
              autoFormat="currency"
              value={formData.valor_individual}
              onChange={(e) => updateField('valor_individual', e.target.value)}
              inputMode="numeric"
            />
          </Field>

          <Field label="Carência individual">
            <FilterSelect
              icon={Clock}
              value={formData.carencia_individual}
              onChange={(value) => updateField('carencia_individual', value)}
              placeholder="Carência individual"
              includePlaceholderOption={false}
              options={carenciaOptions}
            />
          </Field>

          <Field label="Elegibilidade" className="md:col-span-2">
            <Input
              type="text"
              leftIcon={BadgeCheck}
              value={formData.elegibilidade}
              onChange={(e) => updateField('elegibilidade', e.target.value)}
              placeholder="Ex: Filho menor de 21 anos"
            />
          </Field>
        </div>

      </form>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" form="dependent-form" loading={saving}>
          {saving ? 'Salvando...' : 'Salvar dependente'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
