import { useCallback, useState } from 'react';

import { configService } from '../../../config';
import { whatsappMessagesRepository } from '../data';
import { buildTranscriptLine, normalizeSystemTimeZone } from '../domain/messageTranscript';
import { toast } from '../../../../lib/toast';

type InboxTranscriptExportOptions = {
  chatId: string | null;
  leadLabel: string;
};

export const useInboxTranscriptExport = ({ chatId, leadLabel }: InboxTranscriptExportOptions) => {
  const [copyingTranscript, setCopyingTranscript] = useState(false);

  const handleCopyChatTranscript = useCallback(async () => {
    if (!chatId || copyingTranscript) {
      return;
    }

    setCopyingTranscript(true);

    try {
      const [allMessages, systemSettings] = await Promise.all([
        whatsappMessagesRepository.listAll(chatId),
        configService.getSystemSettings(),
      ]);

      const timeZone = normalizeSystemTimeZone(systemSettings?.timezone);
      const transcript = allMessages
        .map((message) => buildTranscriptLine(message, leadLabel, timeZone))
        .filter((line): line is string => Boolean(line))
        .join('\n');

      if (!transcript) {
        toast.error('Não há histórico útil suficiente para copiar.');
        return;
      }

      await navigator.clipboard.writeText(transcript);
      toast.success('Conversa copiada no formato do follow-up.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao copiar conversa formatada', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível copiar a conversa.');
    } finally {
      setCopyingTranscript(false);
    }
  }, [chatId, copyingTranscript, leadLabel]);

  return { copyingTranscript, handleCopyChatTranscript };
};
