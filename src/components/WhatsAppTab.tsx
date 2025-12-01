import { useMemo, useState } from 'react';
import { MessageSquare, Phone, Send } from 'lucide-react';
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

type ChatThread = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  unread: number;
  timeline: ChatTimelineItem[];
};

const chatThreads: ChatThread[] = [
  {
    id: 'chat-01',
    name: 'Joana Menezes',
    phone: '+55 11 98888-1122',
    unread: 2,
    lastMessage: 'Enviei a proposta atualizada com as coberturas.',
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
    ],
  },
  {
    id: 'chat-02',
    name: 'Carlos Souza',
    phone: '+55 21 97777-9988',
    unread: 0,
    lastMessage: 'Contrato renovado e comissão confirmada.',
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
    ],
  },
  {
    id: 'chat-03',
    name: 'Patrícia Lima',
    phone: '+55 31 96666-3311',
    unread: 1,
    lastMessage: 'Preciso revisar as coberturas antes de assinar.',
    timeline: [
      {
        id: 'msg-07',
        author: 'Patrícia',
        message: 'Oi! Consegue me enviar novamente a proposta sem coparticipação?',
        timestamp: '08:44',
        type: 'incoming',
      },
      {
        id: 'msg-08',
        author: 'Marina · KS',
        message: 'Claro, acabei de ajustar e reenviar para o seu e-mail.',
        timestamp: '08:47',
        type: 'outgoing',
      },
    ],
  },
];

const bubbleTone: Record<ChatTimelineItem['type'], string> = {
  incoming: 'bg-white text-slate-800 border border-slate-100',
  outgoing: 'bg-orange-50 text-slate-800 border border-orange-100',
  note: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export default function WhatsAppTab({ onNavigateToTab }: WhatsAppTabProps) {
  const [selectedChatId, setSelectedChatId] = useState(chatThreads[0]?.id ?? '');

  const selectedChat = useMemo(
    () => chatThreads.find((chat) => chat.id === selectedChatId) ?? chatThreads[0],
    [selectedChatId],
  );

  const handleNavigate = (tab: string, options?: TabNavigationOptions) => {
    onNavigateToTab?.(tab, options);
  };

  return (
    <div className="h-[calc(100vh-8rem)] rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-full flex-col overflow-hidden lg:flex-row">
        <div className="w-full max-w-md border-b border-slate-200 bg-slate-50/80 p-4 lg:h-full lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversas</p>
              <h2 className="text-lg font-bold text-slate-900">Inbox de WhatsApp</h2>
            </div>
            <button
              onClick={() => handleNavigate('leads', { leadsStatusFilter: ['novo', 'contato'] })}
              className="hidden items-center gap-2 rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 lg:inline-flex"
            >
              <Phone className="h-3.5 w-3.5" />
              Vincular lead
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {chatThreads.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={`flex w-full flex-col gap-1 rounded-2xl border px-3 py-2 text-left transition ${
                  selectedChat?.id === chat.id
                    ? 'border-orange-200 bg-orange-50 shadow-sm'
                    : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{chat.name}</p>
                      <p className="text-xs text-slate-500">{chat.phone}</p>
                    </div>
                  </div>
                  {chat.unread > 0 && (
                    <span className="inline-flex h-6 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-semibold text-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-slate-600">{chat.lastMessage}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 lg:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversa selecionada</p>
              <h3 className="text-xl font-bold text-slate-900">{selectedChat?.name}</h3>
              <p className="text-sm text-slate-500">{selectedChat?.phone}</p>
            </div>
            <button
              onClick={() => handleNavigate('reminders')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
            >
              Registrar follow-up
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 lg:p-6">
            {selectedChat?.timeline.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xl rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    item.type === 'outgoing' ? 'rounded-br-sm' : item.type === 'incoming' ? 'rounded-bl-sm' : 'rounded-xl'
                  } ${bubbleTone[item.type]}`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{item.author}</span>
                    <span>{item.timestamp}</span>
                  </div>
                  <p className="mt-1 text-slate-800">{item.message}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-white p-4 lg:p-6">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Send className="h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Responder no WhatsApp conectado"
                className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700">
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
