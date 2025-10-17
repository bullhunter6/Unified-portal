/**
 * Database helper functions for Article Assistant
 * Handles conversations, messages, and tool calls in the ESG database
 * 
 * @server-only
 */

import "server-only";
import { getPrisma } from "./db";
import { v4 as uuidv4 } from "uuid";

export interface ArticleConversation {
  id: number;
  session_id: string;
  user_id: number | null;
  article_id: number;
  article_source: "esg" | "credit";
  article_summary: string | null;
  summary_generated_at: Date | null;
  summary_tokens: number;
  conversation_title: string | null;
  total_messages: number;
  total_tokens_used: number;
  total_cost_usd: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date | null;
}

export interface ArticleMessage {
  id: number;
  conversation_id: number;
  message_index: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata: any | null;
  tokens_used: number;
  created_at: Date;
}

export interface ArticleToolCall {
  id: number;
  conversation_id: number;
  message_id: number | null;
  tool_name: string;
  tool_input: any;
  tool_output: any | null;
  status: "success" | "error" | "pending";
  error_message: string | null;
  tokens_used: number;
  execution_time_ms: number | null;
  created_at: Date;
}

/**
 * Get or create a conversation for a specific article
 * Note: Always uses ESG database for agent tables, regardless of article domain
 */
export async function getOrCreateConversation(
  domain: "esg" | "credit",
  articleId: number,
  userId: number | null = null
): Promise<ArticleConversation> {
  // Always use ESG database for agent tables
  const prisma = getPrisma("esg");

  // Try to find existing conversation
  let existing: ArticleConversation[];
  
  if (userId) {
    existing = await prisma.$queryRaw<ArticleConversation[]>`
      SELECT * FROM article_conversations
      WHERE user_id = ${userId}
        AND article_id = ${articleId}
        AND article_source = ${domain}
      LIMIT 1
    `;
  } else {
    existing = await prisma.$queryRaw<ArticleConversation[]>`
      SELECT * FROM article_conversations
      WHERE user_id IS NULL
        AND article_id = ${articleId}
        AND article_source = ${domain}
      LIMIT 1
    `;
  }

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Create new conversation with ON CONFLICT handling
  const sessionId = uuidv4();
  
  try {
    const result = await prisma.$queryRaw<ArticleConversation[]>`
      INSERT INTO article_conversations (
        session_id,
        user_id,
        article_id,
        article_source,
        status
      ) VALUES (
        ${sessionId},
        ${userId},
        ${articleId},
        ${domain},
        'active'
      )
      ON CONFLICT (user_id, article_id, article_source) 
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    // If still fails, try to fetch again (race condition)
    let fallback: ArticleConversation[];
    
    if (userId) {
      fallback = await prisma.$queryRaw<ArticleConversation[]>`
        SELECT * FROM article_conversations
        WHERE user_id = ${userId}
          AND article_id = ${articleId}
          AND article_source = ${domain}
        LIMIT 1
      `;
    } else {
      fallback = await prisma.$queryRaw<ArticleConversation[]>`
        SELECT * FROM article_conversations
        WHERE user_id IS NULL
          AND article_id = ${articleId}
          AND article_source = ${domain}
        LIMIT 1
      `;
    }
    
    if (fallback && fallback.length > 0) {
      return fallback[0];
    }
    
    throw error;
  }
}

/**
 * Get conversation by session ID
 * Note: Always uses ESG database for agent tables
 */
export async function getConversationBySessionId(
  domain: "esg" | "credit",
  sessionId: string
): Promise<ArticleConversation | null> {
  const prisma = getPrisma("esg");

  const result = await prisma.$queryRaw<ArticleConversation[]>`
    SELECT * FROM article_conversations
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Update conversation summary (cache it)
 * Note: Always uses ESG database for agent tables
 */
export async function updateConversationSummary(
  domain: "esg" | "credit",
  conversationId: number,
  summary: string,
  tokens: number
): Promise<void> {
  const prisma = getPrisma("esg");

  await prisma.$executeRaw`
    UPDATE article_conversations
    SET 
      article_summary = ${summary},
      summary_generated_at = CURRENT_TIMESTAMP,
      summary_tokens = ${tokens}
    WHERE id = ${conversationId}
  `;
}

/**
 * Get all messages for a conversation
 * Note: Always uses ESG database for agent tables
 */
export async function getConversationMessages(
  domain: "esg" | "credit",
  conversationId: number,
  limit: number = 50
): Promise<ArticleMessage[]> {
  const prisma = getPrisma("esg");

  const messages = await prisma.$queryRaw<ArticleMessage[]>`
    SELECT * FROM article_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY message_index ASC
    LIMIT ${limit}
  `;

  return messages;
}

/**
 * Add a message to the conversation
 * Note: Always uses ESG database for agent tables
 */
export async function addMessage(
  domain: "esg" | "credit",
  conversationId: number,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  tokens: number = 0,
  metadata: any = null
): Promise<ArticleMessage> {
  const prisma = getPrisma("esg");

  // Get the next message index
  const indexResult = await prisma.$queryRaw<{ max_index: number | null }[]>`
    SELECT COALESCE(MAX(message_index), -1) as max_index
    FROM article_messages
    WHERE conversation_id = ${conversationId}
  `;

  const nextIndex = (indexResult[0]?.max_index ?? -1) + 1;

  // Insert the message (trigger will auto-update conversation stats)
  const result = await prisma.$queryRaw<ArticleMessage[]>`
    INSERT INTO article_messages (
      conversation_id,
      message_index,
      role,
      content,
      tokens_used,
      metadata
    ) VALUES (
      ${conversationId},
      ${nextIndex},
      ${role},
      ${content},
      ${tokens},
      ${metadata ? JSON.stringify(metadata) : null}::jsonb
    )
    RETURNING *
  `;

  return result[0];
}

/**
 * Record a tool call
 * Note: Always uses ESG database for agent tables
 */
export async function recordToolCall(
  domain: "esg" | "credit",
  conversationId: number,
  toolName: string,
  toolInput: any,
  toolOutput: any | null,
  status: "success" | "error" | "pending",
  executionTimeMs: number | null = null,
  errorMessage: string | null = null
): Promise<ArticleToolCall> {
  const prisma = getPrisma("esg");

  const result = await prisma.$queryRaw<ArticleToolCall[]>`
    INSERT INTO article_tool_calls (
      conversation_id,
      tool_name,
      tool_input,
      tool_output,
      status,
      error_message,
      execution_time_ms
    ) VALUES (
      ${conversationId},
      ${toolName},
      ${JSON.stringify(toolInput)}::jsonb,
      ${toolOutput ? JSON.stringify(toolOutput) : null}::jsonb,
      ${status},
      ${errorMessage},
      ${executionTimeMs}
    )
    RETURNING *
  `;

  return result[0];
}

/**
 * Update conversation cost
 * Note: Always uses ESG database for agent tables
 */
export async function updateConversationCost(
  domain: "esg" | "credit",
  conversationId: number,
  additionalTokens: number,
  additionalCostUsd: number
): Promise<void> {
  const prisma = getPrisma("esg");

  await prisma.$executeRaw`
    UPDATE article_conversations
    SET 
      total_tokens_used = total_tokens_used + ${additionalTokens},
      total_cost_usd = total_cost_usd + ${additionalCostUsd}
    WHERE id = ${conversationId}
  `;
}

/**
 * Get conversation history formatted for LangGraph
 */
export async function getConversationHistory(
  domain: "esg" | "credit",
  conversationId: number,
  maxMessages: number = 20
): Promise<{ role: string; content: string }[]> {
  const messages = await getConversationMessages(domain, conversationId, maxMessages);

  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Check if summary exists and is recent (within 24 hours)
 */
export async function hasFreshSummary(
  conversation: ArticleConversation
): Promise<boolean> {
  if (!conversation.article_summary || !conversation.summary_generated_at) {
    return false;
  }

  // Summary is considered fresh if less than 24 hours old
  const hoursSinceGeneration =
    (Date.now() - new Date(conversation.summary_generated_at).getTime()) /
    (1000 * 60 * 60);

  return hoursSinceGeneration < 24;
}
