export type * from './domain/types';
export { normalizeFlowMessageVariations, hasIncompleteMessageVariations } from './automation/domain/messageVariations';
export type { FlowMessageVariation } from './automation/domain/messageVariations';
export { configService, type ConfigCategory } from './data/configService';
export { default as ApiDocsScreen } from './integrations/api-docs/ApiDocsScreen';
export { getConfigAreaForTab, hasConfigAreaAccess } from './shared/configTabs';
