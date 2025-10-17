/**
 * API Route: Initialize Article Assistant Conversation
 * POST /api/article-assistant/init
 * 
 * Creates or retrieves conversation and generates summary if needed
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { getPrisma } from "@/lib/db";
import {
  getOrCreateConversation,
  updateConversationSummary,
  hasFreshSummary,
} from "@/lib/article-assistant-db";
import { generateArticleSummary, generateSuggestedQuestions } from "@/lib/article-assistant-agent";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;

    const body = await request.json();
    const { articleId, domain } = body;

    if (!articleId || !domain) {
      return NextResponse.json(
        { error: "Missing articleId or domain" },
        { status: 400 }
      );
    }

    if (domain !== "esg" && domain !== "credit") {
      return NextResponse.json(
        { error: "Invalid domain. Must be 'esg' or 'credit'" },
        { status: 400 }
      );
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      domain,
      Number(articleId),
      userId
    );

    // Check if we need to generate summary
    let summary = conversation.article_summary;
    const hasSummary = await hasFreshSummary(conversation);
    let needsGeneration = !hasSummary;

    console.log("Conversation check:", {
      conversationId: conversation.id,
      hasSummary,
      needsGeneration,
      existingSummary: summary ? summary.substring(0, 50) + "..." : null
    });

    if (needsGeneration) {
      // Fetch article content
      const prisma = getPrisma(domain);
      let article: any = null;

      if (domain === "credit") {
        const rows = await prisma.$queryRaw<any[]>`
          SELECT id, title, content
          FROM credit_articles
          WHERE id = ${Number(articleId)}
          LIMIT 1
        `;
        article = rows[0] || null;
      } else {
        const rows = await prisma.$queryRaw<any[]>`
          SELECT id, title, summary as content
          FROM esg_articles
          WHERE id = ${Number(articleId)}
          LIMIT 1
        `;
        article = rows[0] || null;
      }

      if (!article) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );
      }

      // Generate summary using AI
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }

      const [{ summary: generatedSummary, tokens }, suggestedQuestions] = await Promise.all([
        generateArticleSummary(
          article.content || "",
          article.title || "Untitled",
          openaiKey
        ),
        generateSuggestedQuestions(
          article.content || "",
          article.title || "Untitled",
          openaiKey
        ),
      ]);

      // Cache the summary
      await updateConversationSummary(
        domain,
        conversation.id,
        generatedSummary,
        tokens
      );

      summary = generatedSummary;
      
      return NextResponse.json({
        success: true,
        conversation: {
          id: conversation.id,
          sessionId: conversation.session_id,
          summary,
          suggestedQuestions,
          totalMessages: conversation.total_messages,
        },
      });
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        sessionId: conversation.session_id,
        summary,
        suggestedQuestions: [],
        totalMessages: conversation.total_messages,
      },
    });
  } catch (error) {
    console.error("Error initializing conversation:", error);
    return NextResponse.json(
      { error: "Failed to initialize conversation" },
      { status: 500 }
    );
  }
}
