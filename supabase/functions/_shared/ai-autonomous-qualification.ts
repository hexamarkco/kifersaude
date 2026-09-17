export type QualificationValueStatus = 'known' | 'unknown' | 'declined' | 'not_asked';
export type QualificationYesNo = 'yes' | 'no' | 'unknown';

export type QualificationLife = {
  id: string;
  label: string | null;
  role: 'adult' | 'child' | 'unspecified';
  age: number | null;
  ageStatus: QualificationValueStatus;
};

export type AutonomousQualificationState = {
  schemaVersion: 1;
  status: 'in_progress' | 'complete';
  lives: {
    count: number | null;
    countStatus: QualificationValueStatus;
    items: QualificationLife[];
    compositionStatus: QualificationValueStatus;
  };
  location: {
    city: string | null;
    state: string | null;
    cityStatus: QualificationValueStatus;
    isCapital: boolean | null;
    neighborhood: string | null;
    neighborhoodStatus: QualificationValueStatus;
    neighborhoodRequired: boolean;
  };
  company: {
    hasCnpjOrMei: QualificationYesNo;
    answerStatus: QualificationValueStatus;
    type: 'cnpj' | 'mei' | 'both' | null;
    number: string | null;
    numberStatus: QualificationValueStatus;
  };
  currentHealthPlan: {
    hasPlan: QualificationYesNo;
    answerStatus: QualificationValueStatus;
    operator: string | null;
    plan: string | null;
    detailsStatus: QualificationValueStatus;
  };
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  singleUnderTwelveWithoutAdult: boolean;
  compositionValid: boolean;
  completedAt: string | null;
  extractedAt: string;
};

export type QualificationMessage = {
  role: 'lead' | 'ai';
  content: string;
};

export type QualificationContextSeed = {
  city?: string | null;
  state?: string | null;
  contractingType?: string | null;
  currentOperator?: string | null;
};

const CAPITALS: Record<string, { city: string; state: string }> = {
  'aracaju': { city: 'Aracaju', state: 'SE' },
  'belem': { city: 'Belém', state: 'PA' },
  'belo horizonte': { city: 'Belo Horizonte', state: 'MG' },
  'boa vista': { city: 'Boa Vista', state: 'RR' },
  'brasilia': { city: 'Brasília', state: 'DF' },
  'campo grande': { city: 'Campo Grande', state: 'MS' },
  'cuiaba': { city: 'Cuiabá', state: 'MT' },
  'curitiba': { city: 'Curitiba', state: 'PR' },
  'florianopolis': { city: 'Florianópolis', state: 'SC' },
  'fortaleza': { city: 'Fortaleza', state: 'CE' },
  'goiania': { city: 'Goiânia', state: 'GO' },
  'joao pessoa': { city: 'João Pessoa', state: 'PB' },
  'macapa': { city: 'Macapá', state: 'AP' },
  'maceio': { city: 'Maceió', state: 'AL' },
  'manaus': { city: 'Manaus', state: 'AM' },
  'natal': { city: 'Natal', state: 'RN' },
  'palmas': { city: 'Palmas', state: 'TO' },
  'porto alegre': { city: 'Porto Alegre', state: 'RS' },
  'porto velho': { city: 'Porto Velho', state: 'RO' },
  'recife': { city: 'Recife', state: 'PE' },
  'rio branco': { city: 'Rio Branco', state: 'AC' },
  'rio de janeiro': { city: 'Rio de Janeiro', state: 'RJ' },
  'salvador': { city: 'Salvador', state: 'BA' },
  'sao luis': { city: 'São Luís', state: 'MA' },
  'sao paulo': { city: 'São Paulo', state: 'SP' },
  'teresina': { city: 'Teresina', state: 'PI' },
  'vitoria': { city: 'Vitória', state: 'ES' },
};

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const toTitle = (value: string): string => value
  .trim()
  .split(/\s+/)
  .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word)
  .join(' ');

const KNOWN_OPERATOR_ALIASES: Record<string, string> = {
  amil: 'Amil',
  assim: 'Assim',
  bradesco: 'Bradesco',
  unimed: 'Unimed',
  'sul america': 'Sul América',
  hapvida: 'Hapvida',
  notredame: 'NotreDame',
  intermedica: 'NotreDame Intermédica',
  medsenior: 'MedSênior',
  'golden cross': 'Golden Cross',
  'prevent senior': 'Prevent Senior',
  memorial: 'Memorial',
  klini: 'Klini',
  klin: 'Klini',
  levesaude: 'Leve Saúde',
  'leve saude': 'Leve Saúde',
  'care plus': 'Care Plus',
};

export const normalizeKnownOperator = (value: string): string | null => {
  const normalized = normalize(value).replace(/\s+/g, ' ');
  return KNOWN_OPERATOR_ALIASES[normalized] ?? null;
};

const cleanCapturedPlace = (value: string): string => value
  .replace(/[.!?,;]+.*$/, '')
  .replace(/\s+(?:e|mas|que|hoje|agora|tambem|também)\s+.*$/i, '')
  .trim();

const numberWords: Record<string, number> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
};

const extractCount = (text: string): number | null => {
  const numeric = text.match(/\b([1-9][0-9]?)\s+(?:vidas?|pessoas?|beneficiari[oa]s?)\b/i);
  if (numeric) return Number(numeric[1]);

  const contextual = text.match(/^\s*(?:para|s[oó]\s+para|somente\s+para|apenas\s+para)\s+(\d{1,2}|uma|um|duas|dois|tres|três|quatro|cinco|seis)\s*$/i);
  if (contextual) {
    return Number(contextual[1]) || numberWords[normalize(contextual[1])] || null;
  }

  const written = text.match(/\b(uma|um|duas|dois|tres|três|quatro|cinco|seis)\s+(?:vidas?|pessoas?|beneficiari[oa]s?)\b/i);
  if (written) return numberWords[normalize(written[1])] ?? null;

  const children = text.match(/\b(duas|dois|tres|três|quatro|cinco|seis|[2-9])\s+(?:filh[oa]s?|net[oa]s?|crian[cç]as?|adolescentes?)\b/i);
  if (children) return Number(children[1]) || numberWords[normalize(children[1])] || null;

  const somos = text.match(/\bsomos\s+(uma|um|duas|dois|tres|três|quatro|cinco|seis|[1-9][0-9]?)\b/i);
  if (somos) return Number(somos[1]) || numberWords[normalize(somos[1])] || null;
  return null;
};

const hasAdultReference = (text: string): boolean => /\b(?:eu|nos|a gente|adulto|adult[ao]s?|mae|m[aã]e|pai|marido|esposa|esposo|companheir[oa]|respons[aá]vel|titular)\b/i.test(text);
const hasChildReference = (text: string): boolean => /\b(?:filh[oa]s?|net[oa]s?|crian[cç]a?s?|menor(?:es)?|adolescente?s?)\b/i.test(text);
const hasSelfOnlyReference = (text: string): boolean => /\b(?:s[oó]|somente|apenas)\s+(?:para\s+)?mim\b|\bpara\s+mim\b|\bmim\b|\beu\b/i.test(text);
const hasExplicitChildOnlyReference = (text: string): boolean => /\b(?:para|pra|pro|cot[aá]?[cç][aã]o\s+para)\s+(?:o\s+|a\s+|meu\s+|minha\s+)?(?:filh[oa]|net[oa]|crian[cç]a|adolescente|menor)\b|\b(?:s[oó]|somente|apenas)\s+(?:para\s+)?(?:meu|minha|o|a)?\s*(?:filh[oa]|net[oa]|crian[cç]a|adolescente|menor)/i.test(text);

const extractAgeValues = (text: string): number[] => {
  const values: number[] = [];
  const addValues = (matches: Iterable<RegExpMatchArray>) => {
    for (const match of matches) {
      const age = Number(match[1]);
      if (age >= 0 && age <= 120 && !values.includes(age)) values.push(age);
    }
  };
  addValues(text.matchAll(/\b(\d{1,3})(?:\s*(?:anos?|ano)\b|(?=\s*(?:e|,|\/|\+)\s*\d{1,3}\s*(?:anos?|ano)\b))/gi));
  addValues(text.matchAll(/\b(?:tenho|tem|fez|fiz|com|idade\s+(?:de|é|e)?)\s+(\d{1,3})\b/gi));
  addValues(text.matchAll(/\b(?:eu|ele|ela|filh[oa]|net[oa]|esposa|esposo|marido|mulher|homem)\b\s+(?:tem\s+)?(\d{1,3})\b/gi));
  return values;
};

const extractCity = (text: string): { city: string; state: string | null; isCapital: boolean } | null => {
  const normalized = normalize(text);
  for (const [capital, value] of Object.entries(CAPITALS)) {
    if (new RegExp(`\\b${capital.replace(/ /g, '\\s+')}\\b`, 'i').test(normalized)) {
      return { city: value.city, state: value.state, isCapital: true };
    }
  }

  const cityMatch = text.match(/\b(?:cidade\s+(?:[eé]|de)|moro\s+em|moramos\s+em|resido\s+em|somos?\s+de|sou\s+de|fico\s+em|estou\s+em|vou\s+usar\s+em|uso\s+em|em)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*){0,3})/i);
  if (!cityMatch) return null;

  const city = cleanCapturedPlace(cityMatch[1]);
  if (city.length < 3 || /^(qual|que|uma|um|alguma|algum)$/i.test(city)) return null;
  return { city: toTitle(city), state: null, isCapital: false };
};

const extractNeighborhood = (text: string): string | null => {
  const match = text.match(/\b(?:bairro|moro\s+no\s+bairro|resido\s+no\s+bairro)\s+(?:e\s+)?([A-Za-zÀ-ÿ0-9][^.!?,;]*)/i);
  if (!match) return null;
  const neighborhood = cleanCapturedPlace(match[1]);
  return neighborhood.length >= 2 ? toTitle(neighborhood) : null;
};

const extractBusinessAnswer = (text: string): { value: QualificationYesNo; type: 'cnpj' | 'mei' | 'both' | null; number: string | null } | null => {
  const normalized = normalize(text);
  const no = /\b(?:nao|não)\s+(?:tenho|possuo|temos|possui)|\bsem\s+(?:cnpj|mei)|\bpessoa\s+fisica\b/.test(normalized);
  if (no) return { value: 'no', type: null, number: null };

  const yes = /\b(?:tenho|possuo|temos|possui|sou|somos|com)\b[^.!?]{0,40}\b(?:cnpj|mei)\b|\b(?:cnpj|mei)\b[^.!?]{0,20}\b(?:sim|tenho|possuo)\b/.test(normalized);
  if (!yes) return null;
  const hasCnpj = /\bcnpj\b/.test(normalized);
  const hasMei = /\bmei\b/.test(normalized);
  const number = text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/??\d{4}-?\d{2}\b/)?.[0] ?? null;
  return { value: 'yes', type: hasCnpj && hasMei ? 'both' : hasMei ? 'mei' : 'cnpj', number };
};

const extractPlanAnswer = (text: string): { value: QualificationYesNo; operator: string | null; plan: string | null } | null => {
  const normalized = normalize(text);
  if (/\b(?:nao|não)\s+(?:tenho|possuo|temos|possui)|\bsem\s+plano|\bnunca\s+tive/.test(normalized)) {
    return { value: 'no', operator: null, plan: null };
  }

  const operatorMatch = text.match(/\b(amil|assim|bradesco|unimed|sul\s*america|hapvida|notredame|interm[eé]dica|medsenior|golden\s+cross|prevent\s+senior|memorial|klini|klin|leve\s*saude|care\s+plus)\b/i);
  const operator = operatorMatch?.[1] ? normalizeKnownOperator(operatorMatch[1]) : null;
  const yes = /\b(?:tenho|possuo|temos|possui|j[aá]\s+tenho|j[aá]\s+temos)\b[^.!?]{0,50}\bplano\b|\b(?:tenho|possuo|temos|possui)\b[^.!?]{0,50}(?:amil|unimed|bradesco|hapvida|assim|notredame|klini|klin)/i.test(normalized);
  if (!yes && !operator) return null;
  return { value: 'yes', operator, plan: null };
};

const buildLives = (messages: QualificationMessage[]): { count: number | null; items: QualificationLife[]; compositionStatus: QualificationValueStatus } => {
  let count: number | null = null;
  let compositionStatus: QualificationValueStatus = 'not_asked';
  let hasAdult = false;
  let hasChild = false;
  let onlyChild = false;
  let latestAges: number[] = [];

  let previousAi = '';
  for (const message of messages) {
    if (message.role === 'ai') {
      previousAi = message.content;
      continue;
    }
    const text = message.content;
    const normalizedPreviousAi = normalize(previousAi);
    const ages = extractAgeValues(text);
    const hasPendingAge = count !== null && latestAges.length < count && /^\s*\d{1,3}\s*$/.test(text);
    if (ages.length === 0
      && (hasPendingAge || /idade|idades|quantos\s+anos|anos/.test(normalizedPreviousAi))
      && !/quantas?\s+(?:vidas?|pessoas?)/.test(normalizedPreviousAi)) {
      ages.push(...[...text.matchAll(/\b(\d{1,3})\b/g)]
        .map((match) => Number(match[1]))
        .filter((age) => age >= 0 && age <= 120));
    }
    if (ages.length > 0) {
      const isCorrection = /\b(?:corrig|desculp|na verdade|fez|fiz|errei|errado)\w*/i.test(text);
      latestAges = isCorrection && latestAges.length > 0
        ? [...latestAges.slice(0, Math.max(0, latestAges.length - 1)), ...ages]
        : [...latestAges, ...ages];
    }
    const extractedCount = extractCount(text)
      ?? (/quantas?\s+(?:vidas?|pessoas?)|para\s+quantas?/.test(normalizedPreviousAi)
        ? Number(text.match(/\b([1-9][0-9]?)\b/)?.[1] ?? 0) || numberWords[normalize(text.trim())] || null
        : null);
    if (extractedCount !== null) count = extractedCount;
    if (hasAdultReference(text)) hasAdult = true;
    if (hasChildReference(text)) hasChild = true;
    if (hasExplicitChildOnlyReference(text)) onlyChild = true;
    if (hasAdult || hasChild || extractedCount !== null || hasSelfOnlyReference(text)) compositionStatus = 'known';
  }

  if (hasAdult && hasChild && (count === null || count < 2)) count = 2;
  if (onlyChild && !hasAdult) {
    if (count === null) count = latestAges.length > 1 ? latestAges.length : 1;
    else if (latestAges.length > 1) count = latestAges.length;
  }
  const allLeadText = messages.map((row) => row.content).join(' ');
  if (hasAdult && hasChild && /\b(?:eu|mim)\s+e\s+(?:meu|minha|o|a)\b/i.test(allLeadText)) count = 2;
  if (hasAdult && !hasChild && /\b(?:eu|mim)\b.{0,50}\b(?:minha esposa|meu marido|ela|ele)\b/i.test(allLeadText)) count = 2;
  const leadMessages = messages.filter((row) => row.role === 'lead');
  if (leadMessages.some((row) => hasSelfOnlyReference(row.content)) && !hasChild && count === null) count = 1;
  if (hasAdult && !hasChild && count === null) count = 1;

  const items: QualificationLife[] = [];
  const safeCount = count ?? (latestAges.length === 1 && (hasAdult || hasChild) ? 1 : null);
  if (safeCount !== null) {
    const adultAges = latestAges.filter((age) => age >= 18);
    const childAges = latestAges.filter((age) => age < 18);
    for (let index = 0; index < safeCount; index += 1) {
      const role = hasAdult && hasChild
        ? index === 0 ? 'adult' : 'child'
        : onlyChild ? 'child'
          : hasAdult ? 'adult'
            : 'unspecified';
      const age = role === 'adult'
        ? adultAges[index] ?? null
        : role === 'child'
          ? childAges[index - (hasAdult ? 1 : 0)] ?? null
          : latestAges[index] ?? null;
      items.push({
        id: `life-${index + 1}`,
        label: role === 'adult' ? 'adulto' : role === 'child' ? 'dependente' : null,
        role,
        age,
        ageStatus: age === null ? 'unknown' : 'known',
      });
    }
  }

  return { count, items, compositionStatus };
};

const calculateState = (
  messages: QualificationMessage[],
  extractedAt: string,
  seed: QualificationContextSeed = {},
): AutonomousQualificationState => {
  const lives = buildLives(messages);
  let location: AutonomousQualificationState['location'] = {
    city: seed.city?.trim() || null,
    state: seed.state?.trim() || null,
    cityStatus: seed.city?.trim() ? 'known' : 'not_asked',
    isCapital: seed.city ? Boolean(CAPITALS[normalize(seed.city)]) : null,
    neighborhood: null,
    neighborhoodStatus: 'not_asked',
    neighborhoodRequired: seed.city ? Boolean(CAPITALS[normalize(seed.city)]) : false,
  };
  let company: AutonomousQualificationState['company'] = {
    hasCnpjOrMei: /mei|cnpj/i.test(seed.contractingType ?? '') ? 'yes' : 'unknown',
    answerStatus: /mei|cnpj/i.test(seed.contractingType ?? '') ? 'known' : 'not_asked',
    type: /mei/i.test(seed.contractingType ?? '') && /cnpj/i.test(seed.contractingType ?? '')
      ? 'both'
      : /mei/i.test(seed.contractingType ?? '')
        ? 'mei'
        : /cnpj/i.test(seed.contractingType ?? '')
          ? 'cnpj'
          : null,
    number: null,
    numberStatus: 'not_asked',
  };
  const seededOperator = seed.currentOperator?.trim()
    ? normalizeKnownOperator(seed.currentOperator) ?? seed.currentOperator.trim()
    : null;
  let currentHealthPlan: AutonomousQualificationState['currentHealthPlan'] = {
    hasPlan: seededOperator ? 'yes' : 'unknown',
    answerStatus: seededOperator ? 'known' : 'not_asked',
    operator: seededOperator,
    plan: null,
    detailsStatus: seededOperator ? 'known' : 'not_asked',
  };

  let previousAi = '';
  for (const message of messages) {
    if (message.role === 'ai') {
      previousAi = message.content;
      continue;
    }
    const normalizedPreviousAi = normalize(previousAi);
    const city = extractCity(message.content)
      ?? (/cidade|onde\s+(?:mora|moram|usar|utilizar)/.test(normalizedPreviousAi)
        ? extractCity(`cidade de ${message.content}`)
        : null);
    if (city) {
      location = {
        ...location,
        city: city.city,
        state: city.state,
        cityStatus: 'known',
        isCapital: city.isCapital,
        neighborhoodRequired: city.isCapital,
      };
    }
    const neighborhood = extractNeighborhood(message.content)
      ?? (/bairro/.test(normalizedPreviousAi) ? extractNeighborhood(`bairro ${message.content}`) : null);
    if (neighborhood) location = { ...location, neighborhood, neighborhoodStatus: 'known' };

    let business = extractBusinessAnswer(message.content);
    if (!business && /cnpj|mei/.test(normalizedPreviousAi)) {
      const normalizedLeadAnswer = normalize(message.content).replace(/[.!?,;]+$/, '').trim();
      if (/^(?:sim|tenho|possuo|temos|sou|somos|tem\s+sim)\b/.test(normalizedLeadAnswer)) {
        business = { value: 'yes', type: null, number: null };
      } else if (/^(?:mei|cnpj|mei\s+e\s+cnpj|cnpj\s+e\s+mei)$/.test(normalizedLeadAnswer)) {
        business = {
          value: 'yes',
          type: normalizedLeadAnswer.includes('mei') && normalizedLeadAnswer.includes('cnpj')
            ? 'both'
            : normalizedLeadAnswer.includes('mei') ? 'mei' : 'cnpj',
          number: null,
        };
      } else if (/^(?:nao|não|sem|nenhum|nenhuma)\b/.test(normalizedLeadAnswer)) {
        business = { value: 'no', type: null, number: null };
      }
    }
    if (business) {
      company = {
        ...company,
        hasCnpjOrMei: business.value,
        answerStatus: 'known',
        type: business.type,
        number: business.number ?? company.number,
        numberStatus: business.number ? 'known' : company.number ? company.numberStatus : 'unknown',
      };
    }
    let plan = extractPlanAnswer(message.content);
    if (!plan && /plano|operadora/.test(normalizedPreviousAi)) {
      const normalizedLeadAnswer = normalize(message.content);
      if (/^(?:sim|tenho|possuo|temos|tem\s+sim)\b/.test(normalizedLeadAnswer)) {
        plan = { value: 'yes', operator: null, plan: null };
      } else if (/^(?:nao|não|sem|nenhum|nenhuma)\b/.test(normalizedLeadAnswer)) {
        plan = { value: 'no', operator: null, plan: null };
      }
    }
    if (plan) {
      currentHealthPlan = {
        ...currentHealthPlan,
        hasPlan: plan.value,
        answerStatus: 'known',
        operator: plan.operator ?? currentHealthPlan.operator,
        plan: plan.plan ?? currentHealthPlan.plan,
        detailsStatus: plan.operator || plan.plan ? 'known' : 'unknown',
      };
    }
  }

  const missingRequiredFields: string[] = [];
  if (lives.compositionStatus !== 'known' || lives.count === null) missingRequiredFields.push('lives');
  if (lives.items.length === 0 || lives.items.some((life) => life.ageStatus !== 'known')) missingRequiredFields.push('ages');
  if (location.cityStatus !== 'known') missingRequiredFields.push('city');
  if (location.neighborhoodRequired && location.neighborhoodStatus !== 'known') missingRequiredFields.push('neighborhood');
  if (company.answerStatus !== 'known') missingRequiredFields.push('has_cnpj_or_mei');
  if (currentHealthPlan.answerStatus !== 'known') missingRequiredFields.push('has_current_health_plan');

  const hasAdult = lives.items.some((life) => life.role === 'adult' || (life.age !== null && life.age >= 18));
  const hasSingleUnderTwelve = lives.count === 1 && lives.items.length === 1 && lives.items[0].age !== null && lives.items[0].age < 12;
  const singleUnderTwelveWithoutAdult = hasSingleUnderTwelve && !hasAdult;
  const compositionValid = !singleUnderTwelveWithoutAdult;
  if (!compositionValid) missingRequiredFields.push('adult_for_under_12');

  const complete = missingRequiredFields.length === 0;
  return {
    schemaVersion: 1,
    status: complete ? 'complete' : 'in_progress',
    lives: {
      ...lives,
      countStatus: lives.count === null ? 'unknown' : 'known',
    },
    location,
    company,
    currentHealthPlan,
    missingRequiredFields,
    missingOptionalFields: [
      ...(company.hasCnpjOrMei === 'yes' && company.numberStatus !== 'known' ? ['cnpj_number'] : []),
      ...(currentHealthPlan.hasPlan === 'yes' && !currentHealthPlan.operator ? ['current_operator'] : []),
      ...(currentHealthPlan.hasPlan === 'yes' && !currentHealthPlan.plan ? ['current_plan'] : []),
    ],
    singleUnderTwelveWithoutAdult,
    compositionValid,
    completedAt: complete ? extractedAt : null,
    extractedAt,
  };
};

export const createInitialQualificationState = (extractedAt: string): AutonomousQualificationState => calculateState([], extractedAt);

export const extractAutonomousQualificationState = (
  messages: QualificationMessage[],
  extractedAt: string,
  seed?: QualificationContextSeed,
): AutonomousQualificationState => calculateState(messages, extractedAt, seed);

export const buildQualificationDecisionPrompt = (state: AutonomousQualificationState): string => {
  const missing = state.missingRequiredFields.length > 0 ? state.missingRequiredFields.join(', ') : 'nenhum';
  return [
    'ESTADO DETERMINISTICO DA QUALIFICACAO',
    `status ${state.status}`,
    `vidas ${state.lives.count ?? 'desconhecido'}`,
    `idades ${state.lives.items.map((life) => life.age ?? 'desconhecida').join(', ') || 'desconhecidas'}`,
    `cidade ${state.location.city ?? 'desconhecida'}`,
    `bairro ${state.location.neighborhood ?? (state.location.neighborhoodRequired ? 'obrigatorio e ausente' : 'nao necessario')}`,
    `cnpj ou mei ${state.company.hasCnpjOrMei}`,
    `plano atual ${state.currentHealthPlan.hasPlan}`,
    `operadora ${state.currentHealthPlan.operator ?? 'nao informada'}`,
    `campos obrigatorios faltantes ${missing}`,
    state.singleUnderTwelveWithoutAdult
      ? 'REGRA ATIVA incluir adulto titular e obter a idade dele antes de concluir'
      : 'REGRA DE MENOR DE 12 nao esta ativa',
    'Use esse estado como fonte de verdade. Nao pergunte novamente um campo que nao esteja faltante.',
  ].join('\n');
};

export const qualificationStateIsComplete = (state: AutonomousQualificationState): boolean => state.status === 'complete' && state.missingRequiredFields.length === 0;
