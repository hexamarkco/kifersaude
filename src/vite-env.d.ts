/// <reference types="vite/client" />

interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_SITE_INDEXABLE?: string;
  readonly VITE_VERCEL_ENV?: string;
  readonly VITE_GOOGLE_SITE_VERIFICATION?: string;
  readonly VITE_BING_SITE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __KIFER_DEPLOYMENT_ENV__: string;
