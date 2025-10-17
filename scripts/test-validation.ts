// Test Validation Logic
// Run with: npx tsx scripts/test-validation.ts

import { validateQuery } from '../apps/web/src/lib/ai/article-assistant';
import type { Article } from '../apps/web/src/lib/ai/types';

// Colors for output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
};

// Mock article about Uzbekistan-UK energy partnership
const mockArticle: Article = {
  id: 1,
  title: 'Uzbekneftegaz and UK Energy Sign Strategic Partnership for Green Energy',
  content: `Uzbekneftegaz, the national oil and gas company of Uzbekistan, announced a strategic partnership with UK Energy Partners during a summit in London. The partnership focuses on renewable energy development and ESG initiatives in Central Asia. 

The agreement includes a $500M investment in solar and wind projects across Uzbekistan. Laziz Kudratov, CEO of Uzbekneftegaz, stated the partnership aligns with Uzbekistan's 2030 carbon neutrality goals.

S&P Global Ratings affirmed Uzbekistan's BB- sovereign rating with a stable outlook, citing improved fiscal management and growing foreign investment in the energy sector.`,
  date: new Date('2024-10-15'),
  source: 'Reuters',
  matched_keywords: 'Energy, Partnership, ESG, Renewables',
  region: 'Central Asia',
  sector: 'Energy',
  summary: 'Strategic partnership between Uzbekneftegaz and UK Energy for renewable energy development',
};

console.log(colors.blue('\n🧪 Testing AI Assistant Validation\n'));
console.log('Article:', colors.yellow(mockArticle.title || 'Untitled'));
console.log('');

// Test cases
const testCases = [
  // SHOULD BE VALID
  { 
    query: 'Who is Uzbekneftegaz?', 
    expectedValid: true,
    category: 'Entity Question'
  },
  { 
    query: 'What was discussed in the London summit?', 
    expectedValid: true,
    category: 'Article Content'
  },
  { 
    query: 'What are the ESG initiatives mentioned?', 
    expectedValid: true,
    category: 'Article Topic'
  },
  { 
    query: 'How much investment was announced?', 
    expectedValid: true,
    category: 'Article Fact'
  },
  { 
    query: 'What does this mean for the energy sector?', 
    expectedValid: true,
    category: 'Analysis'
  },
  { 
    query: 'What is a credit rating?', 
    expectedValid: true,
    category: 'Domain Knowledge (Finance)'
  },
  { 
    query: 'Tell me about UK Energy Partners', 
    expectedValid: true,
    category: 'Entity Background'
  },
  { 
    query: 'What about renewable energy in Central Asia?', 
    expectedValid: true,
    category: 'Regional Context'
  },
  
  // SHOULD BE INVALID
  { 
    query: 'What is Python?', 
    expectedValid: false,
    category: 'Programming (Off-topic)'
  },
  { 
    query: 'How to install Node.js?', 
    expectedValid: false,
    category: 'Software Setup (Off-topic)'
  },
  { 
    query: 'Best pasta recipe?', 
    expectedValid: false,
    category: 'Cooking (Off-topic)'
  },
  { 
    query: 'Who won the World Cup?', 
    expectedValid: false,
    category: 'Sports (Off-topic)'
  },
  { 
    query: 'Latest Marvel movie?', 
    expectedValid: false,
    category: 'Entertainment (Off-topic)'
  },
  { 
    query: 'Weather in London today?', 
    expectedValid: false,
    category: 'Weather (Off-topic)'
  },
  { 
    query: 'How to cure a cold?', 
    expectedValid: false,
    category: 'Medical (Off-topic)'
  },
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  const failedTests: any[] = [];

  for (const testCase of testCases) {
    try {
      const result = await validateQuery(testCase.query, mockArticle, []);
      
      const success = result.isValid === testCase.expectedValid;
      
      if (success) {
        passed++;
        console.log(
          colors.green('✓'),
          `[${testCase.category}]`,
          `"${testCase.query}"`,
          colors.green(`→ ${result.isValid ? 'VALID' : 'INVALID'}`)
        );
      } else {
        failed++;
        console.log(
          colors.red('✗'),
          `[${testCase.category}]`,
          `"${testCase.query}"`,
          colors.red(`→ Expected ${testCase.expectedValid ? 'VALID' : 'INVALID'}, got ${result.isValid ? 'VALID' : 'INVALID'}`)
        );
        if (result.reason) {
          console.log('  Reason:', result.reason);
        }
        failedTests.push({ ...testCase, actual: result });
      }
    } catch (error: any) {
      failed++;
      console.log(
        colors.red('✗'),
        `[${testCase.category}]`,
        `"${testCase.query}"`,
        colors.red('→ ERROR'),
        error.message
      );
      failedTests.push({ ...testCase, error: error.message });
    }
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(colors.blue('Results:'));
  console.log(colors.green(`✓ Passed: ${passed}/${testCases.length}`));
  if (failed > 0) {
    console.log(colors.red(`✗ Failed: ${failed}/${testCases.length}`));
    console.log('');
    console.log(colors.red('Failed tests:'));
    failedTests.forEach(test => {
      console.log(`  - "${test.query}"`);
      console.log(`    Expected: ${test.expectedValid ? 'VALID' : 'INVALID'}`);
      console.log(`    Got: ${test.actual?.isValid ? 'VALID' : 'INVALID'}`);
      if (test.actual?.reason) {
        console.log(`    Reason: ${test.actual.reason}`);
      }
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });
  }
  console.log('─'.repeat(60));

  if (failed === 0) {
    console.log(colors.green('\n🎉 All validation tests passed!\n'));
  } else {
    console.log(colors.red('\n⚠️  Some tests failed. Review the validation logic.\n'));
  }
}

runTests().catch(console.error);
