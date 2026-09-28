import { useEffect, useRef } from 'react';

import { useCommWhatsAppMessageRealtime } from './useCommWhatsAppMessageRealtime';
import { useInboxChannelSubscriptions } from './useInboxChannelSubscriptions';
import { useInboxRealtimeUpdates } from './useInboxRealtimeUpdates';

type InboxRealtimeUpdatesOptions = Parameters<typeof useInboxRealtimeUpdates>[0];

export type InboxRealtimeControllerOptions = {
  channelId: string | null;
  selectedChatId: string | null;
  channelConnected: boolean;
  updates: InboxRealtimeUpdatesOptions;
};

export const useInboxRealtimeController = ({
  channelId,
  selectedChatId,
  channelConnected,
  updates,
}: InboxRealtimeControllerOptions) => {
  const {
    applyRealtimeChatChange,
    applyRealtimePresenceChange,
    applyRealtimeMessageChange,
  } = useInboxRealtimeUpdates(updates);

  const { isRealtimeHealthy } = useCommWhatsAppMessageRealtime(selectedChatId, applyRealtimeMessageChange);

  useInboxChannelSubscriptions({
    channelId,
    onChatChange: applyRealtimeChatChange,
    onPresenceChange: applyRealtimePresenceChange,
  });

  const isChannelConnectedRef = useRef(channelConnected);
  useEffect(() => {
    isChannelConnectedRef.current = channelConnected;
  }, [channelConnected]);

  const isMessageRealtimeHealthyRef = useRef(isRealtimeHealthy);
  useEffect(() => {
    isMessageRealtimeHealthyRef.current = isRealtimeHealthy;
  }, [isRealtimeHealthy]);

  return { isChannelConnectedRef, isMessageRealtimeHealthyRef };
};
