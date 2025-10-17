"use client";

/**
 * Article Assistant Chat Component
 * Provides AI-powered chat interface for article Q&A
 */

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  isSummary?: boolean; // Flag to identify the summary message
  isStreaming?: boolean; // Flag to show streaming cursor
}

interface ArticleAssistantProps {
  articleId: number;
  domain: "esg" | "credit";
  articleTitle: string;
}

export default function ArticleAssistant({
  articleId,
  domain,
  articleTitle,
}: ArticleAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [loadingState, setLoadingState] = useState<"thinking" | "searching" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    async function initConversation() {
      try {
        const response = await fetch("/api/article-assistant/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId, domain }),
        });

        const data = await response.json();
        
        console.log("Init response:", data);

        if (data.success) {
          setSessionId(data.conversation.sessionId);
          setSummary(data.conversation.summary);
          setSuggestedQuestions(data.conversation.suggestedQuestions || []);

          // Add summary as first message
          if (data.conversation.summary) {
            setMessages([
              {
                role: "assistant",
                content: data.conversation.summary,
                isSummary: true,
              },
            ]);
          } else {
            console.warn("No summary in response");
          }
        } else {
          console.error("Init failed:", data.error);
          setMessages([
            {
              role: "assistant",
              content: "Hi! I'm ready to answer questions about this article. What would you like to know?",
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to initialize conversation:", error);
        setMessages([
          {
            role: "assistant",
            content: "Hi! I'm ready to answer questions about this article. What would you like to know?",
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }

    initConversation();
  }, [articleId, domain]);

  // Send message
  async function sendMessage() {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setLoadingState("thinking"); // Start with thinking state

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/article-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          domain,
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let hasStartedStreaming = false;

      // Add empty assistant message with streaming flag
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", isStreaming: true },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Mark streaming as complete
          setMessages((prev) => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]) {
              newMessages[newMessages.length - 1].isStreaming = false;
            }
            return newMessages;
          });
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.chunk) {
                // Check if we're searching the web
                if (data.chunk.includes("🔍")) {
                  setLoadingState("searching");
                } else if (!hasStartedStreaming) {
                  // Once we start getting actual content, clear loading state
                  setLoadingState(null);
                  hasStartedStreaming = true;
                }

                assistantMessage += data.chunk;
                // Update the last message with streaming flag
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantMessage;
                  newMessages[newMessages.length - 1].isStreaming = true;
                  return newMessages;
                });
              }

              if (data.done) {
                break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingState(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {isInitializing ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Analyzing article...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Special rendering for summary card
              if (message.isSummary) {
                return (
                  <div key={index} className="mb-4">
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                      {/* Summary Content */}
                      <div className="p-4">
                        <div className="prose prose-sm max-w-none text-gray-700 
                          [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-purple-800 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mb-2 [&_h2]:mt-0
                          [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-purple-800 [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mb-2 [&_h3]:mt-0
                          [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-gray-700 [&_p]:mb-3
                          [&_ul]:mt-2 [&_ul]:space-y-1.5
                          [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-gray-700
                          [&_strong]:text-purple-900 [&_strong]:font-semibold
                          [&>*:first-child]:mt-0
                          [&>*:last-child]:mb-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        <div className="mt-4 pt-3 border-t border-purple-200">
                          <p className="text-xs text-purple-700 italic">
                            💡 Feel free to ask me any questions about the article!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Regular chat messages
              return (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-purple-600" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl p-4 shadow-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                        : "bg-white text-gray-900 border border-gray-200"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none text-sm 
                        [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
                        [&_li]:text-sm [&_li]:leading-relaxed [&_li]:mb-1
                        [&_ul]:my-2 [&_ul]:space-y-1
                        [&_ol]:my-2 [&_ol]:space-y-1
                        [&_strong]:text-gray-900 [&_strong]:font-semibold
                        [&_a]:text-blue-600 [&_a]:underline [&_a]:font-medium [&_a]:hover:text-blue-700
                        [&_a]:cursor-pointer [&_a]:break-words
                        [&_code]:text-xs [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-gray-800
                        [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-gray-700
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 underline font-medium inline-flex items-center gap-1"
                              >
                                {children}
                                <span className="text-xs">🔗</span>
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-purple-600 animate-pulse"></span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Loading Animation */}
            {loadingState && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-gray-100 text-gray-900 rounded-lg p-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-gray-600 ml-2">
                    {loadingState === "thinking" ? "Thinking..." : "Searching web..."}
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        {/* Suggested Questions - Glassy chips */}
        {suggestedQuestions.length > 0 && messages.length === 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setInput(question);
                  // Auto-focus input after setting question
                  setTimeout(() => {
                    const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
                    inputEl?.focus();
                  }, 0);
                }}
                disabled={isLoading || isInitializing}
                className="group relative px-3 py-2 text-xs text-purple-700 rounded-lg
                  bg-gradient-to-br from-purple-50/80 to-blue-50/80
                  backdrop-blur-sm border border-purple-200/50
                  hover:from-purple-100/90 hover:to-blue-100/90 hover:border-purple-300/70
                  hover:shadow-md hover:scale-[1.02]
                  active:scale-[0.98]
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                title="Click to use this question"
              >
                <span className="relative z-10 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-500 group-hover:text-purple-600" />
                  <span className="font-medium leading-tight">{question}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask a question about the article..."
            disabled={isLoading || isInitializing}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || isInitializing || !input.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
