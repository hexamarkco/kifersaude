import { useState, useEffect, useMemo, useRef } from "react";
import {
  supabase,
  Contract,
  Lead,
  ContractHolder,
  ContractValueAdjustment,
  Operadora,
  fetchAllPages,
  ContractBonusConfiguration,
  ContractCommissionInstallment,
} from "../lib/supabase";
import {
  getContractBonusSummary,
  normalizeBonusConfigurations,
} from "../lib/contractBonus";
import { getCommissionInstallmentSummary } from "../lib/contractCommission";
import {
  getContractSignupFeeValue,
  isAdesaoContract,
} from "../lib/contractSignupFee";
import {
  normalizeSentenceCase,
  normalizeTitleCase,
} from "../lib/textNormalization";
import { normalizeLeadStatusLabel } from "../lib/leadReminderUtils";
import { resolveStatusIdByName } from "../lib/leadRelations";
import {
  User,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Search,
  Calendar,
  Building2,
  WalletCards,
} from "lucide-react";
import HolderForm from "./HolderForm";
import ValueAdjustmentForm from "./ValueAdjustmentForm";
import FilterSingleSelect from "./FilterSingleSelect";
import Button from "./ui/Button";
import Checkbox from "./ui/Checkbox";
import DateTimePicker from "./ui/DateTimePicker";
import ModalShell from "./ui/ModalShell";
import { configService } from "../lib/configService";
import { useConfig } from "../contexts/ConfigContext";
import { useConfirmationModal } from "../hooks/useConfirmationModal";
import { toast } from "../lib/toast";
import {
  formatCnpj,
  formatCurrencyFromNumber,
  formatCurrencyInput,
  parseFormattedNumber,
} from "../lib/inputFormatters";
import { consultarEmpresaPorCNPJ } from "../lib/receitaService";

const normalizeOperadoraName = (value?: string | null) =>
  normalizeTitleCase(value) ?? value?.trim() ?? "";

type CommissionInstallment = {
  valor: string;
  data_pagamento: string;
};

type BonusDistributionRow = {
  id: string;
  quantidade: string;
  valor: string;
};

type SignupFeeType = NonNullable<Contract["taxa_adesao_tipo"]>;

const DEFAULT_SIGNUP_FEE_TYPE: SignupFeeType = "nao_cobrar";

const SIGNUP_FEE_TYPE_OPTIONS: Array<{ value: SignupFeeType; label: string }> =
  [
    { value: "nao_cobrar", label: "Nao cobrar" },
    { value: "percentual_mensalidade", label: "% da mensalidade" },
    { value: "valor_fixo", label: "Valor fixo" },
  ];

const isSignupFeeType = (value: string): value is SignupFeeType =>
  SIGNUP_FEE_TYPE_OPTIONS.some((option) => option.value === value);

type ContractFormProps = {
  contract: Contract | null;
  leadToConvert?: Lead | null;
  onClose: () => void;
  onSave: () => void;
};

export default function ContractForm({
  contract,
  leadToConvert,
  onClose,
  onSave,
}: ContractFormProps) {
  const createBonusRow = (
    quantidade = "",
    valor = "",
  ): BonusDistributionRow => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quantidade,
    valor,
  });

  const getInitialBonusRows = (): BonusDistributionRow[] => {
    const configured = normalizeBonusConfigurations(
      contract?.bonus_por_vida_configuracoes,
    );
    if (configured.length > 0) {
      return configured.map((item) => ({
        id: item.id,
        quantidade: item.quantidade.toString(),
        valor: formatCurrencyFromNumber(item.valor),
      }));
    }

    if (contract?.bonus_por_vida_aplicado && contract?.bonus_por_vida_valor) {
      const summary = getContractBonusSummary(contract);
      return [
        createBonusRow(
          summary.eligibleLives.toString(),
          formatCurrencyFromNumber(contract.bonus_por_vida_valor),
        ),
      ];
    }

    return [];
  };

  const initialSignupFeeType: SignupFeeType =
    contract?.taxa_adesao_tipo ?? DEFAULT_SIGNUP_FEE_TYPE;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const { options, leadStatuses } = useConfig();
  const [formData, setFormData] = useState({
    codigo_contrato: contract?.codigo_contrato || "",
    lead_id: contract?.lead_id || leadToConvert?.id || "",
    status: contract?.status || "",
    modalidade: contract?.modalidade || leadToConvert?.tipo_contratacao || "",
    operadora: normalizeOperadoraName(
      contract?.operadora || leadToConvert?.operadora_atual || "",
    ),
    produto_plano: contract?.produto_plano || "",
    abrangencia: contract?.abrangencia || "",
    acomodacao: contract?.acomodacao || "",
    data_inicio: contract?.data_inicio || "",
    data_renovacao: contract?.data_renovacao
      ? contract.data_renovacao.substring(0, 7)
      : "",
    mes_reajuste: contract?.mes_reajuste
      ? contract.mes_reajuste.toString().padStart(2, "0")
      : "",
    carencia: contract?.carencia || "",
    mensalidade_total: formatCurrencyFromNumber(contract?.mensalidade_total),
    comissao_prevista: formatCurrencyFromNumber(contract?.comissao_prevista),
    comissao_multiplicador:
      contract?.comissao_multiplicador?.toString() || "2.8",
    taxa_adesao_tipo: initialSignupFeeType,
    taxa_adesao_percentual:
      contract?.taxa_adesao_percentual?.toString() || "100",
    taxa_adesao_valor: formatCurrencyFromNumber(contract?.taxa_adesao_valor),
    comissao_recebimento_adiantado:
      contract?.comissao_recebimento_adiantado ?? true,
    previsao_recebimento_comissao:
      contract?.previsao_recebimento_comissao || "",
    previsao_pagamento_bonificacao:
      contract?.previsao_pagamento_bonificacao || "",
    vidas: contract?.vidas?.toString() || "1",
    vidas_elegiveis_bonus: contract?.vidas_elegiveis_bonus?.toString() || "",
    bonus_por_vida_valor: formatCurrencyFromNumber(
      contract?.bonus_por_vida_valor,
    ),
    bonus_por_vida_aplicado: contract?.bonus_por_vida_aplicado || false,
    responsavel: contract?.responsavel || leadToConvert?.responsavel || "",
    observacoes_internas: contract?.observacoes_internas || "",
    cnpj: formatCnpj(contract?.cnpj || ""),
    razao_social: contract?.razao_social || "",
    nome_fantasia: contract?.nome_fantasia || "",
    endereco_empresa: contract?.endereco_empresa || "",
  });
  const [commissionInstallments, setCommissionInstallments] = useState<
    CommissionInstallment[]
  >(() => {
    const summary = getCommissionInstallmentSummary({
      comissao_prevista: contract?.comissao_prevista,
      comissao_parcelas: contract?.comissao_parcelas,
      mensalidade_total: contract?.mensalidade_total,
    });

    return summary.installments.map((parcel) => ({
      valor: formatCurrencyFromNumber(parcel.resolvedValue),
      data_pagamento: parcel.data_pagamento ?? "",
    }));
  });
  const [bonusDistribution, setBonusDistribution] = useState<
    BonusDistributionRow[]
  >(() => getInitialBonusRows());
  const [saving, setSaving] = useState(false);
  const [showHolderForm, setShowHolderForm] = useState(false);
  const [contractId, setContractId] = useState<string | null>(
    contract?.id || null,
  );
  const [adjustments, setAdjustments] = useState<ContractValueAdjustment[]>([]);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [editingAdjustment, setEditingAdjustment] =
    useState<ContractValueAdjustment | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastFetchedCnpjRef = useRef("");
  const contractStatusOptions = useMemo(
    () => (options.contract_status || []).filter((option) => option.ativo),
    [options.contract_status],
  );
  const modalidadeOptions = useMemo(
    () => (options.contract_modalidade || []).filter((option) => option.ativo),
    [options.contract_modalidade],
  );
  const abrangenciaOptions = useMemo(
    () => (options.contract_abrangencia || []).filter((option) => option.ativo),
    [options.contract_abrangencia],
  );
  const acomodacaoOptions = useMemo(
    () => (options.contract_acomodacao || []).filter((option) => option.ativo),
    [options.contract_acomodacao],
  );
  const carenciaOptions = useMemo(
    () => (options.contract_carencia || []).filter((option) => option.ativo),
    [options.contract_carencia],
  );
  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo),
    [options.lead_responsavel],
  );
  const normalizedOperadoras = useMemo(() => {
    const operadoraMap = new Map<string, Operadora>();

    operadoras.forEach((operadora) => {
      const normalizedName = normalizeOperadoraName(operadora.nome);
      if (normalizedName && !operadoraMap.has(normalizedName)) {
        operadoraMap.set(normalizedName, { ...operadora, nome: normalizedName });
      }
    });

    return Array.from(operadoraMap.values()).sort((left, right) =>
      left.nome.localeCompare(right.nome, "pt-BR"),
    );
  }, [operadoras]);
  const modalidadeRequerCNPJ = useMemo(() => {
    const normalized = (formData.modalidade || "").toLowerCase();
    return ["pme", "empresarial", "cnpj"].some((keyword) =>
      normalized.includes(keyword),
    );
  }, [formData.modalidade]);
  const isAdesaoModalidade = useMemo(
    () => isAdesaoContract(formData.modalidade),
    [formData.modalidade],
  );
  const convertibleLeadStatuses = useMemo(
    () =>
      leadStatuses
        .filter((status) => status.ativo)
        .map((status) => status.nome),
    [leadStatuses],
  );
  const convertedLeadStatus = useMemo(
    () =>
      leadStatuses.find((status) => {
        const normalizedStatus = normalizeLeadStatusLabel(status.nome);
        return (
          normalizedStatus === "convertido" || normalizedStatus === "fechado"
        );
      }) ?? null,
    [leadStatuses],
  );

  const totalInstallmentValue = useMemo(
    () =>
      commissionInstallments.reduce((sum, parcel) => {
        const valor = parseFormattedNumber(parcel.valor || "");
        return sum + (Number.isFinite(valor) ? valor : 0);
      }, 0),
    [commissionInstallments],
  );

  useEffect(() => {
    if (!contract && !formData.status && contractStatusOptions.length > 0) {
      setFormData((prev) => ({
        ...prev,
        status: contractStatusOptions[0].value,
      }));
    }
  }, [contract, contractStatusOptions, formData.status]);

  useEffect(() => {
    if (!contract && !formData.modalidade && modalidadeOptions.length > 0) {
      const defaultValue =
        leadToConvert?.tipo_contratacao &&
        modalidadeOptions.some(
          (option) => option.value === leadToConvert.tipo_contratacao,
        )
          ? leadToConvert.tipo_contratacao
          : modalidadeOptions[0].value;
      setFormData((prev) => ({ ...prev, modalidade: defaultValue }));
    }
  }, [
    contract,
    modalidadeOptions,
    formData.modalidade,
    leadToConvert?.tipo_contratacao,
  ]);

  useEffect(() => {
    if (!contract && !formData.abrangencia && abrangenciaOptions.length > 0) {
      setFormData((prev) => ({
        ...prev,
        abrangencia: abrangenciaOptions[0].value,
      }));
    }
  }, [contract, abrangenciaOptions, formData.abrangencia]);

  useEffect(() => {
    if (!contract && !formData.acomodacao && acomodacaoOptions.length > 0) {
      setFormData((prev) => ({
        ...prev,
        acomodacao: acomodacaoOptions[0].value,
      }));
    }
  }, [contract, acomodacaoOptions, formData.acomodacao]);

  useEffect(() => {
    if (!contract && !formData.carencia && carenciaOptions.length > 0) {
      setFormData((prev) => ({ ...prev, carencia: carenciaOptions[0].value }));
    }
  }, [contract, carenciaOptions, formData.carencia]);

  useEffect(() => {
    if (!contract && !formData.responsavel && responsavelOptions.length > 0) {
      const defaultResponsavel =
        leadToConvert?.responsavel &&
        responsavelOptions.some(
          (option) => option.value === leadToConvert.responsavel,
        )
          ? leadToConvert.responsavel
          : responsavelOptions[0].value;
      setFormData((prev) => ({ ...prev, responsavel: defaultResponsavel }));
    }
  }, [
    contract,
    responsavelOptions,
    formData.responsavel,
    leadToConvert?.responsavel,
  ]);

  useEffect(() => {
    loadLeads();
    loadOperadoras();
    if (contract?.id) {
      loadAdjustments(contract.id);
    }
  }, [contract?.id, convertibleLeadStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const normalizedCnpj = formData.cnpj.replace(/\D/g, "");

    if (!modalidadeRequerCNPJ || normalizedCnpj.length !== 14) {
      if (normalizedCnpj.length < 14) {
        lastFetchedCnpjRef.current = "";
      }
      return;
    }

    if (lastFetchedCnpjRef.current === normalizedCnpj) {
      return;
    }

    void handleConsultarCNPJ();
  }, [formData.cnpj, modalidadeRequerCNPJ]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseMensalidade = parseFormattedNumber(
    formData.mensalidade_total || "",
  );
  const adjustedMensalidade = useMemo(() => {
    let total = baseMensalidade;
    adjustments.forEach((adj) => {
      if (adj.tipo === "acrescimo") {
        total += adj.valor;
      } else {
        total -= adj.valor;
      }
    });
    return total;
  }, [baseMensalidade, adjustments]);
  const signupFeePreview = useMemo(
    () =>
      getContractSignupFeeValue({
        mensalidade_total: adjustedMensalidade || baseMensalidade,
        taxa_adesao_tipo: formData.taxa_adesao_tipo,
        taxa_adesao_percentual: formData.taxa_adesao_percentual
          ? parseFloat(formData.taxa_adesao_percentual)
          : null,
        taxa_adesao_valor: formData.taxa_adesao_valor
          ? parseFormattedNumber(formData.taxa_adesao_valor)
          : null,
      }),
    [
      adjustedMensalidade,
      baseMensalidade,
      formData.taxa_adesao_percentual,
      formData.taxa_adesao_tipo,
      formData.taxa_adesao_valor,
    ],
  );

  const totalCommissionFromInstallments = useMemo(
    () => totalInstallmentValue,
    [totalInstallmentValue],
  );
  const commissionExpectedValue = parseFormattedNumber(
    formData.comissao_prevista || "",
  );

  const handleSignupFeeTypeChange = (value: string) => {
    const nextSignupFeeType = isSignupFeeType(value)
      ? value
      : DEFAULT_SIGNUP_FEE_TYPE;

    setFormData((currentFormData) => ({
      ...currentFormData,
      taxa_adesao_tipo: nextSignupFeeType,
    }));
  };
  const remainingCommissionValue = Math.max(
    0,
    commissionExpectedValue - totalInstallmentValue,
  );

  useEffect(() => {
    if (adjustedMensalidade > 0) {
      const multiplicador = parseFloat(formData.comissao_multiplicador || "0");
      const effectivePercentual = multiplicador;

      if (!isNaN(effectivePercentual)) {
        const comissao = adjustedMensalidade * effectivePercentual;
        setFormData((prev) => ({
          ...prev,
          comissao_prevista: formatCurrencyFromNumber(comissao),
        }));
      }
    }
  }, [
    adjustedMensalidade,
    formData.comissao_multiplicador,
    formData.comissao_recebimento_adiantado,
    totalInstallmentValue,
    adjustments,
  ]);

  const loadLeads = async () => {
    try {
      const data = await fetchAllPages<Lead>(async (from, to) => {
        let query = supabase.from("leads").select("*").eq("arquivado", false);

        if (convertibleLeadStatuses.length > 0) {
          query = query.in("status", convertibleLeadStatuses);
        }

        const response = await query.order("nome_completo").range(from, to);
        return { data: response.data, error: response.error };
      });

      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    }
  };

  const loadOperadoras = async () => {
    const data = await configService.getOperadoras();
    setOperadoras(data.filter((op) => op.ativo));
  };

  const handleOperadoraChange = (operadoraNome: string) => {
    const normalizedOperadora = normalizeOperadoraName(operadoraNome);
    const operadora = operadoras.find(
      (op) => normalizeOperadoraName(op.nome) === normalizedOperadora,
    );

    if (operadora) {
      setFormData((prev) => ({
        ...prev,
        operadora: normalizedOperadora,
        bonus_por_vida_aplicado: operadora.bonus_por_vida,
        bonus_por_vida_valor:
          operadora.bonus_padrao > 0
            ? formatCurrencyFromNumber(operadora.bonus_padrao)
            : prev.bonus_por_vida_valor,
      }));
      if (operadora.bonus_por_vida && operadora.bonus_padrao > 0) {
        setBonusDistribution((current) => {
          if (current.length > 0) return current;
          return [
            createBonusRow(
              formData.vidas || "1",
              formatCurrencyFromNumber(operadora.bonus_padrao),
            ),
          ];
        });
      }
    } else {
      setFormData((prev) => ({ ...prev, operadora: normalizedOperadora }));
    }
  };

  const handleConsultarCNPJ = async () => {
    const normalizedCnpj = formData.cnpj.replace(/\D/g, "");
    if (normalizedCnpj.length !== 14) {
      return;
    }

    setCnpjLookupError(null);
    setCnpjLoading(true);

    try {
      const empresa = await consultarEmpresaPorCNPJ(formData.cnpj);
      const enderecoCompleto = [
        empresa.endereco,
        empresa.numero,
        empresa.bairro,
        empresa.cidade && empresa.estado
          ? `${empresa.cidade} - ${empresa.estado}`
          : empresa.cidade,
        empresa.cep ? `CEP: ${empresa.cep}` : "",
      ]
        .filter(Boolean)
        .join(", ");

      setFormData((prev) => ({
        ...prev,
        razao_social: empresa.razao_social || prev.razao_social,
        nome_fantasia: empresa.nome_fantasia || prev.nome_fantasia,
        endereco_empresa: enderecoCompleto || prev.endereco_empresa,
      }));
      lastFetchedCnpjRef.current = normalizedCnpj;
    } catch (error) {
      console.error("Erro ao consultar CNPJ do contrato:", error);
      setCnpjLookupError(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar CNPJ",
      );
    } finally {
      setCnpjLoading(false);
    }
  };

  const loadAdjustments = async (contractId: string) => {
    try {
      const { data, error } = await supabase
        .from("contract_value_adjustments")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at");

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error) {
      console.error("Erro ao carregar ajustes:", error);
    }
  };

  const vidasNumber = parseFloat(formData.vidas || "1") || 1;
  const normalizedBonusDistribution = bonusDistribution
    .map((row) => ({
      id: row.id,
      quantidade: Math.max(0, parseInt(row.quantidade || "0", 10) || 0),
      valor: parseFormattedNumber(row.valor || ""),
    }))
    .filter((row) => row.quantidade > 0 && row.valor > 0);
  const distributedBonusLives = normalizedBonusDistribution.reduce(
    (total, row) => total + row.quantidade,
    0,
  );
  const distributedBonusTotal = normalizedBonusDistribution.reduce(
    (total, row) => total + row.quantidade * row.valor,
    0,
  );
  const livesWithoutBonus = Math.max(0, vidasNumber - distributedBonusLives);
  const bonusTotal = distributedBonusTotal;

  const handleToggleBonus = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, bonus_por_vida_aplicado: checked }));
    if (checked && bonusDistribution.length === 0) {
      setBonusDistribution([
        createBonusRow(
          formData.vidas || "1",
          formData.bonus_por_vida_valor || "",
        ),
      ]);
    }
  };

  const handleBonusRowChange = (
    id: string,
    field: keyof Omit<BonusDistributionRow, "id">,
    value: string,
  ) => {
    setBonusDistribution((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]:
                field === "valor"
                  ? formatCurrencyInput(value)
                  : value.replace(/\D/g, ""),
            }
          : row,
      ),
    );
  };

  const handleAddBonusRow = () => {
    const remainingLives = Math.max(0, vidasNumber - distributedBonusLives);
    setBonusDistribution((current) => [
      ...current,
      createBonusRow(remainingLives > 0 ? String(remainingLives) : "", ""),
    ]);
  };

  const handleRemoveBonusRow = (id: string) => {
    setBonusDistribution((current) => current.filter((row) => row.id !== id));
  };

  const handleAddInstallment = () => {
    setCommissionInstallments([
      ...commissionInstallments,
      { valor: "", data_pagamento: "" },
    ]);
  };

  const handleRemoveInstallment = (index: number) => {
    setCommissionInstallments(
      commissionInstallments.filter((_, i) => i !== index),
    );
  };

  const handleInstallmentChange = (
    index: number,
    field: keyof CommissionInstallment,
    value: string,
  ) => {
    const updated = [...commissionInstallments];
    updated[index] = {
      ...updated[index],
      [field]: field === "valor" ? formatCurrencyInput(value) : value,
    };
    setCommissionInstallments(updated);
  };

  const handleDeleteAdjustment = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: "Remover ajuste",
      description:
        "Deseja remover este ajuste? Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("contract_value_adjustments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      if (contract?.id) {
        await loadAdjustments(contract.id);
      }
    } catch (error) {
      console.error("Erro ao remover ajuste:", error);
      toast.error("Erro ao remover ajuste.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const codigo = formData.codigo_contrato.trim();

      if (!codigo) {
        toast.warning("Informe o código do contrato.");
        return;
      }

      const requiredValues = [
        { value: formData.status.trim(), label: "status" },
        { value: formData.modalidade.trim(), label: "modalidade" },
        { value: formData.operadora.trim(), label: "operadora" },
        { value: formData.produto_plano.trim(), label: "produto/plano" },
        { value: formData.responsavel.trim(), label: "responsável" },
      ];

      const missingRequired = requiredValues.find((item) => !item.value);
      if (missingRequired) {
        toast.warning(
          `Preencha o campo obrigatório: ${missingRequired.label}.`,
        );
        return;
      }

      const installmentsPayload: ContractCommissionInstallment[] =
        commissionInstallments
          .map((parcel) => ({
            valor: parseFormattedNumber(parcel.valor || ""),
            data_pagamento: parcel.data_pagamento || null,
          }))
          .filter((parcel) => (parcel.valor || 0) > 0);

      if (!formData.comissao_recebimento_adiantado) {
        if (installmentsPayload.length === 0) {
          toast.warning(
            "Adicione ao menos uma parcela de comissão ou marque como adiantamento.",
          );
          setSaving(false);
          return;
        }

        const hasMissingDates = installmentsPayload.some(
          (parcel) => !parcel.data_pagamento,
        );
        if (hasMissingDates) {
          toast.warning(
            "Informe a data prevista de pagamento para cada parcela.",
          );
          setSaving(false);
          return;
        }

        if (commissionExpectedValue <= 0) {
          toast.warning(
            "Informe a comissão prevista antes de distribuir em parcelas.",
          );
          setSaving(false);
          return;
        }

        if (totalInstallmentValue > commissionExpectedValue) {
          toast.warning(
            "O total das parcelas não pode ultrapassar o valor total da comissão.",
          );
          setSaving(false);
          return;
        }
      }

      if (formData.bonus_por_vida_aplicado) {
        if (normalizedBonusDistribution.length === 0) {
          toast.warning("Adicione ao menos uma faixa de bônus por vida.");
          setSaving(false);
          return;
        }

        if (distributedBonusLives > vidasNumber) {
          toast.warning(
            "A soma das vidas com bônus não pode ultrapassar a quantidade total de vidas.",
          );
          setSaving(false);
          return;
        }
      }

      const bonusConfigurationsPayload: ContractBonusConfiguration[] =
        normalizedBonusDistribution.map((row) => ({
          id: row.id,
          quantidade: row.quantidade,
          valor: row.valor,
        }));
      const singleBonusValue =
        bonusConfigurationsPayload.length === 1
          ? bonusConfigurationsPayload[0].valor
          : null;

      const dataToSave = {
        codigo_contrato: codigo,
        lead_id: formData.lead_id || null,
        status: formData.status,
        modalidade: formData.modalidade,
        operadora: formData.operadora,
        produto_plano: formData.produto_plano,
        abrangencia: formData.abrangencia || null,
        acomodacao: formData.acomodacao || null,
        data_inicio: formData.data_inicio || null,
        data_renovacao: formData.data_renovacao
          ? `${formData.data_renovacao}-01`
          : null,
        mes_reajuste: formData.mes_reajuste
          ? parseInt(formData.mes_reajuste, 10)
          : null,
        carencia: formData.carencia || null,
        mensalidade_total: formData.mensalidade_total
          ? parseFormattedNumber(formData.mensalidade_total)
          : null,
        comissao_prevista: formData.comissao_prevista
          ? parseFormattedNumber(formData.comissao_prevista)
          : null,
        comissao_multiplicador: formData.comissao_multiplicador
          ? parseFloat(formData.comissao_multiplicador)
          : 2.8,
        taxa_adesao_tipo: isAdesaoModalidade
          ? formData.taxa_adesao_tipo
          : "nao_cobrar",
        taxa_adesao_percentual:
          isAdesaoModalidade &&
          formData.taxa_adesao_tipo === "percentual_mensalidade"
            ? parseFloat(formData.taxa_adesao_percentual || "0")
            : null,
        taxa_adesao_valor:
          isAdesaoModalidade && formData.taxa_adesao_tipo === "valor_fixo"
            ? parseFormattedNumber(formData.taxa_adesao_valor || "")
            : null,
        comissao_recebimento_adiantado: formData.comissao_recebimento_adiantado,
        comissao_parcelas: formData.comissao_recebimento_adiantado
          ? []
          : installmentsPayload,
        previsao_recebimento_comissao:
          formData.previsao_recebimento_comissao || null,
        previsao_pagamento_bonificacao:
          formData.previsao_pagamento_bonificacao || null,
        vidas: formData.vidas ? parseInt(formData.vidas, 10) : 1,
        vidas_elegiveis_bonus: formData.bonus_por_vida_aplicado
          ? distributedBonusLives
          : null,
        bonus_por_vida_configuracoes: formData.bonus_por_vida_aplicado
          ? bonusConfigurationsPayload
          : [],
        bonus_por_vida_valor: formData.bonus_por_vida_aplicado
          ? singleBonusValue
          : null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
        responsavel: formData.responsavel,
        observacoes_internas: formData.observacoes_internas || null,
      };

      const normalizedContractData = {
        ...dataToSave,
        status: normalizeSentenceCase(dataToSave.status) ?? dataToSave.status,
        modalidade:
          normalizeSentenceCase(dataToSave.modalidade) ?? dataToSave.modalidade,
        operadora: normalizeOperadoraName(dataToSave.operadora) || dataToSave.operadora,
        produto_plano:
          normalizeSentenceCase(dataToSave.produto_plano) ??
          dataToSave.produto_plano,
        abrangencia: normalizeSentenceCase(dataToSave.abrangencia),
        acomodacao: normalizeSentenceCase(dataToSave.acomodacao),
        carencia: normalizeSentenceCase(dataToSave.carencia),
        responsavel:
          normalizeTitleCase(dataToSave.responsavel) ?? dataToSave.responsavel,
      };

      if (contract) {
        const { error } = await supabase
          .from("contracts")
          .update(normalizedContractData)
          .eq("id", contract.id);

        if (error) throw error;
        onSave();
      } else {
        const { data, error } = await supabase
          .from("contracts")
          .insert([normalizedContractData])
          .select()
          .single();

        if (error) throw error;

        if (leadToConvert) {
          const conversionTimestamp = new Date().toISOString();
          const previousLeadStatus = leadToConvert.status ?? "";
          const nextLeadStatus =
            convertedLeadStatus?.nome ?? previousLeadStatus;
          const nextLeadStatusId =
            convertedLeadStatus?.id ??
            resolveStatusIdByName(leadStatuses, nextLeadStatus);
          const leadUpdatePayload: {
            ultimo_contato: string;
            proximo_retorno: null;
            status?: string;
            status_id?: string | null;
          } = {
            ultimo_contato: conversionTimestamp,
            proximo_retorno: null,
          };

          if (nextLeadStatus) {
            leadUpdatePayload.status = nextLeadStatus;
            leadUpdatePayload.status_id = nextLeadStatusId;
          }

          const { error: leadUpdateError } = await supabase
            .from("leads")
            .update(leadUpdatePayload)
            .eq("id", leadToConvert.id);

          if (leadUpdateError) throw leadUpdateError;

          const { error: deleteRemindersError } = await supabase
            .from("reminders")
            .delete()
            .eq("lead_id", leadToConvert.id);

          if (deleteRemindersError) throw deleteRemindersError;

          if (nextLeadStatus && nextLeadStatus !== previousLeadStatus) {
            const interactionPayload = {
              lead_id: leadToConvert.id,
              tipo: "Observacao",
              descricao: `Status alterado de "${previousLeadStatus}" para "${nextLeadStatus}" (via conversao em contrato)`,
              responsavel: leadToConvert.responsavel,
            };

            const { error: interactionError } = await supabase
              .from("interactions")
              .insert([interactionPayload]);

            if (interactionError) throw interactionError;

            const { error: statusHistoryError } = await supabase
              .from("lead_status_history")
              .insert([
                {
                  lead_id: leadToConvert.id,
                  status_anterior: previousLeadStatus,
                  status_novo: nextLeadStatus,
                  responsavel: leadToConvert.responsavel,
                },
              ]);

            if (statusHistoryError) throw statusHistoryError;
          }
        }

        setContractId(data.id);
        setShowHolderForm(true);
      }
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
      toast.error("Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  };

  if (showHolderForm && contractId) {
    const initialHolderData: Partial<ContractHolder> = {
      cnpj: formData.cnpj || undefined,
      razao_social: formData.razao_social || undefined,
      nome_fantasia: formData.nome_fantasia || undefined,
      endereco: formData.endereco_empresa || undefined,
    };

    return (
      <HolderForm
        contractId={contractId}
        modalidade={formData.modalidade}
        initialData={initialHolderData}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  return (
    <>
      <ModalShell
        isOpen
        onClose={onClose}
        title={
          contract
            ? "Editar Contrato"
            : leadToConvert
              ? "Converter Lead em Contrato"
              : "Novo Contrato"
        }
        description={
          leadToConvert
            ? `Lead: ${leadToConvert.nome_completo} - ${leadToConvert.telefone}`
            : undefined
        }
        size="xl"
        panelClassName="max-w-4xl"
        bodyClassName="p-0"
      >
        <form
          onSubmit={handleSubmit}
          className="max-h-[70vh] overflow-y-auto p-6"
        >
          <div className="mb-6 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] p-4">
            <h4 className="comm-title mb-3 flex items-center font-semibold">
              <Building2 className="w-5 h-5 mr-2 text-amber-600" />
              Informações do Contrato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Código do Contrato
                </label>
                <input
                  type="text"
                  required
                  value={formData.codigo_contrato}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      codigo_contrato: e.target.value,
                    })
                  }
                  placeholder="Informe o código fornecido pela operadora"
                  className="panel-ui-input w-full rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Lead Vinculado
                </label>
                <FilterSingleSelect
                  icon={User}
                  value={formData.lead_id}
                  onChange={(value) =>
                    setFormData({ ...formData, lead_id: value })
                  }
                  placeholder="Lead vinculado"
                  includePlaceholderOption={false}
                  options={[
                    { value: "", label: "Nenhum" },
                    ...leads.map((lead) => ({
                      value: lead.id,
                      label: lead.nome_completo,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Status *
                </label>
                {contractStatusOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.status}
                    onChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                    placeholder="Status"
                    includePlaceholderOption={false}
                    options={contractStatusOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="panel-ui-input w-full rounded-lg px-4 py-2"
                    placeholder="Configure os status de contrato"
                  />
                )}
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Modalidade *
                </label>
                {modalidadeOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.modalidade}
                    onChange={(value) =>
                      setFormData({ ...formData, modalidade: value })
                    }
                    placeholder="Modalidade"
                    includePlaceholderOption={false}
                    options={modalidadeOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.modalidade}
                    onChange={(e) =>
                      setFormData({ ...formData, modalidade: e.target.value })
                    }
                    className="panel-ui-input w-full rounded-lg px-4 py-2"
                    placeholder="Informe a modalidade"
                  />
                )}
              </div>

              {modalidadeRequerCNPJ && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CNPJ (Receita)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.cnpj}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cnpj: formatCnpj(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        inputMode="numeric"
                        maxLength={18}
                      />
                      <button
                        type="button"
                        onClick={handleConsultarCNPJ}
                        disabled={cnpjLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          cnpjLoading ? "Buscando..." : "Buscar na Receita"
                        }
                      >
                        <Search
                          className={`w-5 h-5 ${cnpjLoading ? "animate-pulse" : ""}`}
                        />
                      </button>
                    </div>
                    {cnpjLookupError && (
                      <p className="text-xs text-red-600 mt-1">
                        {cnpjLookupError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={formData.razao_social}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          razao_social: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={formData.nome_fantasia}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nome_fantasia: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Endereço da Empresa (Receita)
                    </label>
                    <textarea
                      value={formData.endereco_empresa}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endereco_empresa: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      rows={2}
                      placeholder="Preenchido automaticamente pela consulta do CNPJ"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Operadora *
                </label>
                <FilterSingleSelect
                  icon={Search}
                  value={formData.operadora}
                  onChange={(value) => handleOperadoraChange(value)}
                  placeholder="Selecione uma operadora"
                  includePlaceholderOption={false}
                  options={[
                    { value: "", label: "Selecione uma operadora" },
                    ...normalizedOperadoras.map((op) => ({
                      value: op.nome,
                      label: op.nome,
                    })),
                  ]}
                />
                <p className="comm-muted mt-1 text-xs">
                  Comissão e bônus serão preenchidos automaticamente
                </p>
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Produto/Plano *
                </label>
                <input
                  type="text"
                  required
                  value={formData.produto_plano}
                  onChange={(e) =>
                    setFormData({ ...formData, produto_plano: e.target.value })
                  }
                  className="panel-ui-input w-full rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Abrangência
                </label>
                {abrangenciaOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.abrangencia}
                    onChange={(value) =>
                      setFormData({ ...formData, abrangencia: value })
                    }
                    placeholder="Abrangência"
                    includePlaceholderOption={false}
                    options={abrangenciaOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.abrangencia}
                    onChange={(e) =>
                      setFormData({ ...formData, abrangencia: e.target.value })
                    }
                    className="panel-ui-input w-full rounded-lg px-4 py-2"
                    placeholder="Informe a abrangência"
                  />
                )}
              </div>

              <div>
                <label className="comm-text mb-1 block text-sm font-medium">
                  Acomodação
                </label>
                {acomodacaoOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.acomodacao}
                    onChange={(value) =>
                      setFormData({ ...formData, acomodacao: value })
                    }
                    placeholder="Acomodação"
                    includePlaceholderOption={false}
                    options={acomodacaoOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.acomodacao}
                    onChange={(e) =>
                      setFormData({ ...formData, acomodacao: e.target.value })
                    }
                    className="panel-ui-input w-full rounded-lg px-4 py-2"
                    placeholder="Informe a acomodação"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Início
                </label>
                <DateTimePicker
                  type="date"
                  value={formData.data_inicio}
                  onChange={(value) =>
                    setFormData({ ...formData, data_inicio: value })
                  }
                  placeholder="Selecionar data"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fim da fidelidade
                </label>
                <DateTimePicker
                  type="month"
                  value={formData.data_renovacao}
                  onChange={(value) =>
                    setFormData({ ...formData, data_renovacao: value })
                  }
                  placeholder="Selecionar mês"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mês de reajuste
                </label>
                <FilterSingleSelect
                  icon={Calendar}
                  value={formData.mes_reajuste}
                  onChange={(value) =>
                    setFormData({ ...formData, mes_reajuste: value })
                  }
                  placeholder="Selecione"
                  includePlaceholderOption={false}
                  options={[
                    { value: "", label: "Selecione" },
                    { value: "01", label: "Janeiro" },
                    { value: "02", label: "Fevereiro" },
                    { value: "03", label: "Março" },
                    { value: "04", label: "Abril" },
                    { value: "05", label: "Maio" },
                    { value: "06", label: "Junho" },
                    { value: "07", label: "Julho" },
                    { value: "08", label: "Agosto" },
                    { value: "09", label: "Setembro" },
                    { value: "10", label: "Outubro" },
                    { value: "11", label: "Novembro" },
                    { value: "12", label: "Dezembro" },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carência
                </label>
                {carenciaOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.carencia}
                    onChange={(value) =>
                      setFormData({ ...formData, carencia: value })
                    }
                    placeholder="Carência"
                    includePlaceholderOption={false}
                    options={carenciaOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.carencia}
                    onChange={(e) =>
                      setFormData({ ...formData, carencia: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe a carência"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mensalidade Base (R$)
                </label>
                <input
                  type="text"
                  value={formData.mensalidade_total}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mensalidade_total: formatCurrencyInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  inputMode="numeric"
                  placeholder="0,00"
                />
              </div>

              {contract?.id && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Ajustes de Valor
                    </label>
                    <Button
                      type="button"
                      onClick={() => {
                        setEditingAdjustment(null);
                        setShowAdjustmentForm(true);
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Ajuste</span>
                    </Button>
                  </div>

                  {adjustments.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className={`flex items-start justify-between p-3 rounded-lg border ${
                            adj.tipo === "acrescimo"
                              ? "bg-green-50 border-green-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="flex items-start space-x-2 flex-1">
                            {adj.tipo === "acrescimo" ? (
                              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-semibold ${
                                    adj.tipo === "acrescimo"
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }`}
                                >
                                  {adj.tipo === "acrescimo" ? "+" : "-"} R${" "}
                                  {adj.valor.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">
                                {adj.motivo}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {adj.created_by} -{" "}
                                {new Date(adj.created_at).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdjustment(adj.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic mb-3">
                      Nenhum ajuste aplicado
                    </p>
                  )}

                  {formData.mensalidade_total && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          Mensalidade Final:
                        </span>
                        <span className="text-lg font-bold text-amber-700">
                          R${" "}
                          {adjustedMensalidade.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Multiplicador de Comissão
                </label>
                <div
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{
                    borderColor: "var(--panel-border,#d4c0a7)",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 70%, var(--panel-surface,#fffdfa) 30%) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-sm"
                      style={{ color: "var(--panel-text-muted,#876f5c)" }}
                    >
                      Valor do multiplicador:
                    </span>
                    <div className="flex items-center space-x-2">
                      <span
                        className="text-2xl font-bold"
                        style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                      >
                        {formData.comissao_multiplicador}x
                      </span>
                      {parseFloat(formData.comissao_multiplicador) !== 2.8 && (
                        <AlertCircle
                          className="w-5 h-5"
                          style={{
                            color: "var(--panel-accent-border,#d5a25c)",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.comissao_multiplicador}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        comissao_multiplicador: e.target.value,
                      })
                    }
                    className="w-full cursor-pointer appearance-none rounded-full"
                    style={{
                      height: "0.6rem",
                      background:
                        "linear-gradient(90deg, color-mix(in srgb, var(--panel-text,#1c1917) 92%, transparent) 0%, color-mix(in srgb, var(--panel-text,#1c1917) 92%, transparent) 100%)",
                      accentColor: "var(--panel-accent-strong,#b85c1f)",
                    }}
                  />
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span
                      className="text-xs"
                      style={{ color: "var(--panel-text-muted,#876f5c)" }}
                    >
                      Digite o multiplicador
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      inputMode="decimal"
                      value={formData.comissao_multiplicador}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          comissao_multiplicador: e.target.value,
                        })
                      }
                      className="w-full rounded-xl px-3 py-1.5 text-sm sm:w-28"
                      style={{
                        border: "1px solid var(--panel-border,#d4c0a7)",
                        background: "var(--panel-surface-muted,#f8f2e8)",
                        color: "var(--panel-text,#1c1917)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    />
                  </div>
                  <div
                    className="mt-2 flex items-center justify-between text-xs"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    <span>0x</span>
                    <span
                      className="font-medium"
                      style={{ color: "var(--panel-accent-border,#d5a25c)" }}
                    >
                      2.8x (padrão)
                    </span>
                    <span>10x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comissão Prevista (R$)
                </label>
                <input
                  type="text"
                  value={formData.comissao_prevista}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      comissao_prevista: formatCurrencyInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50"
                  inputMode="numeric"
                  placeholder="0,00"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Calculada automaticamente com base no multiplicador
                </p>
              </div>

              {isAdesaoModalidade && (
                <div className="md:col-span-2 rounded-2xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-muted,#f8f2e8)] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--panel-text,#1c1917)]">
                        Taxa de adesão
                      </p>
                      <p className="mt-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
                        Nos contratos coletivos por adesão, os 100% iniciais
                        podem ser tratados à parte da mensalidade.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/70 px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Prévia
                      </p>
                      <p className="text-lg font-semibold text-[var(--panel-accent-strong,#b85c1f)]">
                        R${" "}
                        {signupFeePreview.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Como cobrar
                      </label>
                      <FilterSingleSelect
                        icon={WalletCards}
                        value={formData.taxa_adesao_tipo}
                        onChange={handleSignupFeeTypeChange}
                        placeholder="Selecione"
                        includePlaceholderOption={false}
                        options={[
                          { value: "nao_cobrar", label: "Não cobrar" },
                          {
                            value: "percentual_mensalidade",
                            label: "% da mensalidade",
                          },
                          { value: "valor_fixo", label: "Valor fixo" },
                        ]}
                      />
                    </div>

                    {formData.taxa_adesao_tipo === "percentual_mensalidade" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Percentual da mensalidade
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.taxa_adesao_percentual}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                taxa_adesao_percentual: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="100"
                          />
                          <span className="text-sm text-slate-500">%</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Use `0%`, `100%` ou qualquer outro percentual que
                          fizer sentido.
                        </p>
                      </div>
                    )}

                    {formData.taxa_adesao_tipo === "valor_fixo" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Valor fixo
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.taxa_adesao_valor}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              taxa_adesao_valor: formatCurrencyInput(
                                e.target.value,
                              ),
                            })
                          }
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="0,00"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Ex.: R$ 50,00, R$ 100,00 ou R$ 200,00.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Previsão Recebimento Comissão
                </label>
                <DateTimePicker
                  type="date"
                  value={formData.previsao_recebimento_comissao}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      previsao_recebimento_comissao: value,
                    })
                  }
                  placeholder="Selecionar data"
                />
              </div>

              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Forma de recebimento da comissão
                </span>
                <label className="flex items-start space-x-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <Checkbox
                    checked={formData.comissao_recebimento_adiantado}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        comissao_recebimento_adiantado: e.target.checked,
                      })
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Receber comissão adiantada (pagamento único)
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Quando marcado, todo o valor previsto será considerado no
                      primeiro mês. Desmarque para distribuir a comissão em
                      parcelas com percentuais e datas específicas.
                    </p>
                  </div>
                </label>

                {!formData.comissao_recebimento_adiantado && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Parcelas personalizadas
                        </p>
                        <p className="text-xs text-slate-600">
                          Divida a comissão em 2 ou mais pagamentos, iguais ou
                          não, sempre respeitando o total da comissão prevista.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleAddInstallment}
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar parcela</span>
                      </Button>
                    </div>

                    {commissionInstallments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 bg-slate-50">
                        Nenhuma parcela definida. Adicione ao menos uma para
                        indicar como a comissão será recebida.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {commissionInstallments.map((parcel, index) => {
                          const value = parseFormattedNumber(
                            parcel.valor || "",
                          );

                          return (
                            <div
                              key={`parcel-${index}`}
                              className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-800">
                                  Parcela {index + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInstallment(index)}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Valor da parcela
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={parcel.valor}
                                    onChange={(e) =>
                                      handleInstallmentChange(
                                        index,
                                        "valor",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    placeholder="0,00"
                                  />
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Valor informado: R${" "}
                                    {value.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Data de pagamento
                                  </label>
                                  <DateTimePicker
                                    type="date"
                                    value={parcel.data_pagamento}
                                    onChange={(value) =>
                                      handleInstallmentChange(
                                        index,
                                        "data_pagamento",
                                        value,
                                      )
                                    }
                                    placeholder="Selecionar data"
                                  />
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Defina o dia previsto para esta parcela.
                                  </p>
                                </div>
                                <div className="flex flex-col justify-center rounded-lg border border-amber-100 bg-amber-50 p-3">
                                  <span className="text-[11px] text-amber-700">
                                    Total acumulado
                                  </span>
                                  <span className="text-lg font-bold text-amber-800">
                                    R${" "}
                                    {totalInstallmentValue.toLocaleString(
                                      "pt-BR",
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </span>
                                  <span className="text-xs text-amber-700">
                                    Comissão total: R${" "}
                                    {commissionExpectedValue.toLocaleString(
                                      "pt-BR",
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-700">
                          Total das parcelas
                        </p>
                        <p className="text-xs text-slate-500">
                          {totalCommissionFromInstallments.toLocaleString(
                            "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            },
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          Restante disponível:{" "}
                          {remainingCommissionValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                      {totalInstallmentValue > commissionExpectedValue && (
                        <div className="flex items-center space-x-2 text-amber-600 mt-2 sm:mt-0">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            O total excede o valor total da comissão.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {false && formData.bonus_por_vida_aplicado && (
                <div
                  className="rounded-2xl border p-4 shadow-sm xl:col-span-2"
                  style={{
                    borderColor: "var(--panel-border,#d4c0a7)",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 74%, var(--panel-surface,#fffdfa) 26%) 100%)",
                  }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--panel-text,#1c1917)]">
                        Distribuição do bônus
                      </p>
                      <p className="mt-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
                        Cadastre uma faixa por valor. Exemplo: 1 vida com R$
                        200,00 e outra com R$ 120,00.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddBonusRow}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar faixa
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {bonusDistribution.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-5 text-sm text-[var(--panel-text-muted,#876f5c)]">
                        Nenhuma faixa criada ainda. Adicione uma linha para
                        informar quantas vidas recebem cada valor.
                      </div>
                    ) : (
                      bonusDistribution.map((row, index) => {
                        const subtotal =
                          (parseInt(row.quantidade || "0", 10) || 0) *
                          parseFormattedNumber(row.valor || "");

                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] p-3 md:grid-cols-[minmax(0,150px)_minmax(0,200px)_minmax(0,1fr)_auto]"
                          >
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Vidas
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.quantidade}
                                onChange={(e) =>
                                  handleBonusRowChange(
                                    row.id,
                                    "quantidade",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Bônus por vida
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.valor}
                                onChange={(e) =>
                                  handleBonusRowChange(
                                    row.id,
                                    "valor",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                placeholder="0,00"
                              />
                            </div>

                            <div
                              className="flex flex-col justify-center rounded-lg px-4 py-2"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 70%, transparent)",
                              }}
                            >
                              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Subtotal da faixa {index + 1}
                              </span>
                              <span className="text-base font-semibold text-[var(--panel-text,#1c1917)]">
                                R${" "}
                                {subtotal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBonusRow(row.id)}
                                disabled={bonusDistribution.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Vidas com bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        {distributedBonusLives}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Vidas sem bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        {livesWithoutBonus}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Total previsto
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        R${" "}
                        {distributedBonusTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  {distributedBonusLives > vidasNumber && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4" />A soma das faixas
                      ultrapassa a quantidade total de vidas do contrato.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade de Vidas *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.vidas}
                  onChange={(e) =>
                    setFormData({ ...formData, vidas: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Titular + dependentes
                </p>
              </div>

              <div>
                <label className="mt-4 flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={formData.bonus_por_vida_aplicado}
                    onChange={(e) => handleToggleBonus(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Aplicar Bônus por Vida
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Pagamento único por vida do contrato
                </p>
              </div>

              {false && formData.bonus_por_vida_aplicado && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Vidas elegíveis para bônus
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={vidasNumber}
                      value={formData.vidas_elegiveis_bonus || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vidas_elegiveis_bonus: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder={`Até ${vidasNumber}`}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Informe quantas vidas são elegíveis ao bônus.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bônus por Vida (R$)
                    </label>
                    <input
                      type="text"
                      value={formData.bonus_por_vida_valor}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bonus_por_vida_valor: formatCurrencyInput(
                            e.target.value,
                          ),
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="0,00"
                      inputMode="numeric"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Total: R${" "}
                      {bonusTotal.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              )}
              {formData.bonus_por_vida_aplicado && (
                <div
                  className="rounded-2xl border p-4 shadow-sm xl:col-span-2"
                  style={{
                    borderColor: "var(--panel-border,#d4c0a7)",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 82%, var(--panel-surface,#fffdfa) 18%) 100%)",
                    boxShadow: "0 18px 40px -28px rgba(40, 20, 8, 0.35)",
                  }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--panel-text,#1c1917)]">
                        Distribuição do bônus
                      </p>
                      <p className="mt-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
                        Cadastre uma faixa por valor. Exemplo: 1 vida com R$
                        200,00 e outra com R$ 120,00.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddBonusRow}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar faixa
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {bonusDistribution.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]/80 px-4 py-5 text-sm text-[var(--panel-text-muted,#876f5c)]">
                        Nenhuma faixa criada ainda. Adicione uma linha para
                        informar quantas vidas recebem cada valor.
                      </div>
                    ) : (
                      bonusDistribution.map((row, index) => {
                        const subtotal =
                          (parseInt(row.quantidade || "0", 10) || 0) *
                          parseFormattedNumber(row.valor || "");

                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]/88 p-3 md:grid-cols-[minmax(0,150px)_minmax(0,200px)_minmax(0,1fr)_auto]"
                          >
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Vidas
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.quantidade}
                                onChange={(e) =>
                                  handleBonusRowChange(
                                    row.id,
                                    "quantidade",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-2 text-[var(--panel-input-text,var(--panel-text-soft))] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] placeholder:text-[var(--panel-placeholder,var(--panel-text-muted))]"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Bônus por vida
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.valor}
                                onChange={(e) =>
                                  handleBonusRowChange(
                                    row.id,
                                    "valor",
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-2 text-[var(--panel-input-text,var(--panel-text-soft))] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] placeholder:text-[var(--panel-placeholder,var(--panel-text-muted))]"
                                placeholder="0,00"
                              />
                            </div>

                            <div
                              className="flex flex-col justify-center rounded-lg px-4 py-2"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 74%, transparent)",
                              }}
                            >
                              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                                Subtotal da faixa {index + 1}
                              </span>
                              <span className="text-base font-semibold text-[var(--panel-text,#1c1917)]">
                                R${" "}
                                {subtotal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>

                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBonusRow(row.id)}
                                disabled={bonusDistribution.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]/88 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Vidas com bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        {distributedBonusLives}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]/88 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Vidas sem bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        {livesWithoutBonus}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]/88 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                        Total previsto
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--panel-text,#1c1917)]">
                        R${" "}
                        {distributedBonusTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  {distributedBonusLives > vidasNumber && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4" />A soma das faixas
                      ultrapassa a quantidade total de vidas do contrato.
                    </div>
                  )}
                </div>
              )}
            </div>

            {(formData.bonus_por_vida_aplicado ||
              formData.previsao_pagamento_bonificacao) && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Previsão Pagamento Bonificação
                </label>
                <DateTimePicker
                  type="date"
                  value={formData.previsao_pagamento_bonificacao}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      previsao_pagamento_bonificacao: value,
                    })
                  }
                  placeholder="Selecionar data"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Informe quando a bonificação deverá ser recebida.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsável *
                </label>
                {responsavelOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={User}
                    value={formData.responsavel}
                    onChange={(value) =>
                      setFormData({ ...formData, responsavel: value })
                    }
                    placeholder="Responsável"
                    includePlaceholderOption={false}
                    options={responsavelOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.responsavel}
                    onChange={(e) =>
                      setFormData({ ...formData, responsavel: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe o responsável"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações Internas
                </label>
                <textarea
                  value={formData.observacoes_internas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      observacoes_internas: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {saving
                ? "Salvando..."
                : contract
                  ? "Salvar"
                  : "Continuar para Titular"}
            </Button>
          </div>
        </form>
      </ModalShell>

      {showAdjustmentForm && contract?.id && (
        <ValueAdjustmentForm
          contractId={contract.id}
          adjustment={editingAdjustment || undefined}
          responsavel={formData.responsavel}
          onClose={() => {
            setShowAdjustmentForm(false);
            setEditingAdjustment(null);
          }}
          onSave={async () => {
            setShowAdjustmentForm(false);
            setEditingAdjustment(null);
            if (contract?.id) {
              await loadAdjustments(contract.id);
            }
          }}
        />
      )}
      {ConfirmationDialog}
    </>
  );
}
