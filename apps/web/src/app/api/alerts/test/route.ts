import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import { getPrisma } from "@/lib/db";
import { processEmailQueue } from "@/lib/alerts/email-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/alerts/test - Send a test email to verify alert settings
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const body = await req.json();
    const { domain = "esg", alertType = "weekly_digest" } = body;

    // Validate inputs
    if (!["esg", "credit"].includes(domain)) {
      return NextResponse.json(
        { error: "Invalid domain. Must be 'esg' or 'credit'" },
        { status: 400 }
      );
    }

    if (!["weekly_digest", "daily_digest", "immediate"].includes(alertType)) {
      return NextResponse.json(
        { error: "Invalid alert type" },
        { status: 400 }
      );
    }

    // Get user details
    const [user] = await esgPrisma.$queryRaw<any[]>`
      SELECT id, email, username, first_name, last_name, team
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's alert preferences
    const [prefs] = await esgPrisma.$queryRaw<any[]>`
      SELECT * FROM alert_preferences
      WHERE user_id = ${userId} AND domain = ${domain}
      LIMIT 1
    `;

    const emailTo = prefs?.email_address || user.email;

    // Generate test content based on alert type
    let sampleContent: any[] = [];
    const prisma = getPrisma(domain as "esg" | "credit");

    if (alertType === "weekly_digest") {
      // Get team members
      const teamMembers = await esgPrisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM users
        WHERE team = ${user.team} AND id != ${userId}
        LIMIT 10
      `;
      const teamIds = teamMembers.map((m) => m.id);

      if (teamIds.length > 0) {
        // Get recent liked articles by team
        if (domain === "esg") {
          sampleContent = await prisma.$queryRaw<any[]>`
            SELECT a.id, a.title, a.source, a.link,
                   COALESCE(a.published, a.save_time) AS date,
                   COUNT(l.*)::int AS likes
            FROM likes l
            JOIN esg_articles a ON a.id = l.content_id
            WHERE l.user_id = ANY(${teamIds})
              AND l.created_at >= NOW() - INTERVAL '7 days'
              AND COALESCE(l.content_type, 'article') = 'article'
            GROUP BY a.id
            ORDER BY likes DESC, date DESC
            LIMIT 5
          `;
        } else {
          sampleContent = await prisma.$queryRaw<any[]>`
            SELECT a.id, a.title, a.source, a.link, a.date,
                   COUNT(l.*)::int AS likes
            FROM likes l
            JOIN credit_articles a ON a.id = l.content_id
            WHERE l.user_id = ANY(${teamIds})
              AND l.created_at >= NOW() - INTERVAL '7 days'
              AND COALESCE(l.content_type, 'article') = 'article'
            GROUP BY a.id
            ORDER BY likes DESC, a.date DESC
            LIMIT 5
          `;
        }
      }
    } else if (alertType === "daily_digest") {
      // Get recent articles
      if (domain === "esg") {
        sampleContent = await prisma.$queryRaw<any[]>`
          SELECT id, title, source, link,
                 COALESCE(published, save_time) AS date
          FROM esg_articles
          WHERE COALESCE(published, save_time) >= NOW() - INTERVAL '1 day'
          ORDER BY COALESCE(published, save_time) DESC
          LIMIT 5
        `;
      } else {
        sampleContent = await prisma.$queryRaw<any[]>`
          SELECT id, title, source, link, date
          FROM credit_articles
          WHERE date >= NOW() - INTERVAL '1 day'
          ORDER BY date DESC
          LIMIT 5
        `;
      }
    } else {
      // Immediate alert - get one recent article
      if (domain === "esg") {
        sampleContent = await prisma.$queryRaw<any[]>`
          SELECT id, title, source, link,
                 COALESCE(published, save_time) AS date
          FROM esg_articles
          ORDER BY COALESCE(published, save_time) DESC
          LIMIT 1
        `;
      } else {
        sampleContent = await prisma.$queryRaw<any[]>`
          SELECT id, title, source, link, date
          FROM credit_articles
          ORDER BY date DESC
          LIMIT 1
        `;
      }
    }

    // Generate email subject and body
    const userName = user.first_name || user.username || "User";
    let emailSubject = "";
    let emailBody = "";

    if (alertType === "weekly_digest") {
      emailSubject = `[TEST] Weekly Digest - ${domain.toUpperCase()} Articles`;
      emailBody = `
        <h2>🔔 Weekly Digest (Test Email)</h2>
        <p>Hi ${userName},</p>
        <p>This is a <strong>test email</strong> for your weekly digest alert.</p>
        <p>Here are the top articles liked by your team this week:</p>
        ${sampleContent.length > 0 ? `
          <ul>
            ${sampleContent.map((item) => `
              <li>
                <strong>${item.title || "Untitled"}</strong><br/>
                Source: ${item.source || "Unknown"} | Likes: ${item.likes || 0}<br/>
                <a href="${item.link || "#"}">Read more</a>
              </li>
            `).join("")}
          </ul>
        ` : `<p>No team activity found in the last 7 days.</p>`}
        <p><small>This is a test email. Real digests will be sent every Monday at 9 AM.</small></p>
      `;
    } else if (alertType === "daily_digest") {
      emailSubject = `[TEST] Daily Digest - ${domain.toUpperCase()} Articles`;
      emailBody = `
        <h2>📰 Daily Digest (Test Email)</h2>
        <p>Hi ${userName},</p>
        <p>This is a <strong>test email</strong> for your daily digest alert.</p>
        <p>Here are today's top articles:</p>
        ${sampleContent.length > 0 ? `
          <ul>
            ${sampleContent.map((item) => `
              <li>
                <strong>${item.title || "Untitled"}</strong><br/>
                Source: ${item.source || "Unknown"}<br/>
                <a href="${item.link || "#"}">Read more</a>
              </li>
            `).join("")}
          </ul>
        ` : `<p>No new articles found in the last 24 hours.</p>`}
        <p><small>This is a test email. Real digests will be sent based on your preferences.</small></p>
      `;
    } else {
      emailSubject = `[TEST] New Article Alert - ${domain.toUpperCase()}`;
      emailBody = `
        <h2>🚨 Immediate Alert (Test Email)</h2>
        <p>Hi ${userName},</p>
        <p>This is a <strong>test email</strong> for immediate alerts.</p>
        ${sampleContent.length > 0 ? `
          <p><strong>New Article:</strong></p>
          <ul>
            <li>
              <strong>${sampleContent[0].title || "Untitled"}</strong><br/>
              Source: ${sampleContent[0].source || "Unknown"}<br/>
              <a href="${sampleContent[0].link || "#"}">Read more</a>
            </li>
          </ul>
        ` : `<p>No recent articles found.</p>`}
        <p><small>This is a test email. Real alerts will be sent when new content is published.</small></p>
      `;
    }

    // Insert into email queue with high priority (test emails should be sent immediately)
    await esgPrisma.$queryRaw`
      INSERT INTO email_queue (
        user_id, email_to, email_subject, email_body, email_html,
        priority, scheduled_for, status, alert_type, domain, metadata
      ) VALUES (
        ${userId}, ${emailTo}, ${emailSubject}, ${emailBody}, ${emailBody},
        10, NOW(), 'queued', ${alertType}, ${domain},
        '{"test": true}'::jsonb
      )
    `;

    // Record in alert history
    await esgPrisma.$queryRaw`
      INSERT INTO alert_history (
        user_id, domain, alert_type, content_type, content_ids,
        email_to, email_subject, email_status, total_items, created_at
      ) VALUES (
        ${userId}, ${domain}, ${alertType}, 'article',
        ${sampleContent.map((c) => c.id)},
        ${emailTo}, ${emailSubject}, 'pending', ${sampleContent.length}, NOW()
      )
    `;

    // IMMEDIATELY process the email queue to send test email right away
    console.log("🚀 Processing test email immediately...");
    try {
      const stats = await processEmailQueue("test-worker", 1);
      console.log(`📧 Test email processed: ${stats.sent} sent, ${stats.failed} failed`);
      
      if (stats.sent > 0) {
        return NextResponse.json({
          success: true,
          message: `Test email sent successfully to ${emailTo}! Check your inbox.`,
          preview: {
            subject: emailSubject,
            contentCount: sampleContent.length,
            emailTo,
          },
        });
      } else if (stats.failed > 0) {
        return NextResponse.json({
          success: false,
          error: `Test email queued but failed to send. Check server logs for details.`,
          message: `Email was queued but sending failed. Please check SMTP configuration.`,
        }, { status: 500 });
      }
    } catch (processError: any) {
      console.error("❌ Failed to process email immediately:", processError);
      // Fallback: email is queued, will be sent by cron
      return NextResponse.json({
        success: true,
        message: `Test email queued successfully! It will be sent to ${emailTo} when the email worker runs.`,
        warning: "Email processing worker not running. Email queued for later delivery.",
        preview: {
          subject: emailSubject,
          contentCount: sampleContent.length,
          emailTo,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Test email queued successfully! It will be sent to ${emailTo}`,
      preview: {
        subject: emailSubject,
        contentCount: sampleContent.length,
        emailTo,
      },
    });
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send test email" },
      { status: 500 }
    );
  }
}
