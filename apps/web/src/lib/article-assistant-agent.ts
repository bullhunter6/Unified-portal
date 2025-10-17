/**
 * Article Assistant Agent using LangGraph
 * Provides article summarization and Q&A capabilities
 * 
 * @server-only
 */

import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Define the state for our agent
export interface ArticleAssistantState {
  messages: BaseMessage[];
  articleContent: string;
  articleTitle: string;
  articleSource: "esg" | "credit";
  articleId: number;
  summary?: string;
  needsWebSearch?: boolean;
  finalAnswer?: string;
}

/**
 * Create the article assistant agent
 */
export function createArticleAssistantAgent(config: {
  openaiApiKey: string;
  model?: string;
  temperature?: number;
}) {
  const { openaiApiKey, model = "gpt-4o-mini", temperature = 0.7 } = config;

  // Initialize the LLM
  const llm = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    modelName: model,
    temperature,
    streaming: true,
  });

  // Define tools (web search with Tavily)
  const tools = [
    new DynamicStructuredTool({
      name: "web_search",
      description:
        "Search the web for additional information related to the article topic. Use this when the article doesn't contain sufficient information to answer the user's question, or when recent updates/additional context would be helpful.",
      schema: z.object({
        query: z.string().describe("The search query to find relevant information"),
      }),
      func: async ({ query }) => {
        try {
          // Use Tavily API for web search
          const tavilyApiKey = process.env.TAVILY_API_KEY || "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";
          
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: query,
              search_depth: "basic",
              include_answer: true,
              max_results: 5,
            }),
          });

          if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Format the search results
          let result = "";
          
          if (data.answer) {
            result += `Direct Answer: ${data.answer}\n\n`;
          }
          
          if (data.results && data.results.length > 0) {
            result += "Search Results:\n\n";
            data.results.slice(0, 3).forEach((item: any, index: number) => {
              result += `${index + 1}. ${item.title}\n`;
              result += `   ${item.content}\n`;
              result += `   Source: ${item.url}\n\n`;
            });
          }
          
          return result || "No relevant information found.";
        } catch (error) {
          console.error("Web search error:", error);
          return `Unable to perform web search at this time. Please answer based on the article content.`;
        }
      },
    }),
  ];

  const llmWithTools = llm.bindTools(tools);

  // Define the graph nodes

  /**
   * Generate summary node
   */
  async function generateSummary(
    state: ArticleAssistantState
  ): Promise<Partial<ArticleAssistantState>> {
    const systemPrompt = `You are an expert article summarizer. Generate a concise, informative summary of the following article.

The summary should:
- Be 3-5 key bullet points
- Capture the main ideas and important details
- Be clear and easy to understand
- Focus on actionable insights

Article Title: ${state.articleTitle}
Article Content:
${state.articleContent}

Generate the summary now:`;

    const response = await llm.invoke([new SystemMessage(systemPrompt)]);

    return {
      summary: response.content as string,
    };
  }

  /**
   * Answer question node
   */
  async function answerQuestion(
    state: ArticleAssistantState
  ): Promise<Partial<ArticleAssistantState>> {
    const lastMessage = state.messages[state.messages.length - 1];

    const systemPrompt = `You are an intelligent article assistant with web search capabilities. Your role is to help users understand and learn from this article.

IMPORTANT RULES:
1. PRIMARILY answer questions based on the article content provided
2. If the article doesn't contain sufficient information OR if the user asks for recent updates/additional context, you can use the web_search tool
3. Be accurate, helpful, and concise
4. Cite specific parts of the article when possible
5. When you use web search, clearly indicate that you're supplementing with external information

TOOLS AVAILABLE:
- web_search: Use this to find additional information from the web when the article lacks details or when recent updates would be helpful

Article Title: ${state.articleTitle}
Article Source: ${state.articleSource}

Article Summary:
${state.summary || "No summary available"}

Full Article Content:
${state.articleContent}

Previous conversation:
${state.messages.slice(0, -1).map((m) => `${m._getType()}: ${m.content}`).join("\n")}

User's current question: ${lastMessage.content}

Answer the question now. Use web_search if needed:`;

    const response = await llmWithTools.invoke([new SystemMessage(systemPrompt)]);

    return {
      messages: [...state.messages, response as BaseMessage],
      finalAnswer: response.content as string,
    };
  }

  /**
   * Decide if we need web search (for future enhancement)
   */
  function shouldSearch(state: ArticleAssistantState): string {
    const lastMessage = state.messages[state.messages.length - 1];

    // For now, always go directly to answer
    // In future, can add logic to detect when article doesn't have answer
    return "answer";
  }

  // Build the graph
  const workflow = new StateGraph<ArticleAssistantState>({
    channels: {
      messages: {
        value: (prev: BaseMessage[], next: BaseMessage[]) => {
          return next ? [...prev, ...next] : prev;
        },
        default: () => [],
      },
      articleContent: {
        value: (prev: string, next: string) => next ?? prev,
        default: () => "",
      },
      articleTitle: {
        value: (prev: string, next: string) => next ?? prev,
        default: () => "",
      },
      articleSource: {
        value: (prev: "esg" | "credit", next: "esg" | "credit") => next ?? prev,
        default: () => "esg" as "esg" | "credit",
      },
      articleId: {
        value: (prev: number, next: number) => next ?? prev,
        default: () => 0,
      },
      summary: {
        value: (prev?: string, next?: string) => next ?? prev,
        default: () => undefined,
      },
      needsWebSearch: {
        value: (prev?: boolean, next?: boolean) => next ?? prev,
        default: () => false,
      },
      finalAnswer: {
        value: (prev?: string, next?: string) => next ?? prev,
        default: () => undefined,
      },
    },
  });

  // Add nodes
  workflow.addNode("generate_summary", generateSummary);
  workflow.addNode("answer_question", answerQuestion);

  // Define the flow
  // START -> answer_question -> END
  workflow.addEdge(START, "answer_question");
  workflow.addEdge("answer_question", END);

  // Compile the graph
  const app = workflow.compile();

  return app;
}

/**
 * Generate summary for an article
 */
export async function generateArticleSummary(
  articleContent: string,
  articleTitle: string,
  openaiApiKey: string
): Promise<{ summary: string; tokens: number }> {
  const llm = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.5,
  });

  const systemPrompt = `You are an expert article summarizer. Generate a structured summary with two sections:

**Format:**

1. **Overview** (2-3 sentences): A brief, high-level summary of what the article is about. Make it concise and informative.

2. **Key Points** (3-5 bullet points): Important highlights, facts, and takeaways from the article.
   • Each bullet should be clear and specific
   • Focus on actionable insights and important facts
   • Keep bullets concise (1-2 sentences max)

Article: "${articleTitle}"

Content:
${articleContent.slice(0, 4000)} ${articleContent.length > 4000 ? "..." : ""}

Generate the structured summary now with "Overview" section first, then "Key Points" as bullet points:`;

  const response = await llm.invoke([new SystemMessage(systemPrompt)]);

  // Estimate tokens (rough calculation: ~1 token per 4 characters)
  const estimatedTokens = Math.ceil(
    (systemPrompt.length + (response.content as string).length) / 4
  );

  return {
    summary: response.content as string,
    tokens: estimatedTokens,
  };
}

/**
 * Stream chat responses with tool support
 */
export async function streamArticleChat(
  messages: { role: string; content: string }[],
  articleContent: string,
  articleTitle: string,
  articleSummary: string | null,
  openaiApiKey: string
): Promise<AsyncGenerator<string>> {
  const llm = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.7,
    streaming: true,
  });

  // Define web search tool
  const tools = [
    new DynamicStructuredTool({
      name: "web_search",
      description:
        "Search the web for additional information, related articles, recent updates, or supplementary context. Use this when the article doesn't contain the information needed or when the user explicitly asks for more resources, related articles, or recent updates.",
      schema: z.object({
        query: z.string().describe("The search query to find relevant information or articles"),
      }),
      func: async ({ query }) => {
        try {
          const tavilyApiKey = process.env.TAVILY_API_KEY || "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";
          
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: query,
              search_depth: "basic",
              include_answer: true,
              max_results: 5,
            }),
          });

          if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
          }

          const data = await response.json();
          
          let result = "";
          
          if (data.answer) {
            result += `Answer: ${data.answer}\n\n`;
          }
          
          if (data.results && data.results.length > 0) {
            result += "Relevant Resources:\n\n";
            data.results.forEach((item: any, index: number) => {
              result += `${index + 1}. **${item.title}**\n`;
              result += `   ${item.content}\n`;
              result += `   🔗 ${item.url}\n\n`;
            });
          }
          
          return result || "No relevant information found.";
        } catch (error) {
          console.error("Web search error:", error);
          return `Unable to perform web search at this time.`;
        }
      },
    }),
  ];

  const llmWithTools = llm.bindTools(tools);

  const systemPrompt = `You are an intelligent article assistant with web search capabilities.

PRIMARY MISSION:
1. Answer questions about the article content
2. When users ask for "related articles", "more information", "recent updates", or "similar resources" - USE the web_search tool
3. Be helpful and proactive in finding additional resources when requested

TOOLS AVAILABLE:
- web_search: Use this to find related articles, recent updates, or supplementary information from the web

Article: "${articleTitle}"

Summary:
${articleSummary || "Not available"}

Full Article:
${articleContent.slice(0, 3000)}${articleContent.length > 3000 ? "..." : ""}

When a user asks for related articles or more information, ALWAYS use the web_search tool to help them.`;

  const formattedMessages = [
    new SystemMessage(systemPrompt),
    ...messages.map((m) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
  ];

  // First, call the model to see if it wants to use tools
  const response = await llmWithTools.invoke(formattedMessages);

  return (async function* () {
    // Check if the model wants to use tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Execute tool calls
      for (const toolCall of response.tool_calls) {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
          yield `🔍`; // Just a marker to trigger the "searching" state
          
          const toolResult = await tool.func(toolCall.args);
          
          // Now call the model again with the tool result
          const toolMessage = {
            role: "tool" as const,
            content: toolResult,
            tool_call_id: toolCall.id || "search",
          };
          
          const finalMessages = [
            ...formattedMessages,
            response,
            toolMessage as any,
          ];
          
          const finalStream = await llm.stream(finalMessages);
          
          for await (const chunk of finalStream) {
            if (chunk.content) {
              yield chunk.content as string;
            }
          }
        }
      }
    } else {
      // No tool calls, just stream the response
      if (response.content) {
        yield response.content as string;
      }
    }
  })();
}

/**
 * Generate suggested questions for an article
 */
export async function generateSuggestedQuestions(
  articleContent: string,
  articleTitle: string,
  openaiApiKey: string
): Promise<string[]> {
  const llm = new ChatOpenAI({
    openAIApiKey: openaiApiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.7,
  });

  const systemPrompt = `You are an expert at generating insightful questions about articles. Based on the article title and content, generate 4 interesting questions that readers might want to ask.

RULES:
1. Questions must be DIRECTLY related to the article content
2. Questions should be specific and insightful
3. Avoid generic questions like "What is this about?"
4. Focus on key details, implications, or important aspects mentioned in the article
5. Make questions natural and conversational

Article Title: "${articleTitle}"

Article Content:
${articleContent.slice(0, 3000)} ${articleContent.length > 30000 ? "..." : ""}

Generate exactly 4 questions, one per line, without numbering or bullets. Just the questions.`;

  const response = await llm.invoke([new SystemMessage(systemPrompt)]);

  // Parse the response into an array of questions
  const questions = (response.content as string)
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.endsWith("?"))
    .slice(0, 4); // Ensure max 4 questions

  return questions;
}
