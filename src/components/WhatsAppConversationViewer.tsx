import { useEffect, useRef } from 'react';
import { MessageCircle, CheckCheck } from 'lucide-react';
import { ZAPIMessage } from '../lib/zapiService';

interface WhatsAppConversationViewerProps {
  messages: ZAPIMessage[];
  leadName: string;
  isLoading?: boolean;
}

export default function WhatsAppConversationViewer({
  messages,
  leadName,
  isLoading = false,
}: WhatsAppConversationViewerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: ZAPIMessage[] }[] = [];
    let currentDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = formatDate(message.timestamp);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });

    return groups;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-b from-teal-50 to-white rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent mb-4"></div>
        <p className="text-slate-600">Carregando histórico de conversas...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-b from-slate-50 to-white rounded-lg border-2 border-dashed border-slate-300">
        <MessageCircle className="w-16 h-16 text-slate-400 mb-4" />
        <p className="text-lg font-medium text-slate-700 mb-2">Nenhuma conversa encontrada</p>
        <p className="text-sm text-slate-500">Não há histórico de mensagens com {leadName}</p>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="flex flex-col h-96 bg-gradient-to-b from-teal-50 to-white rounded-lg overflow-hidden border border-slate-200">
      <div className="bg-teal-600 text-white px-4 py-3 flex items-center space-x-3">
        <MessageCircle className="w-5 h-5" />
        <div>
          <p className="font-medium">{leadName}</p>
          <p className="text-xs text-teal-100">{messages.length} mensagens</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex}>
            <div className="flex justify-center mb-4">
              <span className="text-xs bg-white text-slate-600 px-3 py-1 rounded-full shadow-sm border border-slate-200">
                {group.date}
              </span>
            </div>

            {group.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-3`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
                    message.fromMe
                      ? 'bg-teal-500 text-white rounded-br-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  {message.mediaUrl && (
                    <div className="mb-2">
                      <img
                        src={message.mediaUrl}
                        alt="Mídia"
                        className="rounded-lg max-w-full h-auto"
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  <div
                    className={`flex items-center justify-end space-x-1 mt-1 text-xs ${
                      message.fromMe ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    <span>{formatTime(message.timestamp)}</span>
                    {message.fromMe && (
                      <CheckCheck className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
