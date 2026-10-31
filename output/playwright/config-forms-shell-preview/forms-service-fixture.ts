import type { PublicForm, PublicFormStep, PublicFormSubmission } from '../../../src/features/public-content/domain/types';

const now = '2026-10-30T12:00:00.000Z';
const forms: PublicForm[] = Array.from({ length: 8 }, (_, index) => ({
  id: index === 0 ? 'demo-cotacao' : `demo-form-${index + 1}`,
  slug: index === 0 ? 'cotacao-familiar' : `formulario-${index + 1}`,
  title: index === 0 ? 'Cotação familiar' : ['Solicitação de contato', 'Pesquisa pós-atendimento', 'Simulação empresarial', 'Contato pelo site', 'Retorno de proposta', 'Campanha regional', 'Atualização cadastral'][index - 1],
  description: index === 0 ? 'Descubra opções de planos para sua família.' : null,
  success_headline: 'Recebemos suas informações',
  success_message: 'Nossa equipe entrará em contato em breve.',
  whatsapp_redirect: false,
  whatsapp_message_template: null,
  request_geolocation: index === 0,
  is_published: index !== 5,
  submission_count: [24, 18, 12, 7, 5, 2, 1, 0][index],
  created_at: new Date(Date.UTC(2026, 9, 30 - index)).toISOString(),
  updated_at: now,
}));

const steps: PublicFormStep[] = [
  {
    id: 'demo-step-profile', form_id: 'demo-cotacao', position: 0, step_type: 'single_choice',
    title: 'Qual é o tipo de contratação?', description: 'Selecione a opção que melhor representa você.',
    placeholder: null, is_required: true, field_key: 'tipo_contratacao',
    options: [
      { id: 'opt-pf', label: 'Pessoa física', value: 'PF' },
      { id: 'opt-mei', label: 'MEI', value: 'MEI' },
      { id: 'opt-cnpj', label: 'Empresarial', value: 'CNPJ' },
    ], created_at: now, updated_at: now,
  },
  {
    id: 'demo-step-interest', form_id: 'demo-cotacao', position: 1, step_type: 'multi_choice',
    title: 'Quem deseja incluir no plano?', description: 'Marque todas as opções aplicáveis.',
    placeholder: null, is_required: false, field_key: null,
    options: [
      { id: 'opt-self', label: 'Eu' },
      { id: 'opt-partner', label: 'Cônjuge ou companheiro(a)' },
      { id: 'opt-child', label: 'Filho(a)' },
    ], created_at: now, updated_at: now,
  },
  {
    id: 'demo-step-contact', form_id: 'demo-cotacao', position: 2, step_type: 'contact',
    title: 'Quase lá! Como podemos te chamar?', description: null,
    placeholder: null, is_required: true, field_key: null, options: [], created_at: now, updated_at: now,
  },
];

const submissions: PublicFormSubmission[] = [{
  id: 'demo-submission-1', form_id: 'demo-cotacao', lead_id: null,
  answers: { tipo_contratacao: 'PF', integrantes: ['Eu', 'Filho(a)'] },
  contact_name: 'Pessoa de demonstração', contact_phone: '(21) 90000-0000', contact_email: 'demo@example.invalid',
  latitude: null, longitude: null, geo_accuracy_m: null, geo_permission: 'not_requested', user_agent: 'Prévia local', created_at: now,
}];

const noError = { error: null };

export const formsService = {
  getForms: async () => forms.map((form) => ({ ...form })),
  createForm: async (payload: Pick<PublicForm, 'slug' | 'title'>) => {
    if (forms.some((form) => form.slug === payload.slug)) return { data: null, error: { code: '23505' } };
    const created: PublicForm = {
      id: `demo-form-${Date.now()}`, ...payload, description: null,
      success_headline: 'Recebemos suas informações', success_message: 'Nossa equipe entrará em contato em breve.',
      whatsapp_redirect: false, whatsapp_message_template: null, request_geolocation: false,
      is_published: false, submission_count: 0, created_at: now, updated_at: now,
    };
    forms.unshift(created);
    return { data: { ...created }, error: null };
  },
  updateForm: async (id: string, updates: Partial<PublicForm>) => {
    const form = forms.find((item) => item.id === id);
    if (!form) return { data: null, error: { code: 'NOT_FOUND' } };
    Object.assign(form, updates, { updated_at: now });
    return { data: { ...form }, error: null };
  },
  deleteForm: async () => noError,
  getFormSteps: async (formId: string) => steps.filter((step) => step.form_id === formId).map((step) => ({ ...step, options: [...step.options] })),
  createStep: async (payload: Pick<PublicFormStep, 'form_id' | 'step_type' | 'title'> & Partial<PublicFormStep>) => {
    const created: PublicFormStep = {
      id: `demo-step-${Date.now()}`, position: payload.position ?? 0, step_type: payload.step_type,
      title: payload.title, description: payload.description ?? null, placeholder: payload.placeholder ?? null,
      is_required: payload.is_required ?? true, field_key: payload.field_key ?? null, options: payload.options ?? [],
      form_id: payload.form_id, created_at: now, updated_at: now,
    };
    steps.push(created);
    return { data: { ...created }, error: null };
  },
  updateStep: async (id: string, updates: Partial<PublicFormStep>) => {
    const step = steps.find((item) => item.id === id);
    if (!step) return { data: null, error: { code: 'NOT_FOUND' } };
    Object.assign(step, updates, { updated_at: now });
    return { data: { ...step }, error: null };
  },
  deleteStep: async () => noError,
  reorderSteps: async (orderedIds: string[]) => {
    orderedIds.forEach((id, position) => {
      const step = steps.find((item) => item.id === id);
      if (step) step.position = position;
    });
    return noError;
  },
  getFormSubmissions: async (formId: string) => submissions.filter((item) => item.form_id === formId).map((item) => ({ ...item })),
};
