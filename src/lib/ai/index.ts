export { chat } from './llm';
export type { LLMChatOptions, LLMChatResult, ChatMessage, LLMMessage } from './llm';

export { embed, embedBatch } from './embeddings';
export type { EmbeddingResult } from './embeddings';

export { getSystemPrompt, SERVICE_CATALOG } from './prompts';
export type { UserRole } from './prompts';

export { TOOLS, executeTool } from './tools';
export type { OllamaTool, ToolCall, ToolResult, ToolExecutionContext } from './tools';
