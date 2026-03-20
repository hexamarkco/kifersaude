import { normalizePhoneNumber } from '../features/whatsapp/shared/phoneUtils';
import { fetchAllPages, supabase } from './supabase';

export type WhatsAppInboxLeadSummary = {
  id: string;
  nome_completo: string;
  telefone: string;
  status?: string | null;
  responsavel_id?: string | null;
};

type WhatsAppInboxLeadSearchRow = WhatsAppInboxLeadSummary & {
  created_at?: string | null;
  updated_at?: string | null;
  data_criacao?: string | null;
};

const WHATSAPP_INBOX_LEAD_RPC = 'search_whatsapp_inbox_leads';
const FALLBACK_CACHE_TTL_MS = 60_000;
const FALLBACK_PAGE_SIZE = 1000;
const FALLBACK_SELECT = 'id,nome_completo,telefone,status,responsavel_id,created_at,updated_at,data_criacao';

let shouldUseDirectLeadFallback = false;
let fallbackLeadCache:
  | {
      loadedAt: number;
      rows: WhatsAppInboxLeadSearchRow[];
    }
  | null = null;
let fallbackLeadCachePromise: Promise<WhatsAppInboxLeadSearchRow[]> | null = null;

const clampSearchLimit = (value?: number) => Math.min(Math.max(value ?? 200, 1), 300);

const getLeadSortValue = (lead: Pick<WhatsAppInboxLeadSearchRow, 'updated_at' | 'created_at' | 'data_criacao'>) => {
  const rawValue = lead.updated_at ?? lead.created_at ?? lead.data_criacao ?? '';
  const parsedValue = Date.parse(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const mapLeadSummary = ({ id, nome_completo, telefone, status, responsavel_id }: WhatsAppInboxLeadSearchRow): WhatsAppInboxLeadSummary => ({
  id,
  nome_completo,
  telefone,
  status: status ?? null,
  responsavel_id: responsavel_id ?? null,
});

const isMissingRpcError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
  const status = 'status' in error && typeof error.status === 'number' ? error.status : null;
  const combinedMessage = `${message} ${details} ${hint}`.toLowerCase();

  return code === 'PGRST202'
    || status === 404
    || (combinedMessage.includes(WHATSAPP_INBOX_LEAD_RPC) && combinedMessage.includes('schema cache'))
    || (combinedMessage.includes(WHATSAPP_INBOX_LEAD_RPC) && combinedMessage.includes('could not find'));
};

async function loadFallbackLeadRows(): Promise<WhatsAppInboxLeadSearchRow[]> {
  if (fallbackLeadCache && Date.now() - fallbackLeadCache.loadedAt < FALLBACK_CACHE_TTL_MS) {
    return fallbackLeadCache.rows;
  }

  if (fallbackLeadCachePromise) {
    return fallbackLeadCachePromise;
  }

  fallbackLeadCachePromise = fetchAllPages<WhatsAppInboxLeadSearchRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .from('leads')
        .select(FALLBACK_SELECT)
        .eq('arquivado', false)
        .not('telefone', 'is', null)
        .order('id', { ascending: true })
        .range(from, to);

      return {
        data: (data ?? null) as WhatsAppInboxLeadSearchRow[] | null,
        error,
      };
    },
    FALLBACK_PAGE_SIZE,
  )
    .then((rows) => rows
      .filter((row) => Boolean(normalizePhoneNumber(row.telefone)))
      .sort((left, right) => {
        const diff = getLeadSortValue(right) - getLeadSortValue(left);
        if (diff !== 0) {
          return diff;
        }

        return right.id.localeCompare(left.id);
      }))
    .then((rows) => {
      fallbackLeadCache = {
        loadedAt: Date.now(),
        rows,
      };

      return rows;
    })
    .finally(() => {
      fallbackLeadCachePromise = null;
    });

  return fallbackLeadCachePromise;
}

async function searchWhatsAppInboxLeadsDirect(params?: {
  query?: string;
  phoneNumbers?: string[];
  limit?: number;
}): Promise<WhatsAppInboxLeadSummary[]> {
  const rows = await loadFallbackLeadRows();
  const query = params?.query?.trim() ?? '';
  const normalizedQuery = query.toLocaleLowerCase();
  const queryDigits = normalizePhoneNumber(query) || query.replace(/\D/g, '');
  const limit = clampSearchLimit(params?.limit);
  const phoneNumbers = new Set((params?.phoneNumbers ?? []).map((value) => normalizePhoneNumber(value)).filter(Boolean));

  return rows
    .filter((row) => {
      const normalizedPhone = normalizePhoneNumber(row.telefone);
      if (!normalizedPhone) {
        return false;
      }

      if (phoneNumbers.size > 0 && !phoneNumbers.has(normalizedPhone)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const normalizedName = row.nome_completo?.toLocaleLowerCase() ?? '';
      const rawPhone = row.telefone?.toLocaleLowerCase() ?? '';
      const rawDigits = row.telefone?.replace(/\D/g, '') ?? '';

      return normalizedName.includes(normalizedQuery)
        || rawPhone.includes(normalizedQuery)
        || Boolean(queryDigits && (rawDigits.includes(queryDigits) || normalizedPhone.includes(queryDigits)));
    })
    .slice(0, limit)
    .map(mapLeadSummary);
}

export async function searchWhatsAppInboxLeads(params?: {
  query?: string;
  phoneNumbers?: string[];
  limit?: number;
}): Promise<WhatsAppInboxLeadSummary[]> {
  if (!shouldUseDirectLeadFallback) {
    const { data, error } = await supabase.rpc(WHATSAPP_INBOX_LEAD_RPC, {
      p_query: params?.query?.trim() || null,
      p_phone_numbers: params?.phoneNumbers?.length ? params.phoneNumbers : null,
      p_limit: clampSearchLimit(params?.limit),
    });

    if (!error) {
      return ((data ?? []) as WhatsAppInboxLeadSummary[]);
    }

    if (!isMissingRpcError(error)) {
      throw error;
    }

    shouldUseDirectLeadFallback = true;
  }

  return searchWhatsAppInboxLeadsDirect(params);
}
