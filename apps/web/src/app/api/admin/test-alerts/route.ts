import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import { creditPrisma } from "@esgcredit/db-credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin endpoint to test alert system
 * Tests immediate alerts for a specific user or all users
 * Returns detailed information about what would be sent
 * AND actually sends the emails
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, alertId, lookbackMinutes = 30, sendEmail = true } = body;

    const now = new Date();
    const since = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
    
    const results = {
      timestamp: now.toISOString(),
      lookbackMinutes,
      since: since.toISOString(),
      alerts: [] as any[],
      totalNewContent: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    // Build query to get alerts
    let whereClause = `WHERE ap.alert_type = 'immediate_alerts' AND ap.is_active = true`;
    const params: any[] = [];
    
    if (alertId) {
      whereClause += ` AND ap.id = $1`;
      params.push(alertId);
    } else if (userId) {
      whereClause += ` AND ap.user_id = $1`;
      params.push(userId);
    }

    const query = `
      SELECT ap.*, u.email, u.first_name, u.last_name, u.team
      FROM alert_preferences ap
      JOIN users u ON ap.user_id = u.id
      ${whereClause}
    `;

    const alerts = await esgPrisma.$queryRawUnsafe<any[]>(query, ...params);

    if (alerts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No immediate alerts found",
        results,
      });
    }

    // Process each alert
    for (const alert of alerts) {
      try {
        // Get already sent content
        const sentContent = await getAlreadySentContent(alert.id);
        
        // Find new content
        const newContent = await findNewContentForAlert(alert, since, sentContent);
        
        let emailSent = false;
        
        // Send email if requested and there's new content
        if (sendEmail && newContent.length > 0) {
          try {
            await sendImmediateAlert(alert, newContent);
            await trackSentContent(alert.id, newContent);
            emailSent = true;
            results.emailsSent++;
          } catch (emailError: any) {
            results.errors.push(`Email error for alert ${alert.id}: ${emailError.message}`);
          }
        }
        
        results.alerts.push({
          alertId: alert.id,
          userId: alert.user_id,
          userEmail: alert.email,
          userName: [alert.first_name, alert.last_name].filter(Boolean).join(' ') || 'User',
          domains: alert.domains || [alert.domain],
          keywords: alert.immediate_keywords || [],
          sources: alert.immediate_sources || [],
          lastSentAt: alert.last_sent_at,
          alreadySentCount: sentContent.size,
          newContentCount: newContent.length,
          emailSent,
          newContent: newContent.map(c => ({
            domain: c.domain,
            type: c.type,
            id: c.id,
            title: c.title,
            source: c.source,
            publishedDate: c.published_date,
            saveTime: c.save_time,
            link: c.link,
          })),
        });
        
        results.totalNewContent += newContent.length;
      } catch (error: any) {
        results.errors.push(`Alert ${alert.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Found ${results.totalNewContent} new items across ${alerts.length} alerts. ${results.emailsSent} emails sent.`,
      results,
    });
  } catch (error: any) {
    console.error("Error testing alerts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to test alerts" },
      { status: 500 }
    );
  }
}

/**
 * Get already sent content for this alert
 */
async function getAlreadySentContent(alertPreferenceId: number): Promise<Set<string>> {
  try {
    const sentContent = await esgPrisma.$queryRaw<any[]>`
      SELECT domain, content_type, content_id
      FROM alert_content_sent
      WHERE alert_preference_id = ${alertPreferenceId}
        AND sent_at > NOW() - INTERVAL '7 days'
    `;

    return new Set(
      sentContent.map((c: any) => `${c.domain}:${c.content_type}:${c.content_id}`)
    );
  } catch (error) {
    console.error("Error fetching already sent content:", error);
    return new Set();
  }
}

/**
 * Find new content for alert (same logic as cron job)
 */
async function findNewContentForAlert(alert: any, since: Date, alreadySent: Set<string>) {
  const newContent: any[] = [];
  const domains = alert.domains || [alert.domain];
  const keywords = alert.immediate_keywords || [];
  const sources = alert.immediate_sources || [];

  const keywordPattern = keywords.length > 0 
    ? keywords.map((k: string) => `%${k.toLowerCase()}%`).join("|")
    : null;

  // Check articles for each domain
  for (const domain of domains) {
    const prisma = domain === "esg" ? esgPrisma : creditPrisma;
    const tableName = domain === "esg" ? "esg_articles" : "credit_articles";
    const publishedDateColumn = domain === "esg" ? "published" : "date";
    
    try {
      // Only send articles published TODAY
      let query = `
        SELECT id, title, summary, source, ${publishedDateColumn} as published_date, link, save_time
        FROM ${tableName}
        WHERE save_time > $1
          AND ${publishedDateColumn}::date = CURRENT_DATE
      `;
      const params: any[] = [since];

      if (sources.length > 0) {
        query += ` AND source = ANY($${params.length + 1})`;
        params.push(sources);
      }

      if (keywordPattern) {
        query += ` AND (LOWER(title) SIMILAR TO $${params.length + 1} OR LOWER(summary) SIMILAR TO $${params.length + 1})`;
        params.push(keywordPattern);
      }

      query += ` ORDER BY save_time DESC LIMIT 20`;

      const articles = await prisma.$queryRawUnsafe<any[]>(query, ...params);
      
      const newArticles = articles.filter((a: any) => 
        !alreadySent.has(`${domain}:article:${a.id}`)
      );
      
      newContent.push(...newArticles.map(a => ({ ...a, type: "article", domain })));
    } catch (error) {
      console.error(`Error querying ${tableName}:`, error);
    }
  }

  return newContent;
}

/**
 * Send immediate alert email
 */
async function sendImmediateAlert(alert: any, newContent: any[]) {
  const userName = [alert.first_name, alert.last_name].filter(Boolean).join(' ') || 'User';

  await queueEmail({
    userId: alert.user_id,
    to: alert.email_address || alert.email,
    subject: `${alert.alert_name} - New Content Alert`,
    type: "immediate_alert",
    alertType: 'immediate_alert',
    domain: alert.domain || alert.domains?.[0] || 'esg',
    data: {
      userName,
      alertName: alert.alert_name,
      content: newContent,
      count: newContent.length,
    },
  });
}

/**
 * Track sent content to prevent future duplicates
 */
async function trackSentContent(alertPreferenceId: number, content: any[]) {
  try {
    for (const item of content) {
      try {
        await esgPrisma.$executeRaw`
          INSERT INTO alert_content_sent (
            alert_preference_id, domain, content_type, content_id, content_save_time, sent_at
          ) VALUES (
            ${alertPreferenceId},
            ${item.domain},
            ${item.type},
            ${item.id},
            ${item.save_time || null},
            NOW()
          )
          ON CONFLICT (alert_preference_id, domain, content_type, content_id) 
          DO NOTHING
        `;
      } catch (error) {
        console.error(`Error tracking content ${item.domain}:${item.type}:${item.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error tracking sent content:", error);
  }
}

/**
 * Queue email for sending
 */
async function queueEmail(emailData: any) {
  try {
    let textBody = `${emailData.subject}\n\nHello ${emailData.data.userName},\n\n`;
    textBody += `You have ${emailData.data.count} new items:\n\n`;
    
    if (emailData.data.content && emailData.data.content.length > 0) {
      emailData.data.content.forEach((item: any, index: number) => {
        textBody += `${index + 1}. ${item.title}\n`;
        if (item.published_date) {
          textBody += `   Date: ${new Date(item.published_date).toLocaleDateString()}\n`;
        }
        if (item.domain) {
          textBody += `   Domain: ${item.domain.toUpperCase()}\n`;
        }
        textBody += `   Link: ${item.link}\n\n`;
      });
    }
    
    let htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2c3e50;">${emailData.subject}</h2>
          <p>Hello ${emailData.data.userName},</p>
          <p>You have <strong>${emailData.data.count} new items</strong> from your alert <strong>${emailData.data.alertName}</strong>:</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    `;
    
    if (emailData.data.content && emailData.data.content.length > 0) {
      emailData.data.content.forEach((item: any) => {
        const borderColor = item.domain === 'esg' ? '#27ae60' : '#e74c3c';
        const domainBadge = item.domain === 'esg' 
          ? '<span style="background: #27ae60; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">ESG</span>'
          : '<span style="background: #e74c3c; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold;">CREDIT</span>';
        
        htmlBody += `
          <div style="margin-bottom: 25px; padding: 15px; background: #f9f9f9; border-left: 4px solid ${borderColor};">
            <div style="margin-bottom: 8px;">${domainBadge}</div>
            <h3 style="margin-top: 0; color: #2c3e50;">
              <a href="${item.link}" style="color: #3498db; text-decoration: none;">${item.title}</a>
            </h3>
            ${item.published_date ? `<p style="color: #7f8c8d; font-size: 14px; margin: 5px 0;">📅 ${new Date(item.published_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
            ${item.source ? `<p style="color: #7f8c8d; font-size: 14px; margin: 5px 0;">📰 Source: ${item.source}</p>` : ''}
            <p style="margin-top: 10px;">
              <a href="${item.link}" style="display: inline-block; padding: 8px 15px; background: #3498db; color: white; text-decoration: none; border-radius: 4px;">Read More</a>
            </p>
          </div>
        `;
      });
    }
    
    htmlBody += `
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #7f8c8d; font-size: 12px;">This is an automated alert from your ESG Portal. You can manage your alerts in your profile settings.</p>
        </body>
      </html>
    `;
    
    await esgPrisma.email_queue.create({
      data: {
        email_to: emailData.to,
        email_subject: emailData.subject,
        email_body: textBody,
        email_html: htmlBody,
        scheduled_for: new Date(),
        status: 'queued',
        alert_type: emailData.alertType || null,
        domain: emailData.domain || null,
        metadata: emailData,
        users: {
          connect: { id: emailData.userId }
        }
      }
    });
  } catch (error) {
    console.error("Error queuing email:", error);
    throw error;
  }
}
