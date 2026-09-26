/**
 * A cached conversation is immediately usable while its background refresh
 * runs. Without cached messages, the initial request needs the blocking loader.
 */
export const shouldShowBlockingMessageLoader = (hasCachedMessages: boolean) => !hasCachedMessages;
