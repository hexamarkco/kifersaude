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
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Surface,
  Textarea,
} from "../design-system";
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

type ContractFormState = {
  codigo_contrato: string;
  lead_id: string;
  status: string;
  modalidade: string;
  operadora: string;
  produto_plano: string;
  abrangencia: string;
  acomodacao: string;
  data_inicio: string;
  data_renovacao: string;
  mes_reajuste: string;
  carencia: string;
  mensalidade_total: string;
  comissao_prevista: string;
  comissao_multiplicador: string;
  taxa_adesao_tipo: SignupFeeType;
  taxa_adesao_percentual: string;
  taxa_adesao_valor: string;
  comissao_recebimento_adiantado: boolean;
  previsao_recebimento_comissao: string;
  previsao_pagamento_bonificacao: string;
  vidas: string;
  vidas_elegiveis_bonus: string;
  bonus_por_vida_valor: string;
  bonus_por_vida_aplicado: boolean;
  responsavel: string;
  observacoes_internas: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  endereco_empresa: string;
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

const createBonusRow = (
  quantidade = "",
  valor = "",
): BonusDistributionRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  quantidade,
  valor,
});

const buildBonusDistribution = (
  contract: Contract | null,
): BonusDistributionRow[] => {
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

const buildCommissionInstallments = (
  contract: Contract | null,
): CommissionInstallment[] => {
  const summary = getCommissionInstallmentSummary({
    comissao_prevista: contract?.comissao_prevista,
    comissao_parcelas: contract?.comissao_parcelas,
    mensalidade_total: contract?.mensalidade_total,
  });

  return summary.installments.map((parcel) => ({
    valor: formatCurrencyFromNumber(parcel.resolvedValue),
    data_pagamento: parcel.data_pagamento ?? "",
  }));
};

const buildContractFormState = (
  contract: Contract | null,
  leadToConvert?: Lead | null,
): ContractFormState => {
  const initialSignupFeeType: SignupFeeType =
    contract?.taxa_adesao_tipo ?? DEFAULT_SIGNUP_FEE_TYPE;

  return {
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
  };
};

const withCurrentOption = (
  options: Array<{ value: string; label: string }>,
  value?: string | null,
  label?: string | null,
) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return options;
  }

  if (options.some((option) => option.value === normalizedValue)) {
    return options;
  }

  return [
    {
      value: normalizedValue,
      label: label?.trim() || normalizedValue,
    },
    ...options,
  ];
};

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const { options, leadStatuses } = useConfig();
  const initialFormData = useMemo(
    () => buildContractFormState(contract, leadToConvert),
    [contract, leadToConvert],
  );
  const [formData, setFormData] = useState<ContractFormState>(initialFormData);
  const [commissionInstallments, setCommissionInstallments] = useState<
    CommissionInstallment[]
  >(() => buildCommissionInstallments(contract));
  const [bonusDistribution, setBonusDistribution] = useState<
    BonusDistributionRow[]
  >(() => buildBonusDistribution(contract));
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
  const contractStatusSelectOptions = useMemo(
    () =>
      withCurrentOption(
        contractStatusOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.status,
      ),
    [contractStatusOptions, formData.status],
  );
  const modalidadeSelectOptions = useMemo(
    () =>
      withCurrentOption(
        modalidadeOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.modalidade,
      ),
    [formData.modalidade, modalidadeOptions],
  );
  const operadoraSelectOptions = useMemo(
    () =>
      withCurrentOption(
        [
          { value: "", label: "Selecione uma operadora" },
          ...normalizedOperadoras.map((op) => ({
            value: op.nome,
            label: op.nome,
          })),
        ],
        formData.operadora,
      ),
    [formData.operadora, normalizedOperadoras],
  );
  const abrangenciaSelectOptions = useMemo(
    () =>
      withCurrentOption(
        abrangenciaOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.abrangencia,
      ),
    [abrangenciaOptions, formData.abrangencia],
  );
  const acomodacaoSelectOptions = useMemo(
    () =>
      withCurrentOption(
        acomodacaoOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.acomodacao,
      ),
    [acomodacaoOptions, formData.acomodacao],
  );
  const carenciaSelectOptions = useMemo(
    () =>
      withCurrentOption(
        carenciaOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.carencia,
      ),
    [carenciaOptions, formData.carencia],
  );
  const responsavelSelectOptions = useMemo(
    () =>
      withCurrentOption(
        responsavelOptions.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        formData.responsavel,
      ),
    [formData.responsavel, responsavelOptions],
  );
  const leadSelectOptions = useMemo(() => {
    const currentLeadLabel =
      leads.find((lead) => lead.id === formData.lead_id)?.nome_completo ||
      leadToConvert?.nome_completo ||
      'Lead vinculado';

    return withCurrentOption(
      [
        { value: '', label: 'Nenhum' },
        ...leads.map((lead) => ({
          value: lead.id,
          label: lead.nome_completo,
        })),
      ],
      formData.lead_id,
      currentLeadLabel,
    );
  }, [formData.lead_id, leadToConvert?.nome_completo, leads]);

  const totalInstallmentValue = useMemo(
    () =>
      commissionInstallments.reduce((sum, parcel) => {
        const valor = parseFormattedNumber(parcel.valor || "");
        return sum + (Number.isFinite(valor) ? valor : 0);
      }, 0),
    [commissionInstallments],
  );

  useEffect(() => {
    setFormData(initialFormData);
    setCommissionInstallments(buildCommissionInstallments(contract));
    setBonusDistribution(buildBonusDistribution(contract));
    setContractId(contract?.id || null);
    setAdjustments([]);
    setShowAdjustmentForm(false);
    setEditingAdjustment(null);
    setCnpjLookupError(null);
    setCnpjLoading(false);
    lastFetchedCnpjRef.current = "";
  }, [contract, initialFormData]);

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
        key={`holder-${contractId}`}
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
      <Dialog open onOpenChange={(open) => !open && onClose()} size="lg">
        <DialogHeader onClose={onClose}>
          <DialogTitle>
            {contract
              ? "Editar Contrato"
              : leadToConvert
                ? "Converter Lead em Contrato"
                : "Novo Contrato"}
          </DialogTitle>
          {leadToConvert && (
            <DialogDescription>
              {`Lead: ${leadToConvert.nome_completo} - ${leadToConvert.telefone}`}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody className="p-0">
        <form
          onSubmit={handleSubmit}
          className="max-h-[70vh] overflow-y-auto p-6"
        >
          <Surface variant="muted" padding="sm" className="mb-6">
            <h4 className="mb-3 flex items-center font-semibold text-[var(--text-primary)]">
              <Building2 className="mr-2 h-5 w-5 text-[var(--brand-primary)]" />
              Informações do Contrato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Código do Contrato *">
                <Input
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
                />
              </Field>

              <Field label="Lead Vinculado">
                <FilterSingleSelect
                  icon={User}
                  value={formData.lead_id}
                  onChange={(value) =>
                    setFormData({ ...formData, lead_id: value })
                  }
                  placeholder="Lead vinculado"
                  includePlaceholderOption={false}
                  options={leadSelectOptions}
                />
              </Field>

              <Field label="Status *">
                {contractStatusOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.status}
                    onChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                    placeholder="Status"
                    includePlaceholderOption={false}
                    options={contractStatusSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    required
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    placeholder="Configure os status de contrato"
                  />
                )}
              </Field>

              <Field label="Modalidade *">
                {modalidadeOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.modalidade}
                    onChange={(value) =>
                      setFormData({ ...formData, modalidade: value })
                    }
                    placeholder="Modalidade"
                    includePlaceholderOption={false}
                    options={modalidadeSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    required
                    value={formData.modalidade}
                    onChange={(e) =>
                      setFormData({ ...formData, modalidade: e.target.value })
                    }
                    placeholder="Informe a modalidade"
                  />
                )}
              </Field>

              {modalidadeRequerCNPJ && (
                <>
                  <Field label="CNPJ (Receita)" error={cnpjLookupError || undefined}>
                    <div className="relative">
                      <Input
                        type="text"
                        value={formData.cnpj}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cnpj: formatCnpj(e.target.value),
                          })
                        }
                        className="pr-10"
                        inputMode="numeric"
                        maxLength={18}
                      />
                      <Button
                        type="button"
                        onClick={handleConsultarCNPJ}
                        disabled={cnpjLoading}
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[var(--text-muted)]"
                        aria-label={cnpjLoading ? "Buscando CNPJ" : "Buscar CNPJ na Receita"}
                        title={
                          cnpjLoading ? "Buscando..." : "Buscar na Receita"
                        }
                      >
                        <Search
                          className={`w-5 h-5 ${cnpjLoading ? "animate-pulse" : ""}`}
                        />
                      </Button>
                    </div>
                  </Field>

                  <Field label="Razão Social">
                    <Input
                      type="text"
                      value={formData.razao_social}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          razao_social: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Nome Fantasia">
                    <Input
                      type="text"
                      value={formData.nome_fantasia}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nome_fantasia: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Endereço da Empresa (Receita)" className="md:col-span-2">
                    <Textarea
                      value={formData.endereco_empresa}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endereco_empresa: e.target.value,
                        })
                      }
                      size="compact"
                      rows={2}
                      placeholder="Preenchido automaticamente pela consulta do CNPJ"
                    />
                  </Field>
                </>
              )}

              <Field
                label="Operadora *"
                description="Comissão e bônus serão preenchidos automaticamente"
              >
                <FilterSingleSelect
                  icon={Search}
                  value={formData.operadora}
                  onChange={(value) => handleOperadoraChange(value)}
                  placeholder="Selecione uma operadora"
                  includePlaceholderOption={false}
                  options={operadoraSelectOptions}
                />
              </Field>

              <Field label="Produto/Plano *">
                <Input
                  type="text"
                  required
                  value={formData.produto_plano}
                  onChange={(e) =>
                    setFormData({ ...formData, produto_plano: e.target.value })
                  }
                />
              </Field>

              <Field label="Abrangência">
                {abrangenciaOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.abrangencia}
                    onChange={(value) =>
                      setFormData({ ...formData, abrangencia: value })
                    }
                    placeholder="Abrangência"
                    includePlaceholderOption={false}
                    options={abrangenciaSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    value={formData.abrangencia}
                    onChange={(e) =>
                      setFormData({ ...formData, abrangencia: e.target.value })
                    }
                    placeholder="Informe a abrangência"
                  />
                )}
              </Field>

              <Field label="Acomodação">
                {acomodacaoOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.acomodacao}
                    onChange={(value) =>
                      setFormData({ ...formData, acomodacao: value })
                    }
                    placeholder="Acomodação"
                    includePlaceholderOption={false}
                    options={acomodacaoSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    value={formData.acomodacao}
                    onChange={(e) =>
                      setFormData({ ...formData, acomodacao: e.target.value })
                    }
                    placeholder="Informe a acomodação"
                  />
                )}
              </Field>

              <Field label="Data de Início">
                <DateTimePicker
                  type="date"
                  value={formData.data_inicio}
                  onChange={(event) =>
                    setFormData({ ...formData, data_inicio: event.target.value })
                  }
                  placeholder="Selecionar data"
                />
              </Field>

              <Field label="Fim da fidelidade">
                <Input
                  type="month"
                  value={formData.data_renovacao}
                  onChange={(event) =>
                    setFormData({ ...formData, data_renovacao: event.target.value })
                  }
                  placeholder="Selecionar mês"
                />
              </Field>

              <Field label="Mês de reajuste">
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
              </Field>

              <Field label="Carência">
                {carenciaOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={formData.carencia}
                    onChange={(value) =>
                      setFormData({ ...formData, carencia: value })
                    }
                    placeholder="Carência"
                    includePlaceholderOption={false}
                    options={carenciaSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    value={formData.carencia}
                    onChange={(e) =>
                      setFormData({ ...formData, carencia: e.target.value })
                    }
                    placeholder="Informe a carência"
                  />
                )}
              </Field>

              <Field label="Mensalidade Base (R$)" className="md:col-span-2">
                <Input
                  type="text"
                  value={formData.mensalidade_total}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mensalidade_total: formatCurrencyInput(e.target.value),
                    })
                  }
                  inputMode="numeric"
                  placeholder="0,00"
                />
              </Field>

              {contract?.id && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="block text-sm font-medium text-[var(--text-secondary)]">
                      Ajustes de Valor
                    </span>
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
                        <Surface
                          key={adj.id}
                          variant={adj.tipo === "acrescimo" ? "success" : "danger"}
                          padding="sm"
                          className="flex items-start justify-between"
                        >
                          <div className="flex items-start space-x-2 flex-1">
                            {adj.tipo === "acrescimo" ? (
                              <TrendingUp className="mt-0.5 h-4 w-4 text-[var(--success-text)]" />
                            ) : (
                              <TrendingDown className="mt-0.5 h-4 w-4 text-[var(--danger-text)]" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <Badge tone={adj.tipo === "acrescimo" ? "success" : "danger"}>
                                  {adj.tipo === "acrescimo" ? "+" : "-"} R${" "}
                                  {adj.valor.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                {adj.motivo}
                              </p>
                              <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {adj.created_by} -{" "}
                                {new Date(adj.created_at).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAdjustment(adj.id)}
                            aria-label={`Remover ajuste: ${adj.motivo}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Surface>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm italic text-[var(--text-muted)]">
                      Nenhum ajuste aplicado
                    </p>
                  )}

                  {formData.mensalidade_total && (
                    <Surface variant="warning" padding="sm">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[var(--text-secondary)]">
                          Mensalidade Final:
                        </span>
                        <span className="text-lg font-bold text-[var(--warning-text)]">
                          R${" "}
                          {adjustedMensalidade.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </Surface>
                  )}
                </div>
              )}

              <Field label="Multiplicador de Comissão" className="md:col-span-2">
                <Surface variant="strong" padding="sm" className="sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--text-muted)]">
                      Valor do multiplicador:
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-[var(--brand-primary)]">
                        {formData.comissao_multiplicador}x
                      </span>
                      {parseFloat(formData.comissao_multiplicador) !== 2.8 && (
                        <AlertCircle className="h-5 w-5 text-[var(--warning-text)]" />
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
                    className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--bg-inset)] accent-[var(--brand-primary)]"
                    style={{
                      accentColor: "var(--brand-primary)",
                    }}
                  />
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs text-[var(--text-muted)]">
                      Digite o multiplicador
                    </span>
                    <Input
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
                      className="w-full sm:w-28"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>0x</span>
                    <span className="font-medium text-[var(--accent-gold)]">
                      2.8x (padrão)
                    </span>
                    <span>10x</span>
                  </div>
                </Surface>
              </Field>

              <Field
                label="Comissão Prevista (R$)"
                description="Calculada automaticamente com base no multiplicador"
              >
                <Input
                  type="text"
                  value={formData.comissao_prevista}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      comissao_prevista: formatCurrencyInput(e.target.value),
                    })
                  }
                  className="bg-[var(--bg-inset)]"
                  inputMode="numeric"
                  placeholder="0,00"
                />
              </Field>

              {isAdesaoModalidade && (
                <Surface variant="warning" padding="sm" className="md:col-span-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Taxa de adesão
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Nos contratos coletivos por adesão, os 100% iniciais
                        podem ser tratados à parte da mensalidade.
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Prévia
                      </p>
                      <p className="text-lg font-semibold text-[var(--warning-text)]">
                        R${" "}
                        {signupFeePreview.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Como cobrar">
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
                    </Field>

                    {formData.taxa_adesao_tipo === "percentual_mensalidade" && (
                      <Field
                        label="Percentual da mensalidade"
                        description="Use 0%, 100% ou qualquer outro percentual adequado."
                      >
                        <div className="flex items-center gap-2">
                          <Input
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
                            placeholder="100"
                          />
                          <span className="text-sm text-[var(--text-muted)]">%</span>
                        </div>
                      </Field>
                    )}

                    {formData.taxa_adesao_tipo === "valor_fixo" && (
                      <Field
                        label="Valor fixo"
                        description="Ex.: R$ 50,00, R$ 100,00 ou R$ 200,00."
                      >
                        <Input
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
                          placeholder="0,00"
                        />
                      </Field>
                    )}
                  </div>
                </Surface>
              )}

              <Field label="Previsão Recebimento Comissão">
                <DateTimePicker
                  type="date"
                  value={formData.previsao_recebimento_comissao}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      previsao_recebimento_comissao: event.target.value,
                    })
                  }
                  placeholder="Selecionar data"
                />
              </Field>

              <div className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                  Forma de recebimento da comissão
                </span>
                <Surface variant="muted" padding="sm">
                  <label className="flex items-start gap-3">
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
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Receber comissão adiantada (pagamento único)
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Quando marcado, todo o valor previsto será considerado no
                      primeiro mês. Desmarque para distribuir a comissão em
                      parcelas com percentuais e datas específicas.
                    </p>
                  </div>
                  </label>
                </Surface>

                {!formData.comissao_recebimento_adiantado && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Parcelas personalizadas
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
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
                      <Surface variant="muted" padding="sm" className="border-dashed text-sm text-[var(--text-muted)]">
                        Nenhuma parcela definida. Adicione ao menos uma para
                        indicar como a comissão será recebida.
                      </Surface>
                    ) : (
                      <div className="space-y-3">
                        {commissionInstallments.map((parcel, index) => {
                          const value = parseFormattedNumber(
                            parcel.valor || "",
                          );

                          return (
                            <Surface
                              key={`parcel-${index}`}
                              padding="sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--text-primary)]">
                                  Parcela {index + 1}
                                </span>
                                <Button
                                  type="button"
                                  onClick={() => handleRemoveInstallment(index)}
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remover parcela ${index + 1}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Field label="Valor da parcela">
                                  <Input
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
                                    placeholder="0,00"
                                  />
                                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    Valor informado: R${" "}
                                    {value.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </p>
                                </Field>
                                <Field label="Data de pagamento">
                                  <DateTimePicker
                                    type="date"
                                    value={parcel.data_pagamento}
                                    onChange={(event) =>
                                      handleInstallmentChange(
                                        index,
                                        "data_pagamento",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Selecionar data"
                                  />
                                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    Defina o dia previsto para esta parcela.
                                  </p>
                                </Field>
                                <Surface variant="warning" padding="sm" className="flex flex-col justify-center">
                                  <span className="text-[11px] text-[var(--warning-text)]">
                                    Total acumulado
                                  </span>
                                  <span className="text-lg font-bold text-[var(--warning-text)]">
                                    R${" "}
                                    {totalInstallmentValue.toLocaleString(
                                      "pt-BR",
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </span>
                                  <span className="text-xs text-[var(--warning-text)]">
                                    Comissão total: R${" "}
                                    {commissionExpectedValue.toLocaleString(
                                      "pt-BR",
                                      { minimumFractionDigits: 2 },
                                    )}
                                  </span>
                                </Surface>
                              </div>
                            </Surface>
                          );
                        })}
                      </div>
                    )}

                    <Surface variant="muted" padding="sm" className="flex flex-col text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-[var(--text-secondary)]">
                          Total das parcelas
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {totalCommissionFromInstallments.toLocaleString(
                            "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            },
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Restante disponível:{" "}
                          {remainingCommissionValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                      {totalInstallmentValue > commissionExpectedValue && (
                        <div className="mt-2 flex items-center space-x-2 text-[var(--warning-text)] sm:mt-0">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            O total excede o valor total da comissão.
                          </span>
                        </div>
                      )}
                    </Surface>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <Field label="Quantidade de Vidas *" description="Titular + dependentes">
                <Input
                  type="number"
                  min="1"
                  required
                  value={formData.vidas}
                  onChange={(e) =>
                    setFormData({ ...formData, vidas: e.target.value })
                  }
                  placeholder="1"
                />
              </Field>

              <div>
                <label className="mt-4 flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={formData.bonus_por_vida_aplicado}
                    onChange={(e) => handleToggleBonus(e.target.checked)}
                  />
                   <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Aplicar Bônus por Vida
                  </span>
                </label>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Pagamento único por vida do contrato
                </p>
              </div>

              {formData.bonus_por_vida_aplicado && (
                <Surface variant="strong" padding="sm" className="xl:col-span-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Distribuição do bônus
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
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
                      <Surface variant="muted" padding="sm" className="border-dashed text-sm text-[var(--text-muted)]">
                        Nenhuma faixa criada ainda. Adicione uma linha para
                        informar quantas vidas recebem cada valor.
                      </Surface>
                    ) : (
                      bonusDistribution.map((row, index) => {
                        const subtotal =
                          (parseInt(row.quantidade || "0", 10) || 0) *
                          parseFormattedNumber(row.valor || "");

                        return (
                          <Surface
                            key={row.id}
                            padding="sm"
                            className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,150px)_minmax(0,200px)_minmax(0,1fr)_auto]"
                          >
                            <Field label="Vidas">
                              <Input
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
                                placeholder="0"
                              />
                            </Field>

                            <Field label="Bônus por vida">
                              <Input
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
                                placeholder="0,00"
                              />
                            </Field>

                            <Surface variant="muted" padding="sm" className="flex flex-col justify-center">
                              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                Subtotal da faixa {index + 1}
                              </span>
                              <span className="text-base font-semibold text-[var(--text-primary)]">
                                R${" "}
                                {subtotal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </Surface>

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
                          </Surface>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Surface padding="sm">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Vidas com bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                        {distributedBonusLives}
                      </p>
                    </Surface>
                    <Surface padding="sm">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Vidas sem bônus
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                        {livesWithoutBonus}
                      </p>
                    </Surface>
                    <Surface padding="sm">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Total previsto
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                        R${" "}
                        {distributedBonusTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </Surface>
                  </div>

                  {distributedBonusLives > vidasNumber && (
                    <Alert tone="warning" className="mt-3">
                      <AlertCircle className="h-4 w-4" />A soma das faixas
                      ultrapassa a quantidade total de vidas do contrato.
                    </Alert>
                  )}
                </Surface>
              )}
            </div>

            {(formData.bonus_por_vida_aplicado ||
              formData.previsao_pagamento_bonificacao) && (
              <Field
                label="Previsão Pagamento Bonificação"
                description="Informe quando a bonificação deverá ser recebida."
                className="mb-4"
              >
                <DateTimePicker
                  type="date"
                  value={formData.previsao_pagamento_bonificacao}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      previsao_pagamento_bonificacao: event.target.value,
                    })
                  }
                  placeholder="Selecionar data"
                />
              </Field>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Responsável *">
                {responsavelOptions.length > 0 ? (
                  <FilterSingleSelect
                    icon={User}
                    value={formData.responsavel}
                    onChange={(value) =>
                      setFormData({ ...formData, responsavel: value })
                    }
                    placeholder="Responsável"
                    includePlaceholderOption={false}
                    options={responsavelSelectOptions}
                  />
                ) : (
                  <Input
                    type="text"
                    required
                    value={formData.responsavel}
                    onChange={(e) =>
                      setFormData({ ...formData, responsavel: e.target.value })
                    }
                    placeholder="Informe o responsável"
                  />
                )}
              </Field>

              <Field label="Observações Internas" className="md:col-span-2">
                <Textarea
                  value={formData.observacoes_internas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      observacoes_internas: e.target.value,
                    })
                  }
                  rows={3}
                />
              </Field>
            </div>
          </Surface>

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-end">
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
        </DialogBody>
      </Dialog>

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
