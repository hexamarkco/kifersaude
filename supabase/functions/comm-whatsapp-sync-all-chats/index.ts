import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';
import {
  COMM_WHATSAPP_MODULE,
  corsHeaders,
  ensureCommWhatsAppSettings,
  ensurePrimaryChannel,
  extractWhapiChatId,
  fetchWhapiChatsPage,
  isDirectWhapiChatId,
  normalizeWhapiChatId,
  syncWhapiDirectChatMessages,
} from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type SyncAllBody = {
  chatOffset?: number;
  chatCount?: number;
  pagesPerChat?: number;
  messagesPerPage?: number;
  timeTo?: number;
};

type ChatSyncOutcome = {
  externalChatId: string;
  imported: number;
  updated: number;
  discovered: boolean;
  error?: string;
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createAdminClient();

    // Sincronizacao geral e uma operacao pesada (varias chamadas a Whapi por
    // lote) e reimporta historico em massa — exige permissao de edicao do
    // modulo, nao apenas visualizacao.
    if (!isServiceRoleRequest(req, serviceRoleKey)) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: COMM_WHATSAPP_MODULE,
        requiredPermission: 'edit',
      });

      if (!authResult.authorized) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.status,
          headers: jsonHeaders,
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as SyncAllBody;
    const chatOffset = Math.max(Math.floor(Number(body.chatOffset) || 0), 0);
    const chatCount = Math.min(Math.max(Math.floor(Number(body.chatCount) || 8), 1), 30);
    const pagesPerChat = Math.min(Math.max(Math.floor(Number(body.pagesPerChat) || 3), 1), 10);
    const messagesPerPage = Math.min(Math.max(Math.floor(Number(body.messagesPerPage) || 100), 1), 500);
    const requestedTimeTo = Number(body.timeTo);
    const timeTo = Number.isFinite(requestedTimeTo) && requestedTimeTo > 0
      ? Math.floor(requestedTimeTo)
      : Math.floor(Date.now() / 1000);

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.enabled) {
      return new Response(JSON.stringify({ error: 'Integração WhatsApp desabilitada.' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const channel = await ensurePrimaryChannel(supabaseAdmin);

    const { data: chatRows, error: chatsError, count: totalKnownChats } = await supabaseAdmin
      .from('comm_whatsapp_chats')
      .select('external_chat_id', { count: 'exact' })
      .eq('channel_id', channel.id)
      .is('deleted_at', null)
      .is('merged_into_chat_id', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(chatOffset, chatOffset + chatCount - 1);

    if (chatsError) {
      throw new Error(`Erro ao listar conversas locais: ${chatsError.message}`);
    }

    const knownExternalChatIds = new Set(
      (chatRows || [])
        .map((row: { external_chat_id?: unknown }) => normalizeWhapiChatId(row.external_chat_id))
        .filter((id: string) => Boolean(id)),
    );

    const chatsToSync: Array<{ externalChatId: string; discovered: boolean }> = [
      ...[...knownExternalChatIds].map((externalChatId) => ({ externalChatId, discovered: false })),
    ];

    // Descoberta best-effort de conversas que a Whapi conhece mas que ainda
    // nao existem localmente (ex.: contato que so mandou mensagem pela
    // primeira vez durante a queda e cujo webhook nunca foi reentregue).
    // Isolado em try/catch: se o formato da resposta mudar ou a chamada
    // falhar, a sincronizacao das conversas ja conhecidas segue normalmente.
    let discoveredChats = 0;
    try {
      const discoveryPage = await fetchWhapiChatsPage({ token: settings.token, count: chatCount, offset: chatOffset });
      for (const rawChat of discoveryPage.chats) {
        const candidateId = normalizeWhapiChatId(extractWhapiChatId(rawChat));
        if (!candidateId || !isDirectWhapiChatId(candidateId) || knownExternalChatIds.has(candidateId)) {
          continue;
        }

        const { data: existingChat } = await supabaseAdmin
          .from('comm_whatsapp_chats')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('external_chat_id', candidateId)
          .maybeSingle();
        if (existingChat) {
          continue;
        }

        chatsToSync.push({ externalChatId: candidateId, discovered: true });
        discoveredChats += 1;
      }
    } catch (discoveryError) {
      console.error('[comm-whatsapp-sync-all-chats] descoberta de novas conversas falhou (ignorado)', discoveryError);
    }

    let importedMessages = 0;
    let updatedMessages = 0;
    let identityConflicts = 0;
    const chats: ChatSyncOutcome[] = [];

    for (const { externalChatId, discovered } of chatsToSync) {
      let offset = 0;
      let hasMore = true;
      let pages = 0;
      let chatImported = 0;
      let chatUpdated = 0;

      try {
        while (hasMore && pages < pagesPerChat) {
          const result = await syncWhapiDirectChatMessages(supabaseAdmin, {
            channel,
            token: settings.token,
            externalChatId,
            offset,
            count: messagesPerPage,
            timeTo,
          });

          chatImported += result.inserted;
          chatUpdated += result.updated;
          if (result.identityConflict) {
            identityConflicts += 1;
          }
          hasMore = result.hasMore && result.nextOffset !== null;
          offset = result.nextOffset ?? offset;
          pages += 1;
        }

        importedMessages += chatImported;
        updatedMessages += chatUpdated;
        chats.push({ externalChatId, imported: chatImported, updated: chatUpdated, discovered });
      } catch (chatError) {
        console.error(`[comm-whatsapp-sync-all-chats] erro ao sincronizar ${externalChatId}`, chatError);
        chats.push({
          externalChatId,
          imported: chatImported,
          updated: chatUpdated,
          discovered,
          error: chatError instanceof Error ? chatError.message : 'Erro desconhecido ao sincronizar esta conversa.',
        });
      }
    }

    const hasMoreChats = (chatRows?.length || 0) >= chatCount;

    return new Response(JSON.stringify({
      success: true,
      totalKnownChats: typeof totalKnownChats === 'number' ? totalKnownChats : null,
      processedChats: chats.length,
      discoveredChats,
      importedMessages,
      updatedMessages,
      identityConflicts,
      hasMoreChats,
      nextChatOffset: hasMoreChats ? chatOffset + chatCount : null,
      timeTo,
      chats,
    }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('[comm-whatsapp-sync-all-chats] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao sincronizar todas as conversas.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
