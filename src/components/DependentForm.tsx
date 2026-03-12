import { useEffect, useMemo, useRef, useState } from 'react';
import { HeartPulse, Search, UserCircle, Users, WalletCards } from 'lucide-react';
import { supabase, type ContractHolder, type Dependent } from '../lib/supabase';
import { formatDateForInput } from '../lib/dateUtils';
import { formatCurrencyInput, parseFormattedNumber } from '../lib/inputFormatters';
import { consultarPessoaPorCPF } from '../lib/receitaService';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import DateTimePicker from './ui/DateTimePicker';
import Field from './ui/Field';
import Input from './ui/Input';
import ModalShell from './ui/ModalShell';
import { toast } from '../lib/toast';

type DependentFormProps = {
  contractId: string;
  holders: ContractHolder[];
  dependent: Dependent | null;
  selectedHolderId?: string | null;
  bonusPorVidaDefault?: boolean;
  onClose: () => void;
  onSave: () => void;
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

  const [formData, setFormData] = useState({
    holder_id: defaultHolderId,
    nome_completo: dependent?.nome_completo || '',
    cpf: dependent?.cpf || '',
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
  const [saving, setSaving] = useState(false);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const lastFetchedCpfKeyRef = useRef('');

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      holder_id: dependent?.holder_id || selectedHolderId || holderOptions[0]?.value || '',
      nome_completo: dependent?.nome_completo || '',
      cpf: dependent?.cpf || '',
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
    }));
  }, [bonusPorVidaDefault, dependent, holderOptions, selectedHolderId]);

  const handleConsultarCPF = async ({ force = false, silent = false }: { force?: boolean; silent?: boolean } = {}) => {
    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      if (!silent) {
        setCpfLookupError('Informe um CPF válido para buscar.');
      }
      return;
    }

    const fetchKey = `${cleanCpf}:${formData.data_nascimento || 'sem-data'}`;
    if (!force && lastFetchedCpfKeyRef.current === fetchKey) {
      return;
    }

    setCpfLookupError(null);
    setCpfLoading(true);

    try {
      const pessoa = await consultarPessoaPorCPF(formData.cpf, formData.data_nascimento || undefined);

      setFormData((prev) => ({
        ...prev,
        nome_completo: pessoa.nome || prev.nome_completo,
        data_nascimento: formatDateForInput(pessoa.data_nascimento) || prev.data_nascimento,
      }));
      lastFetchedCpfKeyRef.current = fetchKey;
    } catch (error) {
      console.error('Erro ao consultar CPF do dependente:', error);
      if (!silent) {
        setCpfLookupError(
          error instanceof Error ? error.message : 'Nao foi possivel consultar CPF',
        );
      }
    } finally {
      setCpfLoading(false);
    }
  };

  useEffect(() => {
    const cleanCpf = formData.cpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      lastFetchedCpfKeyRef.current = '';
      return;
    }

    void handleConsultarCPF({ silent: true });
  }, [formData.cpf, formData.data_nascimento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.holder_id) {
        throw new Error('Selecione um titular para o dependente');
      }

      if (!formData.data_nascimento.trim()) {
        throw new Error('Informe a data de nascimento do dependente');
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

      if (dependent) {
        const { error } = await supabase
          .from('dependents')
          .update(dataToSave)
          .eq('id', dependent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('dependents').insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar dependente:', error);
      toast.error('Erro ao salvar dependente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={dependent ? 'Editar Dependente' : 'Novo Dependente'}
      size="md"
      panelClassName="max-w-2xl"
      bodyClassName="p-0"
    >
      <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Titular" required className="md:col-span-2">
            <FilterSingleSelect
              icon={Users}
              value={formData.holder_id}
              onChange={(value) => setFormData({ ...formData, holder_id: value })}
              placeholder="Selecione um titular"
              includePlaceholderOption={false}
              options={[
                { value: '', label: 'Selecione um titular' },
                ...holderOptions,
              ]}
            />
          </Field>

          <Field label="CPF" errorText={cpfLookupError || undefined}>
            <div className="relative">
            <Input
              type="text"
              leftIcon={WalletCards}
              autoFormat="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              className="pr-11"
              />
              <button
                type="button"
                onClick={() => void handleConsultarCPF({ force: true })}
                disabled={cpfLoading || formData.cpf.replace(/\D/g, '').length !== 11}
                aria-label="Buscar CPF"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-amber-600 disabled:opacity-50"
              >
                <Search className={`h-5 w-5 ${cpfLoading ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </Field>

          <Field label="Nome Completo" required>
            <Input
              type="text"
              required
              leftIcon={UserCircle}
              value={formData.nome_completo}
              onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
            />
          </Field>

          <Field label="Data de Nascimento" required>
            <DateTimePicker
              type="date"
              value={formData.data_nascimento}
              onChange={(value) => setFormData({ ...formData, data_nascimento: value })}
              placeholder="Selecionar data"
            />
          </Field>

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                size="md"
                checked={formData.bonus_por_vida_aplicado}
                onChange={(e) =>
                  setFormData({ ...formData, bonus_por_vida_aplicado: e.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  Aplicar bonus por vida
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Marque se este dependente e elegivel ao bonus por vida deste contrato.
                </span>
              </span>
            </label>
          </div>

          <Field label="Relacao com Titular" required>
            <FilterSingleSelect
              icon={Users}
              value={formData.relacao}
              onChange={(value) => setFormData({ ...formData, relacao: value })}
              placeholder="Relacao com titular"
              includePlaceholderOption={false}
              options={[
                { value: 'Conjuge', label: 'Conjuge' },
                { value: 'Filho(a)', label: 'Filho(a)' },
                { value: 'Enteado(a)', label: 'Enteado(a)' },
                { value: 'Pai/Mae', label: 'Pai/Mae' },
                { value: 'Outro', label: 'Outro' },
              ]}
            />
          </Field>

          <Field label="Valor Individual (R$)">
            <Input
              type="text"
              leftIcon={HeartPulse}
              autoFormat="currency"
              value={formData.valor_individual}
              onChange={(e) => setFormData({ ...formData, valor_individual: e.target.value })}
              inputMode="numeric"
            />
          </Field>

          <Field label="Carencia Individual">
            <FilterSingleSelect
              icon={Users}
              value={formData.carencia_individual}
              onChange={(value) => setFormData({ ...formData, carencia_individual: value })}
              placeholder="Carencia individual"
              includePlaceholderOption={false}
              options={[
                { value: '', label: 'Mesma do titular' },
                { value: 'padrao', label: 'Padrao' },
                { value: 'reduzida', label: 'Reduzida' },
                { value: 'portabilidade', label: 'Portabilidade' },
                { value: 'zero', label: 'Zero' },
              ]}
            />
          </Field>

          <Field label="Elegibilidade" className="md:col-span-2">
            <Input
              type="text"
              leftIcon={Users}
              value={formData.elegibilidade}
              onChange={(e) => setFormData({ ...formData, elegibilidade: e.target.value })}
              placeholder="Ex: Filho menor de 21 anos"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : 'Salvar Dependente'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
