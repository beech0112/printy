/**
 * Barrel export for shared chat hooks
 */
export {
  useConversationState,
  default as ConversationState,
} from './useConversationState';
export type { ConversationItem } from './useConversationState';
export {
  useConversationSwitcher,
  default as ConversationSwitcher,
} from './useConversationSwitcher';
export {
  useChatAttachments,
  default as ChatAttachments,
} from './useChatAttachments';
export { useChatPipeline } from './useChatPipeline';
export type { UseChatPipelineOptions, UseChatPipelineResult, QuoteDraft, CustomerType } from './useChatPipeline';
