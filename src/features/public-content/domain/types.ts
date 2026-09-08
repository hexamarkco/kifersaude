export type PublicLinkPageSettings = {
  id: string;
  title: string;
  subtitle: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicLinkItem = {
  id: string;
  title: string;
  url: string;
  icon: string;
  is_active: boolean;
  position: number;
  click_count: number;
  created_at: string;
  updated_at: string;
};

export type PublicFormStepType = 'single_choice' | 'multi_choice' | 'short_text' | 'contact';

export type PublicFormFieldKey = 'cidade' | 'tipo_contratacao';

export type PublicFormGeoPermission = 'granted' | 'denied' | 'unavailable' | 'not_requested';

export type PublicFormStepOption = {
  id: string;
  label: string;
  value?: string;
};

export type PublicForm = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  success_headline: string;
  success_message: string;
  whatsapp_redirect: boolean;
  whatsapp_message_template: string | null;
  request_geolocation: boolean;
  is_published: boolean;
  submission_count: number;
  created_at: string;
  updated_at: string;
};

export type PublicFormStep = {
  id: string;
  form_id: string;
  position: number;
  step_type: PublicFormStepType;
  title: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  field_key: PublicFormFieldKey | null;
  options: PublicFormStepOption[];
  created_at: string;
  updated_at: string;
};

export type PublicFormSubmission = {
  id: string;
  form_id: string;
  lead_id: string | null;
  answers: Record<string, string | string[]>;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_accuracy_m: number | null;
  geo_permission: PublicFormGeoPermission;
  user_agent: string | null;
  created_at: string;
};

