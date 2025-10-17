/**
 * API Route: Article Assistant Chat
 * POST /api/article-assistant/chat
 * 
 * Handles user messages with streaming responses
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { getPrisma } from "@/lib/db";
import {
  getConversationBySessionId,
  addMessage,
  getConversationHistory,
} from "@/lib/article-assistant-db";
import { streamArticleChat } from "@/lib/article-assistant-agent";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { sessionId, message, domain } = body;

    if (!sessionId || !message || !domain) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (domain !== "esg" && domain !== "credit") {
      return new Response(
        JSON.stringify({ error: "Invalid domain" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get conversation
    const conversation = await getConversationBySessionId(domain, sessionId);

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch article content
    const prisma = getPrisma(domain);
    let article: any = null;

    if (domain === "credit") {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT id, title, content
        FROM credit_articles
        WHERE id = ${conversation.article_id}
        LIMIT 1
      `;
      article = rows[0] || null;
    } else {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT id, title, summary as content
        FROM esg_articles
        WHERE id = ${conversation.article_id}
        LIMIT 1
      `;
      article = rows[0] || null;
    }

    if (!article) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Add user message to database
    await addMessage(domain, conversation.id, "user", message, 0);

    // Get conversation history
    const history = await getConversationHistory(domain, conversation.id, 10);

    // Get OpenAI key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the response
          const responseStream = await streamArticleChat(
            history,
            article.content || "",
            article.title || "Untitled",
            conversation.article_summary,
            openaiKey
          );

          let fullResponse = "";

          for await (const chunk of responseStream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }

          // Save assistant response to database
          await addMessage(domain, conversation.id, "assistant", fullResponse, 0);

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
