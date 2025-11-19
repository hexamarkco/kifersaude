import { type ChangeEvent, useState } from 'react';
import {
  ArchiveRestore,
  FileText,
  Loader2,
  Paintbrush,
  RefreshCw,
  Settings,
} from 'lucide-react';
import WhatsappCampaignsPage from '../pages/WhatsappCampaignsPage';
import { callWhatsappFunction } from '../lib/whatsappApi';

export type WhatsappWallpaperOption = {
  id: string;
  label: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundColor: string;
};

const settingsTabs = [
  {
    id: 'preferences',
    label: 'Preferências',
    description: 'Automação e personalização do painel',
    icon: Settings,
  },
  {
    id: 'campaigns',
    label: 'Campanhas',
    description: 'Fluxos e métricas de disparos',
    icon: FileText,
  },
] as const;

type SettingsTabId = (typeof settingsTabs)[number]['id'];

type WhatsappSettingsPanelProps = {
  wallpaperOptions: WhatsappWallpaperOption[];
  selectedWallpaperId: string;
  onWallpaperChange: (wallpaperId: string) => void;
  onCustomWallpaperUpload: (imageDataUrl: string) => void;
  onCustomWallpaperRemove: () => void;
  customWallpaper?: WhatsappWallpaperOption | null;
  autoUnarchiveArchivedChats: boolean;
  onAutoUnarchiveChange: (enabled: boolean) => void;
};

export default function WhatsappSettingsPanel({
  wallpaperOptions,
  selectedWallpaperId,
  onWallpaperChange,
  onCustomWallpaperUpload,
  onCustomWallpaperRemove,
  customWallpaper,
  autoUnarchiveArchivedChats,
  onAutoUnarchiveChange,
}: WhatsappSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('preferences');
  const [photoSyncStatus, setPhotoSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [photoSyncFeedback, setPhotoSyncFeedback] = useState<string | null>(null);
  const [customWallpaperError, setCustomWallpaperError] = useState<string | null>(null);
  const [uploadingCustomWallpaper, setUploadingCustomWallpaper] = useState(false);

  const handleTriggerPhotoSync = async () => {
    setPhotoSyncStatus('running');
    setPhotoSyncFeedback(null);

    try {
      await callWhatsappFunction('whatsapp-chat-photo-sync', { method: 'POST' }, { useServiceKey: true });
      setPhotoSyncStatus('success');
      setPhotoSyncFeedback('Sincronização forçada enviada. As fotos serão atualizadas em instantes.');
    } catch (error) {
      setPhotoSyncStatus('error');
      setPhotoSyncFeedback(
        error instanceof Error
          ? error.message
          : 'Erro ao disparar a sincronização de fotos. Tente novamente em instantes.',
      );
    }
  };

  const renderPreferences = () => (
    <div className="space-y-6 p-3 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ArchiveRestore className="h-4 w-4 text-emerald-500" /> Chats arquivados
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Defina como o KS deve tratar conversas arquivadas quando um cliente envia uma nova mensagem.
        </p>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Desarquivar automaticamente</p>
              <p className="text-xs text-slate-500">
                {autoUnarchiveArchivedChats
                  ? 'Chats arquivados retornam para a lista principal ao receberem mensagens novas.'
                  : 'Chats permanecem arquivados mesmo quando chegam mensagens novas.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAutoUnarchiveChange(!autoUnarchiveArchivedChats)}
              className={`h-6 w-11 rounded-full border transition-colors ${
                autoUnarchiveArchivedChats
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-slate-300 bg-slate-200'
              }`}
              aria-pressed={autoUnarchiveArchivedChats}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  autoUnarchiveArchivedChats ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Recomendamos manter essa opção ativa para evitar perder novas interações após encerrar uma conversa.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Paintbrush className="h-4 w-4 text-emerald-500" /> Papel de parede do chat
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Defina um fundo único para todas as conversas. A alteração é aplicada a todos os chats.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex cursor-pointer flex-col justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/60">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                setCustomWallpaperError(null);

                if (!file.type.startsWith('image/')) {
                  setCustomWallpaperError('Envie um arquivo de imagem (JPG, PNG ou WEBP).');
                  event.target.value = '';
                  return;
                }

                setUploadingCustomWallpaper(true);
                const reader = new FileReader();
                reader.onload = () => {
                  const imageDataUrl = typeof reader.result === 'string' ? reader.result : '';

                  if (!imageDataUrl) {
                    setCustomWallpaperError('Não foi possível ler a imagem selecionada.');
                  } else {
                    onCustomWallpaperUpload(imageDataUrl);
                  }

                  setUploadingCustomWallpaper(false);
                  event.target.value = '';
                };
                reader.onerror = () => {
                  setUploadingCustomWallpaper(false);
                  setCustomWallpaperError('Erro ao carregar a imagem. Tente novamente.');
                  event.target.value = '';
                };
                reader.readAsDataURL(file);
              }}
              disabled={uploadingCustomWallpaper}
            />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                {uploadingCustomWallpaper ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paintbrush className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Enviar papel de parede</p>
                <p className="text-xs text-slate-500">
                  {uploadingCustomWallpaper ? 'Processando imagem...' : 'JPG, PNG ou WEBP de até 5 MB.'}
                </p>
              </div>
            </div>
            {customWallpaper ? (
              <p className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Personalizado disponível
              </p>
            ) : null}
          </label>

          {customWallpaper ? (
            <button
              type="button"
              onClick={onCustomWallpaperRemove}
              className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-left text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300"
            >
              <span className="text-sm font-semibold">Remover papel personalizado</span>
              <span className="text-xs text-rose-600">Voltar para os papéis padrão e limpar o envio.</span>
            </button>
          ) : null}
        </div>
        {customWallpaperError ? (
          <p className="mt-2 text-xs font-semibold text-rose-600">{customWallpaperError}</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wallpaperOptions.map(option => {
            const isSelected = option.id === selectedWallpaperId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onWallpaperChange(option.id)}
                className={`flex flex-col gap-2 rounded-xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow ${
                  isSelected ? 'border-emerald-300 bg-emerald-50/70 shadow-inner' : 'border-slate-200 bg-slate-50'
                }`}
                aria-pressed={isSelected}
              >
                <div
                  className="h-16 rounded-xl border border-white/70 shadow-inner"
                  style={{
                    backgroundColor: option.backgroundColor,
                    backgroundImage: option.backgroundImage,
                    backgroundSize: option.backgroundSize,
                    backgroundRepeat: option.backgroundRepeat ?? 'repeat',
                  }}
                />
                <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  <span>{option.label}</span>
                  {isSelected ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      Ativo
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <RefreshCw className="h-4 w-4 text-emerald-500" /> Fotos de perfil
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Atualize as fotos de perfil dos contatos manualmente. Use esta opção se alguma conversa estiver sem foto ou com imagem desatualizada.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTriggerPhotoSync}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={photoSyncStatus === 'running'}
          >
            {photoSyncStatus === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {photoSyncStatus === 'running' ? 'Disparando...' : 'Forçar sincronização agora'}
          </button>
          <p className="text-xs text-slate-500">Execução utiliza a função segura do Supabase com credencial de serviço.</p>
        </div>
        {photoSyncFeedback ? (
          <p className={`mt-3 text-sm ${photoSyncStatus === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {photoSyncFeedback}
          </p>
        ) : null}
      </section>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white/90 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {settingsTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 min-w-[180px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-inner'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                }`}
              >
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">{tab.label}</p>
                  <p className="text-[11px] text-slate-500">{tab.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preferences' ? (
          renderPreferences()
        ) : (
          <div className="h-full p-3 sm:p-4">
            <div className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <WhatsappCampaignsPage />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
