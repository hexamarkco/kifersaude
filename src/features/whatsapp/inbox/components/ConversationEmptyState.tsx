import { MessageCircle } from 'lucide-react';

export function ConversationEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-slate-500">
      <MessageCircle className="mb-4 h-24 w-24 text-slate-300" />
      <h2 className="mb-2 text-2xl font-semibold">WhatsApp Web</h2>
      <p className="max-w-md text-center">
        Selecione uma conversa para comeÃ§ar a enviar e receber mensagens
      </p>
    </div>
  );
}
