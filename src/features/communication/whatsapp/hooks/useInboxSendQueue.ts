import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

type InboxSendQueueOptions = {
  setSendingByChatId: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export const useInboxSendQueue = ({ setSendingByChatId }: InboxSendQueueOptions) => {
  const sendQueueByChatIdRef = useRef<Map<string, Promise<void>>>(new Map());
  const activeSendOperationsByChatIdRef = useRef<Map<string, number>>(new Map());

  const beginSendOperation = useCallback((chatId: string) => {
    const activeOperations = activeSendOperationsByChatIdRef.current.get(chatId) ?? 0;
    activeSendOperationsByChatIdRef.current.set(chatId, activeOperations + 1);
    setSendingByChatId((current) => ({ ...current, [chatId]: true }));

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      const remainingOperations = Math.max(0, (activeSendOperationsByChatIdRef.current.get(chatId) ?? 1) - 1);
      if (remainingOperations > 0) {
        activeSendOperationsByChatIdRef.current.set(chatId, remainingOperations);
        return;
      }

      activeSendOperationsByChatIdRef.current.delete(chatId);
      setSendingByChatId((current) => {
        if (!current[chatId]) {
          return current;
        }

        const next = { ...current };
        delete next[chatId];
        return next;
      });
    };
  }, [setSendingByChatId]);

  const enqueueChatSend = useCallback((chatId: string, task: () => Promise<void>) => {
    const previous = sendQueueByChatIdRef.current.get(chatId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const release = beginSendOperation(chatId);
        try {
          await task();
        } finally {
          release();
        }
      });

    sendQueueByChatIdRef.current.set(chatId, next);
    void next
      .catch((error) => {
        console.error('[WhatsAppInbox] erro na fila de envio', error);
      })
      .finally(() => {
        if (sendQueueByChatIdRef.current.get(chatId) === next) {
          sendQueueByChatIdRef.current.delete(chatId);
        }
      });

    return next;
  }, [beginSendOperation]);

  return { enqueueChatSend };
};
