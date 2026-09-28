import { useCallback, useRef } from 'react';

export const useInboxOptimisticMessageTimestamps = () => {
  const lastTimestampByChatIdRef = useRef<Map<string, number>>(new Map());

  const allocateOptimisticMessageTimestamps = useCallback((chatId: string, count: number) => {
    const safeCount = Math.max(0, count);
    const previousTimestamp = lastTimestampByChatIdRef.current.get(chatId) ?? 0;
    const firstTimestamp = Math.max(Date.now(), previousTimestamp + 1);
    lastTimestampByChatIdRef.current.set(chatId, firstTimestamp + safeCount - 1);

    return Array.from({ length: safeCount }, (_, index) => new Date(firstTimestamp + index).toISOString());
  }, []);

  return { allocateOptimisticMessageTimestamps };
};
