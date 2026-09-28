import { useInboxMessageStatusRefresh } from './useInboxMessageStatusRefresh';
import { useInboxPolling } from './useInboxPolling';
import { useInboxSelectedChatPreviewRefresh } from './useInboxSelectedChatPreviewRefresh';

type InboxPollingOptions = Parameters<typeof useInboxPolling>[0];

export type InboxPollingControllerOptions = {
  realtimeRefs: Pick<InboxPollingOptions, 'isChannelConnectedRef' | 'isMessageRealtimeHealthyRef'>;
  polling: Omit<InboxPollingOptions, 'isChannelConnectedRef' | 'isMessageRealtimeHealthyRef'>;
  selectedChatPreviewRefresh: Parameters<typeof useInboxSelectedChatPreviewRefresh>[0];
  messageStatusRefresh: Parameters<typeof useInboxMessageStatusRefresh>[0];
};

export const useInboxPollingController = ({
  realtimeRefs,
  polling,
  selectedChatPreviewRefresh,
  messageStatusRefresh,
}: InboxPollingControllerOptions) => {
  useInboxPolling({ ...polling, ...realtimeRefs });
  useInboxSelectedChatPreviewRefresh(selectedChatPreviewRefresh);

  const { scheduleMessageStatusRefresh } = useInboxMessageStatusRefresh(messageStatusRefresh);

  return { scheduleMessageStatusRefresh };
};
