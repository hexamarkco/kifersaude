import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  HeartPulse,
  Mail,
  MapPin,
  MapPinned,
  Search,
  User,
  UserCircle,
  WalletCards,
} from 'lucide-react';
import { supabase, type ContractHolder } from '../lib/supabase';
import { formatDateForInput } from '../lib/dateUtils';
import { BRAZIL_STATE_OPTIONS, fetchCitiesByState } from '../lib/brasilLocations';
import { consultarCep } from '../lib/cepService';
import { formatCep } from '../lib/inputFormatters';
import { consultarEmpresaPorCNPJ, consultarPessoaPorCPF } from '../lib/receitaService';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import DependentForm from './DependentForm';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import DateTimePicker from './ui/DateTimePicker';
import Field from './ui/Field';
import Input from './ui/Input';
import ModalShell from './ui/ModalShell';

type HolderFormProps = {
  contractId: string;
  modalidade: string;
  holder?: ContractHolder;
  initialData?: Partial<ContractHolder>;
  bonusPorVidaDefault?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function HolderForm({
  contractId,
  modalidade,
  holder,
  initialData,
  bonusPorVidaDefault,
  onClose,
  onSave,
}: HolderFormProps) {
  const [formData, setFormData] = useState({
    nome_completo: holder?.nome_completo || initialData?.nome_completo || '',
    cpf: holder?.cpf || initialData?.cpf || '',
    rg: holder?.rg || initialData?.rg || '',
    data_nascimento:
      formatDateForInput(holder?.data_nascimento || initialData?.data_nascimento) || '',
    sexo: holder?.sexo || initialData?.sexo || '',
    estado_civil: holder?.estado_civil || initialData?.estado_civil || '',
    telefone: holder?.telefone || initialData?.telefone || '',
    email: holder?.email || initialData?.email || '',
    cep: holder?.cep || initialData?.cep || '',
    endereco: holder?.endereco || initialData?.endereco || '',
    numero: holder?.numero || initialData?.numero || '',
    complemento: holder?.complemento || initialData?.complemento || '',
    bairro: holder?.bairro || initialData?.bairro || '',
    cidade: holder?.cidade || initialData?.cidade || '',
    estado: holder?.estado || initialData?.estado || '',
    cns: holder?.cns || initialData?.cns || '',
    cnpj: holder?.cnpj || initialData?.cnpj || '',
    razao_social: holder?.razao_social || initialData?.razao_social || '',
    nome_fantasia: holder?.nome_fantasia || initialData?.nome_fantasia || '',
    percentual_societario:
      holder?.percentual_societario?.toString() ||
      initialData?.percentual_societario?.toString() ||
      '',
    data_abertura_cnpj:
      formatDateForInput(holder?.data_abertura_cnpj || initialData?.data_abertura_cnpj) || '',
    bonus_por_vida_aplicado:
      holder?.bonus_por_vida_aplicado ??
      initialData?.bonus_por_vida_aplicado ??
      bonusPorVidaDefault ??
      true,
  });
  const [saving, setSaving] = useState(false);
  const [holders, setHolders] = useState<ContractHolder[]>([]);
  const [selectedHolderId, setSelectedHolderId] = useState<string | null>(holder?.id || null);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const isCNPJModalidade = useMemo(
    () => ['mei', 'cnpj', 'pme', 'empresarial'].some((item) => modalidade.toLowerCase().includes(item)),
    [modalidade],
  );
  const lastFetchedCepRef = useRef('');

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
        console.error('Erro ao carregar cidades do titular:', error);
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

  const handleCepSearch = async (cepValue?: string) => {
    const targetCep = cepValue ?? formData.cep;

    if (!targetCep || targetCep.replace(/\D/g, '').length !== 8) {
      return;
    }

    setLoadingCep(true);
    try {
      const data = await consultarCep(targetCep);
      const nextState = data?.uf?.trim().toUpperCase() || '';

      if (data) {
        setFormData((prev) => ({
          ...prev,
          cep: formatCep(targetCep),
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          complemento: data.complemento || prev.complemento,
          cidade: data.localidade || prev.cidade,
          estado: nextState || prev.estado,
        }));
        lastFetchedCepRef.current = targetCep.replace(/\D/g, '');
      }
    } catch (error) {
      console.error('Erro ao consultar CEP do titular:', error);
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
      cidade: prev.estado === normalizedState ? prev.cidade : '',
    }));
  };

  const handleConsultarCPF = async () => {
    if (!formData.cpf || !formData.data_nascimento) {
      setCpfLookupError('Informe CPF e data de nascimento para buscar.');
      return;
    }

    setCpfLookupError(null);
    setCpfLoading(true);

    try {
      const pessoa = await consultarPessoaPorCPF(formData.cpf, formData.data_nascimento);

      setFormData((prev) => ({
        ...prev,
        nome_completo: pessoa.nome || prev.nome_completo,
        data_nascimento: formatDateForInput(pessoa.data_nascimento) || prev.data_nascimento,
        sexo: pessoa.sexo || prev.sexo,
        cep: pessoa.cep ? formatCep(pessoa.cep) : prev.cep,
        endereco: pessoa.endereco || prev.endereco,
        numero: pessoa.numero || prev.numero,
        complemento: pessoa.complemento ?? prev.complemento,
        bairro: pessoa.bairro || prev.bairro,
        cidade: pessoa.cidade || prev.cidade,
        estado: pessoa.estado || prev.estado,
      }));

      if (pessoa.cep) {
        lastFetchedCepRef.current = pessoa.cep.replace(/\D/g, '');
      }
    } catch (error) {
      console.error('Erro ao consultar CPF:', error);
      setCpfLookupError(
        error instanceof Error ? error.message : 'Nao foi possivel consultar CPF',
      );
    } finally {
      setCpfLoading(false);
    }
  };

  const handleConsultarCNPJ = async () => {
    if (!formData.cnpj) {
      return;
    }

    setCnpjLookupError(null);
    setCnpjLoading(true);

    try {
      const empresa = await consultarEmpresaPorCNPJ(formData.cnpj);

      setFormData((prev) => ({
        ...prev,
        razao_social: empresa.razao_social || prev.razao_social,
        nome_fantasia: empresa.nome_fantasia || prev.nome_fantasia,
        cep: empresa.cep ? formatCep(empresa.cep) : prev.cep,
        endereco: empresa.endereco || prev.endereco,
        numero: empresa.numero || prev.numero,
        complemento: empresa.complemento ?? prev.complemento,
        bairro: empresa.bairro || prev.bairro,
        cidade: empresa.cidade || prev.cidade,
        estado: empresa.estado || prev.estado,
      }));

      if (empresa.cep) {
        lastFetchedCepRef.current = empresa.cep.replace(/\D/g, '');
      }
    } catch (error) {
      console.error('Erro ao consultar CNPJ:', error);
      setCnpjLookupError(
        error instanceof Error ? error.message : 'Nao foi possivel consultar CNPJ',
      );
    } finally {
      setCnpjLoading(false);
    }
  };

  const loadHolders = async () => {
    const { data, error } = await supabase
      .from('contract_holders')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at');

    if (error) throw error;
    const holdersData = data || [];
    setHolders(holdersData);
    return holdersData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.data_nascimento.trim()) {
        throw new Error('Informe a data de nascimento do titular');
      }

      const dataToSave = {
        contract_id: contractId,
        nome_completo: formData.nome_completo,
        cpf: formData.cpf,
        rg: formData.rg || null,
        data_nascimento: formData.data_nascimento,
        sexo: formData.sexo || null,
        estado_civil: formData.estado_civil || null,
        telefone: formData.telefone,
        email: formData.email || null,
        cep: formData.cep || null,
        endereco: formData.endereco || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        cns: formData.cns || null,
        cnpj: formData.cnpj || null,
        razao_social: formData.razao_social || null,
        nome_fantasia: formData.nome_fantasia || null,
        percentual_societario: formData.percentual_societario
          ? parseFloat(formData.percentual_societario)
          : null,
        data_abertura_cnpj: formData.data_abertura_cnpj || null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
      };

      if (holder) {
        const { error } = await supabase
          .from('contract_holders')
          .update(dataToSave)
          .eq('id', holder.id);

        if (error) throw error;
        setSelectedHolderId(holder.id);
      } else {
        const { data, error } = await supabase
          .from('contract_holders')
          .insert([dataToSave])
          .select('*')
          .single();

        if (error) throw error;
        setSelectedHolderId(data.id);
      }

      if (!holder) {
        await loadHolders();
        const confirmed = await requestConfirmation({
          title: 'Adicionar dependentes?',
          description: 'Deseja cadastrar dependentes para este contrato agora?',
          confirmLabel: 'Sim, adicionar',
          cancelLabel: 'Agora nao',
        });

        if (confirmed) {
          setShowDependentForm(true);
          return;
        }
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar titular:', error);
      alert('Erro ao salvar titular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ModalShell
        isOpen
        onClose={onClose}
        title={holder ? 'Editar Titular' : 'Dados do Titular'}
        size="xl"
        panelClassName="max-w-5xl"
        bodyClassName="p-0"
      >
        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="mb-4 text-base font-semibold text-slate-900">Informacoes Pessoais</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Nome Completo" required className="md:col-span-3">
                  <Input
                    type="text"
                    required
                    leftIcon={UserCircle}
                    value={formData.nome_completo}
                    onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                  />
                </Field>

                <Field label="CPF" required errorText={cpfLookupError || undefined}>
                  <div className="relative">
                    <Input
                      type="text"
                      required
                      leftIcon={WalletCards}
                      autoFormat="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => void handleConsultarCPF()}
                      disabled={cpfLoading || !formData.cpf || !formData.data_nascimento}
                      aria-label="Buscar CPF"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-amber-600 disabled:opacity-50"
                    >
                      <Search className={`h-5 w-5 ${cpfLoading ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </Field>

                <Field label="RG">
                  <Input
                    type="text"
                    leftIcon={WalletCards}
                    value={formData.rg}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
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

                <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-4">
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
                        Marque se este titular e elegivel ao bonus por vida deste contrato.
                      </span>
                    </span>
                  </label>
                </div>

                <Field label="Sexo">
                  <FilterSingleSelect
                    icon={User}
                    value={formData.sexo}
                    onChange={(value) => setFormData({ ...formData, sexo: value })}
                    placeholder="Selecione"
                    includePlaceholderOption={false}
                    options={[
                      { value: '', label: 'Selecione' },
                      { value: 'Masculino', label: 'Masculino' },
                      { value: 'Feminino', label: 'Feminino' },
                    ]}
                  />
                </Field>

                <Field label="Estado Civil">
                  <FilterSingleSelect
                    icon={User}
                    value={formData.estado_civil}
                    onChange={(value) => setFormData({ ...formData, estado_civil: value })}
                    placeholder="Selecione"
                    includePlaceholderOption={false}
                    options={[
                      { value: '', label: 'Selecione' },
                      { value: 'Solteiro(a)', label: 'Solteiro(a)' },
                      { value: 'Casado(a)', label: 'Casado(a)' },
                      { value: 'Divorciado(a)', label: 'Divorciado(a)' },
                      { value: 'Viuvo(a)', label: 'Viuvo(a)' },
                    ]}
                  />
                </Field>

                <Field label="Telefone" required>
                  <Input
                    type="tel"
                    required
                    leftIcon={HeartPulse}
                    autoFormat="phone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </Field>

                <Field label="E-mail" className="md:col-span-2">
                  <Input
                    type="email"
                    leftIcon={Mail}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </Field>

                <Field label="CNS (Cartao SUS)">
                  <Input
                    type="text"
                    leftIcon={WalletCards}
                    autoFormat="cns"
                    value={formData.cns}
                    onChange={(e) => setFormData({ ...formData, cns: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="mb-4 text-base font-semibold text-slate-900">Endereco</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="CEP">
                  <div className="relative">
                    <Input
                      type="text"
                      leftIcon={MapPin}
                      autoFormat="cep"
                      value={formData.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      maxLength={9}
                      placeholder="00000-000"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCepSearch()}
                      aria-label="Buscar CEP"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-amber-600"
                    >
                      <Search className={`h-5 w-5 ${loadingCep ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </Field>

                <Field label="Endereco" className="md:col-span-2">
                  <Input
                    type="text"
                    leftIcon={MapPinned}
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  />
                </Field>

                <Field label="Numero">
                  <Input
                    type="text"
                    leftIcon={MapPinned}
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  />
                </Field>

                <Field label="Complemento">
                  <Input
                    type="text"
                    leftIcon={MapPinned}
                    value={formData.complemento}
                    onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                  />
                </Field>

                <Field label="Bairro">
                  <Input
                    type="text"
                    leftIcon={MapPin}
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
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
                    onChange={(value) => setFormData({ ...formData, cidade: value })}
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
              </div>
            </section>

            {isCNPJModalidade && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h4 className="mb-4 text-base font-semibold text-slate-900">
                  Informacoes Empresariais
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="CNPJ" errorText={cnpjLookupError || undefined}>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        leftIcon={Building2}
                        autoFormat="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleConsultarCNPJ()}
                        loading={cnpjLoading}
                        className="shrink-0"
                      >
                        Buscar
                      </Button>
                    </div>
                  </Field>

                  <Field label="Data de Abertura do CNPJ">
                    <DateTimePicker
                      type="date"
                      value={formData.data_abertura_cnpj}
                      onChange={(value) =>
                        setFormData({ ...formData, data_abertura_cnpj: value })
                      }
                      placeholder="Selecionar data"
                    />
                  </Field>

                  <Field label="Razao Social">
                    <Input
                      type="text"
                      leftIcon={Building2}
                      value={formData.razao_social}
                      onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                    />
                  </Field>

                  <Field label="Nome Fantasia">
                    <Input
                      type="text"
                      leftIcon={Building2}
                      value={formData.nome_fantasia}
                      onChange={(e) =>
                        setFormData({ ...formData, nome_fantasia: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Percentual Societario (%)" className="md:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      max="100"
                      leftIcon={Building2}
                      value={formData.percentual_societario}
                      onChange={(e) =>
                        setFormData({ ...formData, percentual_societario: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </section>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? 'Salvando...' : 'Salvar Titular'}
            </Button>
          </div>
        </form>
      </ModalShell>

      {showDependentForm && (
        <DependentForm
          contractId={contractId}
          holders={holders}
          dependent={null}
          selectedHolderId={selectedHolderId}
          bonusPorVidaDefault={formData.bonus_por_vida_aplicado}
          onClose={() => {
            setShowDependentForm(false);
          }}
          onSave={() => {
            setShowDependentForm(false);
            onSave();
          }}
        />
      )}
      {ConfirmationDialog}
    </>
  );
}
