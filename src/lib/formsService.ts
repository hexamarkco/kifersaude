import type { PostgrestError } from '@supabase/supabase-js';

import {
  supabase,
  type PublicForm,
  type PublicFormStep,
  type PublicFormSubmission,
} from './supabase';

const FORMS_TABLE = 'public_forms';
const STEPS_TABLE = 'public_form_steps';
const SUBMISSIONS_TABLE = 'public_form_submissions';

const toPostgrestError = (error: unknown): PostgrestError => {
  if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
    return error as PostgrestError;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return { message, details: '', hint: '', code: 'UNKNOWN', name: 'Error' };
};

export type PublicFormSubmitPayload = {
  formSlug: string;
  answers: Record<string, string | string[]>;
  contact: { name: string; phone: string; email: string | null };
  geo: {
    permission: 'granted' | 'denied' | 'unavailable' | 'not_requested';
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  };
  website: string;
};

export const formsService = {
  // --- Admin: forms ---
  async getForms(): Promise<PublicForm[]> {
    try {
      const { data, error } = await supabase.from(FORMS_TABLE).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as PublicForm[] | null) ?? [];
    } catch (error) {
      console.error('Error loading forms:', error);
      return [];
    }
  },

  async createForm(
    payload: Pick<PublicForm, 'slug' | 'title'> &
      Partial<
        Pick<
          PublicForm,
          'description' | 'success_headline' | 'success_message' | 'whatsapp_redirect' | 'whatsapp_message_template' | 'request_geolocation' | 'is_published'
        >
      >,
  ): Promise<{ data: PublicForm | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase.from(FORMS_TABLE).insert([payload]).select().single();
      return { data: (data as PublicForm) ?? null, error };
    } catch (error) {
      console.error('Error creating form:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateForm(
    id: string,
    updates: Partial<
      Pick<
        PublicForm,
        | 'slug'
        | 'title'
        | 'description'
        | 'success_headline'
        | 'success_message'
        | 'whatsapp_redirect'
        | 'whatsapp_message_template'
        | 'request_geolocation'
        | 'is_published'
      >
    >,
  ): Promise<{ data: PublicForm | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase.from(FORMS_TABLE).update(updates).eq('id', id).select().single();
      return { data: (data as PublicForm) ?? null, error };
    } catch (error) {
      console.error('Error updating form:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async deleteForm(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(FORMS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting form:', error);
      return { error: toPostgrestError(error) };
    }
  },

  // --- Admin: steps ---
  async getFormSteps(formId: string): Promise<PublicFormStep[]> {
    try {
      const { data, error } = await supabase
        .from(STEPS_TABLE)
        .select('*')
        .eq('form_id', formId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as PublicFormStep[] | null) ?? [];
    } catch (error) {
      console.error('Error loading form steps:', error);
      return [];
    }
  },

  async createStep(
    payload: Pick<PublicFormStep, 'form_id' | 'step_type' | 'title'> &
      Partial<Pick<PublicFormStep, 'description' | 'placeholder' | 'is_required' | 'field_key' | 'options' | 'position'>>,
  ): Promise<{ data: PublicFormStep | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase.from(STEPS_TABLE).insert([payload]).select().single();
      return { data: (data as PublicFormStep) ?? null, error };
    } catch (error) {
      console.error('Error creating form step:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateStep(
    id: string,
    updates: Partial<
      Pick<PublicFormStep, 'step_type' | 'title' | 'description' | 'placeholder' | 'is_required' | 'field_key' | 'options' | 'position'>
    >,
  ): Promise<{ data: PublicFormStep | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase.from(STEPS_TABLE).update(updates).eq('id', id).select().single();
      return { data: (data as PublicFormStep) ?? null, error };
    } catch (error) {
      console.error('Error updating form step:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async deleteStep(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(STEPS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting form step:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async reorderSteps(orderedIds: string[]): Promise<{ error: PostgrestError | null }> {
    try {
      const results = await Promise.all(
        orderedIds.map((id, index) => supabase.from(STEPS_TABLE).update({ position: index }).eq('id', id)),
      );
      const failed = results.find((result) => result.error);
      return { error: failed?.error ?? null };
    } catch (error) {
      console.error('Error reordering form steps:', error);
      return { error: toPostgrestError(error) };
    }
  },

  // --- Admin: submissions ---
  async getFormSubmissions(formId: string, limit = 50): Promise<PublicFormSubmission[]> {
    try {
      const { data, error } = await supabase
        .from(SUBMISSIONS_TABLE)
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as PublicFormSubmission[] | null) ?? [];
    } catch (error) {
      console.error('Error loading form submissions:', error);
      return [];
    }
  },

  // --- Public ---
  async getPublicForm(slug: string): Promise<{ form: PublicForm | null; steps: PublicFormStep[] }> {
    try {
      const { data: form, error: formError } = await supabase
        .from(FORMS_TABLE)
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      if (formError) throw formError;
      if (!form) return { form: null, steps: [] };

      const { data: steps, error: stepsError } = await supabase
        .from(STEPS_TABLE)
        .select('*')
        .eq('form_id', (form as PublicForm).id)
        .order('position', { ascending: true });
      if (stepsError) throw stepsError;

      return { form: form as PublicForm, steps: (steps as PublicFormStep[] | null) ?? [] };
    } catch (error) {
      console.error('Error loading public form:', error);
      return { form: null, steps: [] };
    }
  },

  async submitPublicForm(payload: PublicFormSubmitPayload): Promise<{ success: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('public-form-submit', { body: payload });
      if (error) throw error;
      return { success: Boolean((data as { success?: boolean } | null)?.success) };
    } catch (error) {
      console.error('Error submitting form:', error);
      return { success: false };
    }
  },
};
