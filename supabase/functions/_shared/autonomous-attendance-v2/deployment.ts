import type { RuntimeModelProfile } from '../ai-router.ts';
import { readStyleLibrary } from './domain/style.ts';

export const V2_DEPLOYMENT_VERSION = 'kifer-v2-2026-11-15.3';
export const V2_MODEL_PROFILE: RuntimeModelProfile = { version: V2_DEPLOYMENT_VERSION, model: 'gpt-6-luna', reasoningEffort: 'medium' };
export const V2_ADVISOR_NAME = 'Luiza Kifer';
export const V2_STYLE_LIBRARY = readStyleLibrary({
  "version": "kifer-human-546c3e1ad04e",
  "examples": [
    {
      "id": "style-d88e1f210a6d",
      "field": "beneficiaries",
      "text": "Perfeito! E qual é a sua idade?",
      "audience": "individual"
    },
    {
      "id": "style-285aa73f9058",
      "field": "city",
      "text": "Agora me conta, por favor, em qual cidade e bairro você mora? Assim consigo verificar as opções de planos disponíveis na sua região.",
      "audience": "individual"
    },
    {
      "id": "style-9711c9d6e9f2",
      "field": "city",
      "text": "Me diz, por favor, em que bairro e cidade sua filha mora? Assim, consigo verificar opções que façam sentido para ela.",
      "audience": "any"
    },
    {
      "id": "style-051778db3b2f",
      "field": "beneficiaries",
      "text": "Perfeito! Você pode me passar as idades de vocês três?",
      "audience": "family"
    },
    {
      "id": "style-f161dafc7c96",
      "field": "beneficiaries",
      "text": "Me fala, quantos anos você tem?",
      "audience": "individual"
    },
    {
      "id": "style-ae2739ce69d9",
      "field": "companyPresence",
      "text": "Você possui CNPJ ou MEI ativo?",
      "audience": "individual"
    },
    {
      "id": "style-59aaf89873a2",
      "field": "hasCurrentPlan",
      "text": "Você já tem plano de saúde hoje ou está sem cobertura?",
      "audience": "individual"
    },
    {
      "id": "style-e1698d464be0",
      "field": "goal",
      "text": "Perfeito, e me conta, o que levou vocês a procurarem um plano de saúde pra ela justamente agora?",
      "audience": "family"
    },
    {
      "id": "style-ccb8a5a8e28b",
      "field": "goal",
      "text": "E o que seria mais importante pra vocês em um plano de saúde hoje?",
      "audience": "family"
    },
    {
      "id": "style-9dd3bd221c1c",
      "field": "city",
      "text": "E vocês moram em qual cidade e bairro? Assim eu consigo verificar direitinho quais opções atendem melhor a região de vocês 😊",
      "audience": "family"
    },
    {
      "id": "style-dc56cda81ab5",
      "field": "hasCurrentPlan",
      "text": "Hoje elas já possuem algum plano de saúde ou estão sem cobertura no momento? 😊",
      "audience": "any"
    },
    {
      "id": "style-6afb6cb5ad05",
      "field": "beneficiaries",
      "text": "Perfeito! Você pode me dizer a sua idade?",
      "audience": "individual"
    },
    {
      "id": "style-6ae2f9aa5933",
      "field": "hasCurrentPlan",
      "text": "Hoje ela já tem algum plano de saúde ou está sem plano no momento?",
      "audience": "any"
    },
    {
      "id": "style-cdd7ab10b606",
      "field": "companyPresence",
      "text": "E ela tem CNPJ ou MEI ativo? Pergunto porque, dependendo disso, consigo verificar mais opções de plano para ela.",
      "audience": "any"
    },
    {
      "id": "style-e757b98088d2",
      "field": "hasCurrentPlan",
      "text": "Você já tem algum plano de saúde ou está sem cobertura no momento?",
      "audience": "individual"
    },
    {
      "id": "style-88898c3725cc",
      "field": "beneficiaryCount",
      "text": "Esse plano será somente para você ou incluirá mais alguém da família?",
      "audience": "individual"
    },
    {
      "id": "style-39d65667de4c",
      "field": "hasCurrentPlan",
      "text": "Ela já tem plano de saúde hoje ou está sem cobertura?",
      "audience": "any"
    }
  ]
});
