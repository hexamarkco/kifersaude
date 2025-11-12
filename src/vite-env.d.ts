/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WHATSAPP_SLA_WARNING_MINUTES?: string;
  readonly VITE_WHATSAPP_SLA_CRITICAL_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
