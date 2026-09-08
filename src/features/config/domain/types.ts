export type UserProfile = {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
  created_by?: string;
};

export type AccessProfile = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemSettings = {
  id: string;
  company_name: string;
  notification_sound_enabled: boolean;
  notification_volume: number;
  notification_interval_seconds: number;
  session_timeout_minutes: number;
  date_format: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationSetting = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ConfigOption = {
  id: string;
  category: string;
  label: string;
  value: string;
  description?: string | null;
  ordem: number;
  ativo: boolean;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ProfilePermission = {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

