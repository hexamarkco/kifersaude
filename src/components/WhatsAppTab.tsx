import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Link2,
  MessageSquare,
  Phone,
  Search,
  Send,
  StickyNote,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { TabNavigationOptions } from '../types/navigation';

interface WhatsAppTabProps {
  onNavigateToTab?: (tab: string, options?: TabNavigationOptions) => void;
}

type ChatTimelineItem = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  type: 'incoming' | 'outgoing' | 'note';
};

const chatThreads = [
  {
    id: 'chat-01',
    name: 'Joana Menezes',
    phone: '+55 11 98888-1122',
    status: 'Lead quente',
    origin: 'Campanha Meta',
    assignedTo: 'Lucas',
    leadId: 'LD-4821',
    contractOperadora: 'Amil',
    commissionHighlight: 'Elegível',
    lastMessage: 'Enviei a proposta atualizada com as coberturas.',
    unread: 2,
    timeline: [
      {
        id: 'msg-01',
        author: 'Joana',
        message: 'Vi o anúncio de vocês no Instagram, conseguem me ajudar? 😊',
        timestamp: '09:12',
        type: 'incoming',
      },
      {
        id: 'msg-02',
        author: 'Lucas · KS',
        message: 'Claro! Qual operadora você prefere e quantas vidas?',
        timestamp: '09:13',
        type: 'outgoing',
      },
      {
        id: 'msg-03',
        author: 'Joana',
        message: 'Somos em 3 pessoas, prefiro Amil se tiver oferta empresarial.',
        timestamp: '09:16',
        type: 'incoming',
      },
      {
        id: 'msg-04',
        author: 'Lucas · KS',
        message: 'Enviei proposta com acomodação apartamento e carência reduzida.',
        timestamp: '09:19',
        type: 'outgoing',
      },
      {
        id: 'note-01',
        author: 'Lucas',
        message: 'Registrar follow-up amanhã com oferta sem co-participação.',
        timestamp: '09:21',
        type: 'note',
      },
    ] as ChatTimelineItem[],
  },
  {
    id: 'chat-02',
    name: 'Carlos Souza',
    phone: '+55 21 97777-9988',
    status: 'Contrato ativo',
    origin: 'Indicação',
    assignedTo: 'Marina',
    leadId: 'LD-4777',
    contractOperadora: 'Bradesco',
    commissionHighlight: 'Pagas',
    lastMessage: 'Contrato renovado e comissão confirmada.',
    unread: 0,
    timeline: [
      {
        id: 'msg-05',
        author: 'Marina · KS',
        message: 'Contrato renovado! Vou registrar na área de Comissões.',
        timestamp: 'Ontem',
        type: 'outgoing',
      },
      {
        id: 'msg-06',
        author: 'Carlos',
        message: 'Obrigado pelo suporte rápido.',
        timestamp: 'Ontem',
        type: 'incoming',
      },
    ] as ChatTimelineItem[],
  },
];

const statusColor: Record<string, string> = {
  'Lead quente': 'text-amber-700 bg-amber-50 ring-amber-100',
  'Contrato ativo': 'text-emerald-700 bg-emerald-50 ring-emerald-100',
};

const IntegrationCard = ({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  tone = 'slate',
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon: LucideIcon;
  tone?: 'slate' | 'emerald' | 'orange';
}) => {
  const toneMap: Record<'slate' | 'emerald' | 'orange', string> = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
  } as const;

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-4 ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </div>
      <button
        onClick={onAction}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-orange-700"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default function WhatsAppTab({ onNavigateToTab }: WhatsAppTabProps) {
  const [selectedChatId, setSelectedChatId] = useState(chatThreads[0]?.id ?? '');
  const [showListOnMobile, setShowListOnMobile] = useState(true);

  const selectedChat = useMemo(
    () => chatThreads.find((chat) => chat.id === selectedChatId) ?? chatThreads[0],
    [selectedChatId],
  );

  const getStatusClass = (status?: string) => statusColor[status ?? ''] ?? 'text-slate-700 bg-slate-50 ring-slate-100';

  const handleNavigate = (tab: string, options?: TabNavigationOptions) => {
    onNavigateToTab?.(tab, options);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">Comunicações</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">WhatsApp · Inbox da equipe</h1>
            <p className="mt-1 text-sm text-slate-600">
              Visual leve inspirado no WhatsApp Web, pensado para mobile primeiro. Navegue pelas conversas e acione Leads, Contratos, Lembretes e Comissões sem sair da aba.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleNavigate('leads', { leadsStatusFilter: ['novo', 'contato'] })}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:border-orange-300"
            >
              <UserCheck className="h-4 w-4" />
              Novo lead
            </button>
            <button
              onClick={() => handleNavigate('reminders')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              <Clock className="h-4 w-4" />
              Agendar follow-up
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col md:flex-row md:h-[75vh]">
          <div
            className={`md:w-[320px] md:border-r md:border-slate-200 ${
              showListOnMobile ? 'block' : 'hidden'
            } md:block`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversas</p>
                <h2 className="text-lg font-semibold text-slate-900">Inbox</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-700">
                  <Link2 className="h-3.5 w-3.5" />
                  Conectar API
                </button>
                <button
                  className="rounded-full p-2 text-slate-500 md:hidden"
                  aria-label="Fechar lista"
                  onClick={() => setShowListOnMobile(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">
                <Search className="h-4 w-4" />
                <input
                  type="text"
                  placeholder="Procurar contato ou número"
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto px-3 pb-4 md:max-h-[calc(75vh-116px)]">
              {chatThreads.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setShowListOnMobile(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    selectedChat?.id === chat.id ? 'bg-orange-50 border border-orange-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{chat.name}</p>
                        <p className="text-[11px] text-slate-500">{chat.phone}</p>
                      </div>
                      {chat.unread > 0 && (
                        <span className="inline-flex h-6 items-center justify-center rounded-full bg-orange-500 px-2 text-[11px] font-semibold text-white">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-600">{chat.lastMessage}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ring-1 ${getStatusClass(chat.status)}`}>
                        <Phone className="h-3.5 w-3.5" />
                        {chat.status}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {chat.assignedTo}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {chat.origin}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 border-t border-slate-200 md:border-t-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full p-2 text-slate-500 md:hidden"
                    aria-label="Abrir lista"
                    onClick={() => setShowListOnMobile(true)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversa</p>
                    <h2 className="text-lg font-bold text-slate-900">{selectedChat?.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ring-1 ${getStatusClass(selectedChat?.status)}`}>
                        {selectedChat?.status}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        Lead #{selectedChat?.leadId}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {selectedChat?.contractOperadora} · {selectedChat?.commissionHighlight}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex flex-wrap gap-2">
                  <button
                    onClick={() => handleNavigate('contracts', { contractOperadoraFilter: selectedChat?.contractOperadora })}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
                  >
                    <StickyNote className="h-4 w-4" />
                    Ver contrato
                  </button>
                  <button
                    onClick={() => handleNavigate('financeiro-comissoes')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Ver comissões
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-50">
                <div className="flex h-full flex-col gap-4 px-3 py-4 md:px-6">
                  <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white/80 p-3 md:p-4">
                    {selectedChat?.timeline.map((item) => (
                      <div key={item.id} className="flex flex-col gap-1 text-sm">
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[75%] ${
                            item.type === 'incoming'
                              ? 'self-start bg-white text-slate-800 ring-1 ring-slate-100'
                              : item.type === 'note'
                                ? 'self-center bg-amber-50 text-amber-900 ring-1 ring-amber-100'
                                : 'self-end bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">{item.author}</span>
                            <span>{item.timestamp}</span>
                          </div>
                          <p className="mt-1 leading-relaxed">{item.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                      <Send className="h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Responder no WhatsApp conectado"
                        className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleNavigate('leads', { leadIdFilter: selectedChat?.leadId })}
                        className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 ring-1 ring-orange-100 transition hover:bg-orange-100"
                      >
                        Lead
                      </button>
                      <button
                        onClick={() => handleNavigate('reminders')}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
                      >
                        Lembrete
                      </button>
                      <button
                        onClick={() => handleNavigate('contracts', { contractOperadoraFilter: selectedChat?.contractOperadora })}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
                      >
                        Contrato
                      </button>
                      <button
                        onClick={() => handleNavigate('financeiro-comissoes')}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Comissões
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <IntegrationCard
                      title="Lead e funil"
                      description="Atualize status e responsável em um clique."
                      actionLabel="Abrir Leads"
                      icon={UserCheck}
                      onAction={() => handleNavigate('leads', { leadIdFilter: selectedChat?.leadId })}
                      tone="orange"
                    />
                    <IntegrationCard
                      title="Lembretes e follow-ups"
                      description="Converta mensagens em tarefas e acompanhe SLA."
                      actionLabel="Abrir Lembretes"
                      icon={Clock}
                      onAction={() => handleNavigate('reminders')}
                      tone="slate"
                    />
                    <IntegrationCard
                      title="Comissões"
                      description="Valide pagamentos ligados ao contrato."
                      actionLabel="Ir para Comissões"
                      icon={StickyNote}
                      onAction={() => handleNavigate('financeiro-comissoes')}
                      tone="emerald"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
