-- ============================================================================
-- Article Assistant Tables for ESG Database
-- Purpose: Store AI conversations, messages, and tool calls for article chat
-- Created: 2025-10-16
-- ============================================================================

-- Table 1: article_conversations
-- Stores one conversation per user per article with cached summary
CREATE TABLE article_conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL,
    article_source VARCHAR(20) NOT NULL, -- 'esg' or 'credit'
    
    -- Cached AI-generated summary (to avoid regeneration)
    article_summary TEXT,
    summary_generated_at TIMESTAMP(6),
    summary_tokens INTEGER DEFAULT 0,
    
    -- Conversation metadata
    conversation_title VARCHAR(255),
    total_messages INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) DEFAULT 0,
    
    -- Status and timestamps
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'deleted'
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP(6),
    
    -- Constraints
    CONSTRAINT unique_user_article_conversation UNIQUE (user_id, article_id, article_source)
);

-- Indexes for article_conversations
CREATE INDEX idx_article_conversations_session_id ON article_conversations(session_id);
CREATE INDEX idx_article_conversations_user_id_last_message ON article_conversations(user_id, last_message_at DESC);
CREATE INDEX idx_article_conversations_article ON article_conversations(article_id, article_source);

-- Comments for article_conversations
COMMENT ON TABLE article_conversations IS 'Stores article chat conversations with cached summaries';
COMMENT ON COLUMN article_conversations.article_summary IS 'Cached AI-generated summary to avoid regeneration';
COMMENT ON COLUMN article_conversations.article_source IS 'Either esg or credit to identify article source';
COMMENT ON COLUMN article_conversations.session_id IS 'Unique session identifier for the conversation';


-- Table 2: article_messages
-- Stores individual messages in each conversation
CREATE TABLE article_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES article_conversations(id) ON DELETE CASCADE,
    message_index INTEGER NOT NULL, -- Order in conversation (0, 1, 2, ...)
    
    -- Message content
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,
    
    -- Metadata
    metadata JSONB, -- Extra data like model used, temperature, etc.
    tokens_used INTEGER DEFAULT 0,
    
    -- Timestamp
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for article_messages
CREATE INDEX idx_article_messages_conversation_index ON article_messages(conversation_id, message_index);
CREATE INDEX idx_article_messages_conversation_created ON article_messages(conversation_id, created_at);

-- Comments for article_messages
COMMENT ON TABLE article_messages IS 'Individual messages in article chat conversations';
COMMENT ON COLUMN article_messages.message_index IS 'Sequential index for message ordering in conversation';
COMMENT ON COLUMN article_messages.role IS 'Message role: user, assistant, system, or tool';
COMMENT ON COLUMN article_messages.metadata IS 'JSON metadata including model info, parameters, etc.';


-- Table 3: article_tool_calls
-- Tracks tool usage like web search
CREATE TABLE article_tool_calls (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES article_conversations(id) ON DELETE CASCADE,
    message_id INTEGER, -- Optional link to specific message
    
    -- Tool information
    tool_name VARCHAR(100) NOT NULL, -- 'web_search', 'article_lookup', etc.
    tool_input JSONB NOT NULL, -- Parameters passed to tool
    tool_output JSONB, -- Result from tool
    
    -- Execution details
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'pending'
    error_message TEXT,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER, -- How long the tool took to execute
    
    -- Timestamp
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for article_tool_calls
CREATE INDEX idx_article_tool_calls_conversation ON article_tool_calls(conversation_id, created_at);
CREATE INDEX idx_article_tool_calls_tool_name ON article_tool_calls(tool_name);

-- Comments for article_tool_calls
COMMENT ON TABLE article_tool_calls IS 'Tracks tool/function calls during article conversations';
COMMENT ON COLUMN article_tool_calls.tool_name IS 'Name of the tool called (e.g., web_search)';
COMMENT ON COLUMN article_tool_calls.execution_time_ms IS 'Tool execution time in milliseconds';


-- ============================================================================
-- Optional: Trigger to auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_article_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_article_conversation_updated_at
    BEFORE UPDATE ON article_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_article_conversation_updated_at();


-- ============================================================================
-- Optional: Function to increment message count
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE article_conversations
    SET 
        total_messages = total_messages + 1,
        last_message_at = NEW.created_at,
        total_tokens_used = total_tokens_used + COALESCE(NEW.tokens_used, 0)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_message_count
    AFTER INSERT ON article_messages
    FOR EACH ROW
    EXECUTE FUNCTION increment_conversation_message_count();


-- ============================================================================
-- Verification Queries (Run these to verify tables were created)
-- ============================================================================

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('article_conversations', 'article_messages', 'article_tool_calls')
ORDER BY table_name;

-- Check indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('article_conversations', 'article_messages', 'article_tool_calls')
ORDER BY tablename, indexname;

-- Check constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('article_conversations', 'article_messages', 'article_tool_calls')
ORDER BY tc.table_name, tc.constraint_type;


-- ============================================================================
-- Sample Data for Testing (Optional)
-- ============================================================================

-- Insert a test conversation
-- INSERT INTO article_conversations (
--     session_id, 
--     user_id, 
--     article_id, 
--     article_source,
--     article_summary,
--     conversation_title
-- ) VALUES (
--     'test-session-123',
--     1, -- Replace with actual user_id
--     101, -- Replace with actual article_id
--     'esg',
--     'This article discusses sustainable investment strategies...',
--     'Chat about ESG Investment Article'
-- );

-- Insert test messages
-- INSERT INTO article_messages (conversation_id, message_index, role, content, tokens_used)
-- VALUES 
--     (1, 0, 'system', 'You are an article assistant...', 50),
--     (1, 1, 'assistant', 'Here is the summary of the article...', 150),
--     (1, 2, 'user', 'What are the main points?', 20),
--     (1, 3, 'assistant', 'The main points are...', 100);

-- Insert test tool call
-- INSERT INTO article_tool_calls (
--     conversation_id,
--     tool_name,
--     tool_input,
--     tool_output,
--     status,
--     execution_time_ms
-- ) VALUES (
--     1,
--     'web_search',
--     '{"query": "ESG investment trends 2025"}'::jsonb,
--     '{"results": [{"title": "...", "url": "..."}]}'::jsonb,
--     'success',
--     1250
-- );


-- ============================================================================
-- Cleanup Queries (Use with caution!)
-- ============================================================================

-- Drop tables if you need to recreate them
-- DROP TABLE IF EXISTS article_tool_calls CASCADE;
-- DROP TABLE IF EXISTS article_messages CASCADE;
-- DROP TABLE IF EXISTS article_conversations CASCADE;
-- DROP FUNCTION IF EXISTS update_article_conversation_updated_at() CASCADE;
-- DROP FUNCTION IF EXISTS increment_conversation_message_count() CASCADE;
