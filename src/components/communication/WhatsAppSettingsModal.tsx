import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, RefreshCw, Settings } from 'lucide-react';
import ModalShell from '../ui/ModalShell';
import Tabs, { type TabItem } from '../ui/Tabs';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import WhatsAppCampaignSettings from './WhatsAppCampaignSettings';

type SettingsTab = 'general' | 'campaigns';

type SyncAllChatsProgress = {
  total: number;
  completed: number;
  failed: number;
  currentChatId: string | null;
  currentChatName: string | null;
};

type WhatsAppSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isSyncingAllChats: boolean;
  syncingChatId: string | null;
  chatsCount: number;
  syncAllChatsProgress: SyncAllChatsProgress;
  onSyncAllChats: () => void;
  showArchived: boolean;
  archivedCount: number;
  onToggleShowArchived: () => void;
  prioritizeUnread: boolean;
  onTogglePrioritizeUnread: (nextValue: boolean) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  notificationsActive: boolean;
  notificationsLabel: string;
  onToggleDesktopNotifications: () => void;
};

const SETTINGS_TABS: TabItem<SettingsTab>[] = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'campaigns', label: 'Campanhas', icon: RefreshCw },
];

export default function WhatsAppSettingsModal({
  isOpen,
  onClose,
  isSyncingAllChats,
  syncingChatId,
  chatsCount,
  syncAllChatsProgress,
  onSyncAllChats,
  showArchived,
  archivedCount,
  onToggleShowArchived,
  prioritizeUnread,
  onTogglePrioritizeUnread,
  notificationPermission,
  notificationsActive,
  notificationsLabel,
  onToggleDesktopNotifications,
}: WhatsAppSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('general');
    }
  }, [isOpen]);

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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Configuracoes do WhatsApp"
      description="Ajuste a inbox e gerencie disparos de campanhas."
      size="xl"
    >
      <div className="space-y-4">
        <Tabs items={SETTINGS_TABS} value={activeTab} onChange={setActiveTab} variant="panel" />

        {activeTab === 'general' ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Configuracoes da lista</h3>
                  <p className="text-xs text-slate-500">Sincronizacao, visualizacao e prioridade da fila.</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onSyncAllChats}
                  loading={isSyncingAllChats}
                  disabled={Boolean(syncingChatId) || chatsCount === 0}
                >
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar todos os chats
                </Button>
              </div>

              <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  Total de chats: <strong>{chatsCount}</strong>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  Arquivados: <strong>{archivedCount}</strong>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  Progresso sync: <strong>{syncProgressPercentage}%</strong>
                </div>
              </div>

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
                <Button variant="soft" size="sm" onClick={onToggleShowArchived}>
                  {showArchived ? 'Ocultar arquivados' : 'Mostrar arquivados'}
                </Button>

                <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 px-3 text-xs text-slate-700">
                  <span>Priorizar nao lidas</span>
                  <Checkbox
                    checked={prioritizeUnread}
                    onChange={(event) => onTogglePrioritizeUnread(event.target.checked)}
                  />
                </label>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onToggleDesktopNotifications}
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
              <p className="mt-1">Ctrl/Cmd + K busca, Ctrl/Cmd + N novo chat, Ctrl/Cmd + Shift + J proxima nao lida.</p>
            </section>
          </div>
        ) : (
          <WhatsAppCampaignSettings />
        )}
      </div>
    </ModalShell>
  );
}
