import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, BellOff, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchAllPages, supabase } from '../../lib/supabase';
import { useWhatsAppInboxPreferences } from '../../hooks/useWhatsAppInboxPreferences';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Checkbox from '../ui/Checkbox';
import Tabs, { type TabItem } from '../ui/Tabs';
import WhatsAppCampaignSettings from './WhatsAppCampaignSettings';

type SettingsTab = 'general' | 'campaigns';

type SyncAllChatsProgress = {
  total: number;
  completed: number;
  failed: number;
  currentChatId: string | null;
  currentChatName: string | null;
};

type ChatSummaryRow = {
  id: string;
  name: string | null;
  phone_number: string | null;
  archived: boolean | null;
};

const SETTINGS_TABS: TabItem<SettingsTab>[] = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'campaigns', label: 'Campanhas', icon: RefreshCw },
];

export default function WhatsAppSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [chatsCount, setChatsCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [chatRows, setChatRows] = useState<ChatSummaryRow[]>([]);
  const [isSyncingAllChats, setIsSyncingAllChats] = useState(false);
  const [syncAllChatsProgress, setSyncAllChatsProgress] = useState<SyncAllChatsProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    currentChatId: null,
    currentChatName: null,
  });
  const {
    prioritizeUnread,
    setPrioritizeUnread,
    notificationPermission,
    notificationsActive,
    notificationsLabel,
    toggleDesktopNotifications,
  } = useWhatsAppInboxPreferences();

  const loadChatSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const rows = await fetchAllPages<ChatSummaryRow>(async (from, to) =>
        supabase.from('whatsapp_chats').select('id, name, phone_number, archived').range(from, to),
      );

      setChatRows(rows);
      setChatsCount(rows.length);
      setArchivedCount(rows.filter((chat) => Boolean(chat.archived)).length);
    } catch (error) {
      console.error('Erro ao carregar resumo do WhatsApp:', error);
      setSummaryError('Não foi possível carregar os indicadores do WhatsApp agora.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    void loadChatSummary();
  }, []);

  const syncProgressPercentage = useMemo(() => {
    if (syncAllChatsProgress.total <= 0) {
      return 0;
    }

    return Math.round((syncAllChatsProgress.completed / syncAllChatsProgress.total) * 100);
  }, [syncAllChatsProgress.completed, syncAllChatsProgress.total]);

  const syncingChatLabel = useMemo(() => {
    const chatName = syncAllChatsProgress.currentChatName?.trim();
    if (chatName) return chatName;

    const chatId = syncAllChatsProgress.currentChatId?.trim();
    if (chatId) return chatId;

    return null;
  }, [syncAllChatsProgress.currentChatId, syncAllChatsProgress.currentChatName]);

  const handleSyncAllChats = async () => {
    if (isSyncingAllChats || chatRows.length === 0) return;

    const chatIds = Array.from(new Set(chatRows.map((chat) => chat.id).filter(Boolean)));
    if (chatIds.length === 0) return;

    setIsSyncingAllChats(true);
    setSyncAllChatsProgress({
      total: chatIds.length,
      completed: 0,
      failed: 0,
      currentChatId: null,
      currentChatName: null,
    });

    let failed = 0;
    const yieldProgressFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    try {
      for (let index = 0; index < chatIds.length; index += 1) {
        const chatId = chatIds[index];
        const currentChat = chatRows.find((chat) => chat.id === chatId);
        const currentChatName = currentChat?.name?.trim() || currentChat?.phone_number?.trim() || chatId;

        setSyncAllChatsProgress((previousValue) => ({
          ...previousValue,
          total: chatIds.length,
          currentChatId: chatId,
          currentChatName,
        }));
        await yieldProgressFrame();

        const { error } = await supabase.functions.invoke('whatsapp-sync', {
          body: { chatId, count: 200 },
        });

        if (error) {
          failed += 1;
          console.error('Erro ao sincronizar chat:', chatId, error);
        }

        setSyncAllChatsProgress((previousValue) => ({
          ...previousValue,
          total: chatIds.length,
          completed: index + 1,
          failed,
          currentChatId: chatId,
          currentChatName,
        }));
        await yieldProgressFrame();
      }

      await loadChatSummary();
    } catch (error) {
      console.error('Erro ao sincronizar todos os chats:', error);
    } finally {
      setIsSyncingAllChats(false);
      setSyncAllChatsProgress((previousValue) => ({
        ...previousValue,
        currentChatId: null,
        currentChatName: null,
      }));
    }
  };

  return (
    <div className="panel-page-shell w-full">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configuracoes do WhatsApp</h1>
          <p className="mt-2 text-sm text-slate-600">Ajuste a inbox e gerencie disparos de campanhas em uma tela dedicada.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/painel/whatsapp')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para conversas
        </Button>
      </div>

      <Card variant="glass" padding="none" className="overflow-hidden">
        <Tabs items={SETTINGS_TABS} value={activeTab} onChange={setActiveTab} variant="panel" listClassName="rounded-none border-x-0 border-t-0" />

        <div className="p-6">
          {activeTab === 'general' ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Configuracoes da inbox</h2>
              <p className="text-xs text-slate-500">Sincronização, visualização e prioridades da fila de conversas.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void handleSyncAllChats();
                    }}
                    loading={isSyncingAllChats}
                    disabled={isLoadingSummary || chatRows.length === 0}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sincronizar todos os chats
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Total de chats: <strong>{isLoadingSummary ? '...' : chatsCount}</strong>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Arquivados: <strong>{isLoadingSummary ? '...' : archivedCount}</strong>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Progresso sync: <strong>{syncProgressPercentage}%</strong>
                  </div>
                </div>

                {summaryError && <p className="mt-3 text-xs text-red-600">{summaryError}</p>}

                {isSyncingAllChats && (
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-amber-700">
                      <span>
                        {syncAllChatsProgress.completed}/{syncAllChatsProgress.total} concluido(s)
                      </span>
                      {syncAllChatsProgress.failed > 0 && <span>{syncAllChatsProgress.failed} com falha</span>}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-amber-800/90">
                      {syncingChatLabel ? `Sincronizando agora: ${syncingChatLabel}` : 'Preparando proximo chat...'}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${syncProgressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex h-10 items-center justify-between rounded-lg border border-slate-200 px-3 text-xs text-slate-700">
                  <span>Priorizar não lidas</span>
                    <Checkbox checked={prioritizeUnread} onChange={(event) => setPrioritizeUnread(event.target.checked)} />
                  </label>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void toggleDesktopNotifications();
                    }}
                    disabled={notificationPermission === 'unsupported'}
                    className="sm:col-span-2"
                  >
                    {notificationsActive ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    Notificacoes desktop ({notificationsLabel})
                  </Button>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Atalhos rapidos</p>
              <p className="mt-1">Ctrl/Cmd + K busca, Ctrl/Cmd + N novo chat, Ctrl/Cmd + Shift + J próxima não lida.</p>
              </section>
            </div>
          ) : (
            <WhatsAppCampaignSettings />
          )}
        </div>
      </Card>
    </div>
  );
}
