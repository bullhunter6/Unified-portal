// Test Suite for AI Assistant Memory System
// Run with: npx tsx scripts/test-memory.ts

import { ConversationMemory, buildMemoryAwareContext } from '../apps/web/src/lib/ai/memory';
import type { Message } from '../apps/web/src/lib/ai/types';

// Color output for terminal
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
};

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(colors.green('✓'), message);
  } else {
    console.log(colors.red('✗'), message);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log(colors.blue('\n🧪 Testing AI Assistant Memory System\n'));

// ============================================================
// TEST 1: Entity Extraction
// ============================================================
console.log(colors.yellow('Test 1: Entity Extraction'));

const testMessages1: Message[] = [
  {
    role: 'user',
    content: 'Who is Uzbekneftegaz?',
    timestamp: Date.now(),
  },
  {
    role: 'assistant',
    content: 'Uzbekneftegaz is the national oil and gas company of Uzbekistan, founded in 1992. It operates 15 fields across the country.',
    timestamp: Date.now() + 1000,
  },
];

const memory1 = new ConversationMemory(testMessages1);
const stats1 = memory1.getStats();

assert(stats1.entitiesTracked > 0, 'Should extract entities');
assert(stats1.factsStored > 0, 'Should extract facts (founded in 1992, operates 15 fields)');
console.log('  Entities tracked:', stats1.entitiesTracked);
console.log('  Facts stored:', stats1.factsStored);

// ============================================================
// TEST 2: Follow-up Question Detection
// ============================================================
console.log(colors.yellow('\nTest 2: Follow-up Question Detection'));

const memory2 = new ConversationMemory([
  { role: 'user', content: 'What is credit rating?', timestamp: Date.now() },
  { role: 'assistant', content: 'A credit rating is...', timestamp: Date.now() + 1000 },
]);

const followUpQueries = [
  'Can you elaborate?',
  'What about ESG ratings?',
  'Tell me more',
  'How about that?',
];

const newTopicQueries = [
  'What is the capital of France?',
  'Explain quantum mechanics',
];

followUpQueries.forEach(query => {
  const context = memory2.getRelevantContext(query, 4);
  assert(
    context.messages.length > 0,
    `"${query}" should be detected as follow-up`
  );
});

newTopicQueries.forEach(query => {
  const context = memory2.getRelevantContext(query, 4);
  // New topics might still get context, but check they're processed
  console.log(`  "${query}" retrieved ${context.messages.length} messages`);
});

// ============================================================
// TEST 3: Semantic Relevance Scoring
// ============================================================
console.log(colors.yellow('\nTest 3: Semantic Relevance Scoring'));

const testMessages3: Message[] = [
  {
    role: 'user',
    content: 'Explain credit ratings and how they work',
    timestamp: Date.now() - 5000,
  },
  {
    role: 'assistant',
    content: 'Credit ratings are assessments of creditworthiness by agencies like Fitch, S&P, and Moody\'s. They range from AAA to D.',
    timestamp: Date.now() - 4000,
  },
  {
    role: 'user',
    content: 'What about ESG initiatives?',
    timestamp: Date.now() - 3000,
  },
  {
    role: 'assistant',
    content: 'ESG stands for Environmental, Social, and Governance. Companies are increasingly focusing on sustainability.',
    timestamp: Date.now() - 2000,
  },
  {
    role: 'user',
    content: 'Tell me about corporate bonds',
    timestamp: Date.now() - 1000,
  },
  {
    role: 'assistant',
    content: 'Corporate bonds are debt securities issued by companies. They typically have credit ratings.',
    timestamp: Date.now(),
  },
];

const memory3 = new ConversationMemory(testMessages3);

// Query about credit ratings (should retrieve messages 0, 1, 5 - related by topic)
const context3a = memory3.getRelevantContext('How are credit ratings calculated?', 4);
console.log('  Query "How are credit ratings calculated?" retrieved:');
console.log('    Messages:', context3a.messages.length);
console.log('    Entities:', context3a.entities.length);
console.log('    Facts:', context3a.facts.length);

assert(
  context3a.messages.length > 0,
  'Should retrieve relevant messages for credit rating query'
);

// Query about ESG (should retrieve messages 2, 3)
const context3b = memory3.getRelevantContext('What ESG metrics matter most?', 4);
console.log('  Query "What ESG metrics matter most?" retrieved:');
console.log('    Messages:', context3b.messages.length);

assert(
  context3b.messages.length > 0,
  'Should retrieve relevant messages for ESG query'
);

// ============================================================
// TEST 4: Context Summary Generation
// ============================================================
console.log(colors.yellow('\nTest 4: Context Summary Generation'));

const memory4 = new ConversationMemory(testMessages3);
const context4 = memory4.getRelevantContext('What about corporate bonds?', 6);

assert(
  context4.summary.length > 0,
  'Should generate context summary'
);

console.log('  Summary preview:');
console.log('  ', context4.summary.split('\n')[0]);

assert(
  context4.summary.includes('**') || context4.summary.includes('•'),
  'Summary should be formatted with markdown'
);

// ============================================================
// TEST 5: Memory Pruning
// ============================================================
console.log(colors.yellow('\nTest 5: Memory Pruning'));

const manyMessages: Message[] = Array.from({ length: 30 }, (_, i) => ({
  role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
  content: `Message ${i + 1}`,
  timestamp: Date.now() + i * 1000,
}));

const memory5 = new ConversationMemory(manyMessages);
const statsBefore = memory5.getStats();

console.log('  Before pruning:', statsBefore.totalMessages, 'messages');

memory5.pruneOldMemory(10);
const statsAfter = memory5.getStats();

console.log('  After pruning:', statsAfter.totalMessages, 'messages');

assert(
  statsAfter.totalMessages === 10,
  'Should keep only 10 recent messages after pruning'
);

// ============================================================
// TEST 6: buildMemoryAwareContext Helper
// ============================================================
console.log(colors.yellow('\nTest 6: buildMemoryAwareContext Helper'));

const result6 = buildMemoryAwareContext(
  testMessages3,
  'How do credit ratings work?',
  6
);

assert(
  result6.systemContext.length > 0,
  'Should generate system context'
);

assert(
  result6.relevantMessages.length > 0,
  'Should return relevant messages'
);

assert(
  result6.stats.totalMessages === testMessages3.length,
  'Should return correct stats'
);

console.log('  System context length:', result6.systemContext.length, 'chars');
console.log('  Relevant messages:', result6.relevantMessages.length);
console.log('  Total messages in memory:', result6.stats.totalMessages);

// ============================================================
// TEST 7: Empty Conversation Handling
// ============================================================
console.log(colors.yellow('\nTest 7: Empty Conversation Handling'));

const memory7 = new ConversationMemory([]);
const stats7 = memory7.getStats();

assert(
  stats7.totalMessages === 0,
  'Should handle empty conversation gracefully'
);

const context7 = memory7.getRelevantContext('Any question?', 5);

assert(
  context7.messages.length === 0,
  'Should return empty context for empty conversation'
);

assert(
  context7.summary.length === 0,
  'Should return empty summary for empty conversation'
);

// ============================================================
// TEST 8: Real-world Scenario - Follow-up with Entity
// ============================================================
console.log(colors.yellow('\nTest 8: Real-world Follow-up Scenario'));

const realConversation: Message[] = [
  {
    role: 'user',
    content: 'Who is Uzbekneftegaz?',
    timestamp: Date.now() - 4000,
  },
  {
    role: 'assistant',
    content: 'Uzbekneftegaz is the national oil and gas company of Uzbekistan, founded in 1992. It operates 15 fields and employs over 35,000 workers.',
    timestamp: Date.now() - 3000,
  },
  {
    role: 'user',
    content: 'What are their ESG initiatives?',
    timestamp: Date.now() - 2000,
  },
  {
    role: 'assistant',
    content: 'Uzbekneftegaz has committed to reducing methane emissions by 30% by 2030 and is investing in renewable energy projects.',
    timestamp: Date.now() - 1000,
  },
  {
    role: 'user',
    content: 'How does that compare to industry standards?',
    timestamp: Date.now(),
  },
];

const realMemory = new ConversationMemory(realConversation);
const realContext = realMemory.getRelevantContext(
  'How does that compare to industry standards?',
  6
);

console.log('  Last query is follow-up asking for comparison');
console.log('  Memory retrieved', realContext.messages.length, 'relevant messages');
console.log('  Entities tracked:', realContext.entities);

assert(
  realContext.messages.length >= 2,
  'Should retrieve at least recent exchanges for context'
);

assert(
  realContext.entities.some(e => e.includes('Uzbekneftegaz')),
  'Should track the main entity being discussed'
);

// ============================================================
// ALL TESTS PASSED
// ============================================================
console.log(colors.green('\n✓ All tests passed! 🎉\n'));
console.log('Memory system is working correctly.');
console.log('\nKey Features Verified:');
console.log('  ✓ Entity extraction from conversations');
console.log('  ✓ Fact extraction (numbers, dates, metrics)');
console.log('  ✓ Follow-up question detection');
console.log('  ✓ Semantic relevance scoring');
console.log('  ✓ Context summary generation');
console.log('  ✓ Memory pruning for efficiency');
console.log('  ✓ Empty conversation handling');
console.log('  ✓ Real-world follow-up scenarios\n');
