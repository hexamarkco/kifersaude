// ---- Tipos compartilhados para a arquitetura V3 de follow-up ----
// Separação clara entre Análise Comercial, Estratégia e Redação.

// ---- ETAPA 1: CommercialAnalysis ----

export const COMMERCIAL_ANALYSIS_STAGES = [
  'qualificacao',
  'cotacao_em_preparacao',
  'cotacao_apresentada',
  'avaliando_opcoes',
  'objecao',
  'aguardando_decisor',
  'sinal_de_compra',
  'aguardando_acao',
  'proposta_em_andamento',
  'reativacao',
  'pos_venda',
  'outro',
] as const;
export type CommercialStage = (typeof COMMERCIAL_ANALYSIS_STAGES)[number];
export const isCommercialStage = (v: string): v is CommercialStage =>
  (COMMERCIAL_ANALYSIS_STAGES as readonly string[]).includes(v);

export const LEAD_TEMPERATURES = ['frio', 'morno', 'quente', 'nao_identificado'] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];
export const isLeadTemperature = (v: string): v is LeadTemperature =>
  (LEAD_TEMPERATURES as readonly string[]).includes(v);

export const CONTACT_ROLES = [
  'decisor',
  'beneficiario',
  'decisor_e_beneficiario',
  'influenciador',
  'intermediario',
  'nao_identificado',
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];
export const isContactRole = (v: string): v is ContactRole =>
  (CONTACT_ROLES as readonly string[]).includes(v);

export const STAKEHOLDER_ROLES = [
  'decisor',
  'beneficiario',
  'influenciador',
  'intermediario',
  'aprovador',
  'outro',
] as const;
export type StakeholderRole = (typeof STAKEHOLDER_ROLES)[number];
export const isStakeholderRole = (v: string): v is StakeholderRole =>
  (STAKEHOLDER_ROLES as readonly string[]).includes(v);

export const BLOCKERS = [
  'preco',
  'rede',
  'comparacao',
  'inseguranca',
  'terceiro_decisor',
  'sem_urgencia',
  'falta_de_informacao',
  'acao_nao_executada',
  'silencio',
  'contexto_pessoal',
  'nao_identificado',
] as const;
export type CommercialBlocker = (typeof BLOCKERS)[number];
export const isCommercialBlocker = (v: string): v is CommercialBlocker =>
  (BLOCKERS as readonly string[]).includes(v);

export const NEXT_ACTION_OWNERS = [
  'lead',
  'luiza',
  'terceiro',
  'compartilhado',
  'nao_identificado',
] as const;
export type NextActionOwner = (typeof NEXT_ACTION_OWNERS)[number];
export const isNextActionOwner = (v: string): v is NextActionOwner =>
  (NEXT_ACTION_OWNERS as readonly string[]).includes(v);

export type Stakeholder = {
  description: string;
  role: StakeholderRole;
  evidence: string | null;
};

export type LastCommercialCommitment = {
  exists: boolean;
  actor: string | null;
  action: string | null;
  thirdParty: string | null;
  expectedResult: string | null;
  rawEvidence: string | null;
};

export type CommercialAnalysis = {
  stage: CommercialStage;
  leadTemperature: LeadTemperature;
  contactRole: ContactRole;
  stakeholders: Stakeholder[];
  blocker: CommercialBlocker;
  buyingSignals: string[];
  objections: string[];
  knownFacts: string[];
  lastCommercialEvent: string;
  lastCustomerPosition: string;
  lastCommercialCommitment: LastCommercialCommitment;
  previousMicrodecision: string | null;
  pendingMicrodecision: string | null;
  decisionMaker: string | null;
  nextActionOwner: NextActionOwner;
  mainCommercialQuestion: string;
  confidence: number;
};

// ---- ETAPA 2: FollowUpStrategy ----

export const COMMERCIAL_FUNCTIONS = [
  'retomar_contexto',
  'obter_microdecisao',
  'reduzir_opcoes',
  'remover_atrito',
  'esclarecer_objecao',
  'diagnosticar_bloqueio',
  'cobrar_acao_combinada',
  'obter_feedback_de_terceiro',
  'confirmar_decisao',
  'facilitar_documentacao',
  'retomar_em_data_combinada',
  'obter_posicionamento',
  'reativar',
  'encerrar_elegantemente',
  'nenhuma',
] as const;
export type CommercialFunction = (typeof COMMERCIAL_FUNCTIONS)[number];
export const isCommercialFunction = (v: string): v is CommercialFunction =>
  (COMMERCIAL_FUNCTIONS as readonly string[]).includes(v);

export const IDEAL_QUESTION_TYPES = [
  'aberta',
  'binaria',
  'escolha',
  'confirmacao',
  'sem_pergunta',
] as const;
export type IdealQuestionType = (typeof IDEAL_QUESTION_TYPES)[number];
export const isIdealQuestionType = (v: string): v is IdealQuestionType =>
  (IDEAL_QUESTION_TYPES as readonly string[]).includes(v);

export type FollowUpStrategy = {
  shouldSend: boolean;
  reasonToWait: string | null;
  commercialFunction: CommercialFunction;
  goal: string;
  targetMicrodecision: string;
  targetPerson: string | null;
  strategySummary: string;
  mustUseContext: string[];
  mustAvoid: string[];
  idealQuestionType: IdealQuestionType;
  expectedUsefulReplies: string[];
};

// ---- Payload combinado da Chamada 1 (Análise + Estratégia) ----

export type AnalysisAndStrategyResult = {
  analysis: CommercialAnalysis;
  strategy: FollowUpStrategy;
};
