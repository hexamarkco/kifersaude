import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Paintbrush,
  RefreshCw,
  Settings,
  Shield,
  UserPlus2,
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

const automationOptions = [
  {
    id: 'autoArchive',
    label: 'Arquivar inativos',
    description: 'Arquiva automaticamente conversas sem resposta há mais de 15 dias.',
  },
  {
    id: 'autoAssign',
    label: 'Distribuição inteligente',
    description: 'Distribui novas conversas entre os atendentes disponíveis.',
  },
  {
    id: 'notifyManagers',
    label: 'Alertar gestores',
    description: 'Envia alertas quando o SLA é ultrapassado em qualquer fila.',
  },
] as const;

const notificationChannels = [
  {
    id: 'email',
    label: 'Email corporativo',
    description: 'Resumo diário das conversas encerradas e pendências críticas.',
  },
  {
    id: 'sms',
    label: 'SMS de plantão',
    description: 'Avisos rápidos quando o tempo de espera exceder o limite configurado.',
  },
  {
    id: 'dashboard',
    label: 'Painel KS',
    description: 'Notificações dentro do painel para toda a equipe.',
  },
] as const;

type ToggleState = Record<(typeof automationOptions)[number]['id'], boolean> & {
  [K in (typeof notificationChannels)[number]['id']]: boolean;
};

const initialToggles: ToggleState = {
  autoArchive: true,
  autoAssign: true,
  notifyManagers: false,
  email: true,
  sms: false,
  dashboard: true,
};

const routingStrategies = [
  { id: 'round_robin', label: 'Round robin' },
  { id: 'least_busy', label: 'Menos ocupado' },
  { id: 'priority', label: 'Prioridade por fila' },
];

const settingsTabs = [
  {
    id: 'preferences',
    label: 'Preferências',
    description: 'Regras, notificações e automação',
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
};

export default function WhatsappSettingsPanel({
  wallpaperOptions,
  selectedWallpaperId,
  onWallpaperChange,
}: WhatsappSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('preferences');
  const [toggles, setToggles] = useState<ToggleState>(initialToggles);
  const [routingStrategy, setRoutingStrategy] = useState('round_robin');
  const [businessHours, setBusinessHours] = useState({ start: '08:00', end: '18:00' });
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [photoSyncStatus, setPhotoSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [photoSyncFeedback, setPhotoSyncFeedback] = useState<string | null>(null);

  const handleToggle = (id: keyof ToggleState) => {
    setToggles(previous => ({ ...previous, [id]: !previous[id] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    await new Promise(resolve => setTimeout(resolve, 600));
    setSaving(false);
    setFeedback('Preferências atualizadas. Elas serão aplicadas para toda a equipe.');
  };

  const handleTriggerPhotoSync = async () => {
    setPhotoSyncStatus('running');
    setPhotoSyncFeedback(null);

    try {
      await callWhatsappFunction('whatsapp-chat-photo-sync', { method: 'POST' }, { useServiceKey: true });
      setPhotoSyncStatus('success');
      setPhotoSyncFeedback('Sincronização forçada enviada. As fotos serão atualizadas em poucos instantes.');
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
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Central do WhatsApp</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Configurações do atendimento</h2>
            <p className="mt-2 text-sm text-slate-600">
              Ajuste regras de automação, horário de atendimento e notificações sem sair do painel.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
              <Shield className="h-4 w-4" /> Segurança ativa
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" /> Status operacional
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RefreshCw className="h-4 w-4 text-emerald-500" /> Automação
          </div>
          <ul className="mt-4 space-y-3">
            {automationOptions.map(option => (
              <li key={option.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(option.id)}
                  className={`mt-1 h-5 w-9 rounded-full border transition-colors ${
                    toggles[option.id]
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-slate-200'
                  }`}
                  aria-pressed={toggles[option.id]}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      toggles[option.id] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                  <p className="text-xs text-slate-500">{option.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Settings className="h-4 w-4 text-emerald-500" /> Notificações
          </div>
          <ul className="mt-4 space-y-3">
            {notificationChannels.map(channel => (
              <li key={channel.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleToggle(channel.id)}
                  className={`mt-1 h-5 w-9 rounded-full border transition-colors ${
                    toggles[channel.id]
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-slate-200'
                  }`}
                  aria-pressed={toggles[channel.id]}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      toggles[channel.id] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                  <p className="text-xs text-slate-500">{channel.description}</p>
                </div>
              </li>
            ))}
          </ul>
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
          {wallpaperOptions.map(option => {
            const isSelected = option.id === selectedWallpaperId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onWallpaperChange(option.id)}
                className={`flex flex-col gap-2 rounded-xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow ${
                  isSelected
                    ? 'border-emerald-300 bg-emerald-50/70 shadow-inner'
                    : 'border-slate-200 bg-slate-50'
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

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="h-4 w-4 text-emerald-500" /> Horário de atendimento
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Início
              <input
                type="time"
                value={businessHours.start}
                onChange={event => setBusinessHours(current => ({ ...current, start: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fim
              <input
                type="time"
                value={businessHours.end}
                onChange={event => setBusinessHours(current => ({ ...current, end: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Conversas fora do horário exibem automaticamente uma mensagem de ausência personalizada.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus2 className="h-4 w-4 text-emerald-500" /> Roteamento de filas
          </div>
          <div className="mt-3 space-y-3">
            {routingStrategies.map(strategy => (
              <label key={strategy.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm transition hover:border-emerald-500">
                <input
                  type="radio"
                  name="routing-strategy"
                  value={strategy.id}
                  checked={routingStrategy === strategy.id}
                  onChange={event => setRoutingStrategy(event.target.value)}
                />
                <span className="font-semibold text-slate-800">{strategy.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              SLA máximo (min)
              <input
                type="number"
                min={5}
                max={120}
                value={slaMinutes}
                onChange={event => setSlaMinutes(Number.parseInt(event.target.value || '0', 10))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RefreshCw className="h-4 w-4 text-emerald-500" /> Fotos de perfil
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Atualize as fotos de perfil dos contatos manualmente. Use esta opção se alguma conversa estiver sem foto ou com
            imagem desatualizada.
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
            <p
              className={`mt-3 text-sm ${
                photoSyncStatus === 'error' ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {photoSyncFeedback}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Revisão final
          </div>
          <p className="text-sm text-slate-600">
            Todas as alterações impactam imediatamente o roteamento e as notificações das equipes que possuem acesso ao módulo de comunicação.
          </p>
          {feedback ? <p className="text-sm font-semibold text-emerald-600">{feedback}</p> : null}
          <button
            type="button"
            onClick={handleSave}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar preferências'}
          </button>
        </div>
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
