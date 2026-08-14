import type { EsgEventDto } from "./types";
import { describeEsgEventLocation } from "./normalize";

export const ESG_WEEKLY_DIGEST_TEMPLATE_VERSION = "v1";

export type EsgWeeklyDigestTemplate = {
  subject: string;
  text: string;
  html: string;
  onlineCount: number;
  otherCount: number;
};

type RenderEsgWeeklyDigestArgs = {
  weekStart: string;
  weekEnd: string;
  events: ReadonlyArray<EsgEventDto>;
  portalBaseUrl: string;
  testMode?: boolean;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dateFromCalendarValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatCalendarDate(value: string): string {
  return DATE_FORMATTER.format(dateFromCalendarValue(value));
}

export function formatEsgWeeklyDigestRange(weekStart: string, weekEnd: string): string {
  const start = dateFromCalendarValue(weekStart);
  const end = dateFromCalendarValue(weekEnd);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${SHORT_DATE_FORMATTER.format(start)}–${DATE_FORMATTER.format(end)}`;
  }
  return `${DATE_FORMATTER.format(start)}–${DATE_FORMATTER.format(end)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safePortalBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The portal base URL must use HTTP or HTTPS");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function internalEventUrl(baseUrl: string, eventId: number): string {
  return new URL(`/esg/events/${eventId}`, baseUrl).toString();
}

function eventDateLabel(event: EsgEventDto): string {
  if (!event.startDate) return "Date TBC";
  if (!event.endDate || event.endDate === event.startDate) {
    return formatCalendarDate(event.startDate);
  }
  return `${formatCalendarDate(event.startDate)} – ${formatCalendarDate(event.endDate)}`;
}

function eventTimeLabel(event: EsgEventDto): string | null {
  if (!event.startTime && !event.endTime) return null;
  const range = event.startTime && event.endTime
    ? `${event.startTime}–${event.endTime}`
    : event.startTime ?? `Until ${event.endTime}`;
  const zone = event.timezoneIana ?? event.timezoneRaw;
  return zone ? `${range} (${zone})` : range;
}

function eventMeta(event: EsgEventDto): string[] {
  return [
    eventDateLabel(event),
    eventTimeLabel(event),
    describeEsgEventLocation(event),
    event.organizerName ?? event.source,
  ].filter((value): value is string => Boolean(value));
}

function shortenedSummary(value: string | null): string | null {
  if (!value) return null;
  return value.length > 220 ? `${value.slice(0, 217).trimEnd()}…` : value;
}

function renderTextSection(
  title: string,
  events: ReadonlyArray<EsgEventDto>,
  baseUrl: string,
): string {
  if (events.length === 0) return "";
  const rows = events.map((event, index) => {
    const links = [`Details: ${internalEventUrl(baseUrl, event.id)}`];
    if (event.eventUrl) links.push(`Official website: ${event.eventUrl}`);
    const summary = shortenedSummary(event.summary);
    return [
      `${index + 1}. ${event.name}`,
      `   ${eventMeta(event).join(" · ")}`,
      summary ? `   ${summary}` : null,
      ...links.map((link) => `   ${link}`),
    ].filter(Boolean).join("\n");
  });
  return `${title} (${events.length})\n${"-".repeat(title.length + 4)}\n${rows.join("\n\n")}`;
}

function renderHtmlEvent(event: EsgEventDto, baseUrl: string): string {
  const detailsUrl = escapeHtml(internalEventUrl(baseUrl, event.id));
  const officialLink = event.eventUrl
    ? `<a href="${escapeHtml(event.eventUrl)}" style="color:#176b4d;text-decoration:underline;">Official website</a>`
    : "";
  const summary = shortenedSummary(event.summary);
  return `
    <article style="padding:20px 0;border-top:1px solid #dce7e1;">
      <h3 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;font-weight:600;color:#15251e;">
        <a href="${detailsUrl}" style="color:#15251e;text-decoration:none;">${escapeHtml(event.name)}</a>
      </h3>
      <p style="margin:0;color:#54675e;font-size:14px;line-height:1.6;">${eventMeta(event).map(escapeHtml).join(" &nbsp;·&nbsp; ")}</p>
      ${summary ? `<p style="margin:10px 0 0;color:#42544b;font-size:14px;line-height:1.6;">${escapeHtml(summary)}</p>` : ""}
      <p style="margin:12px 0 0;font-size:14px;line-height:1.5;">
        <a href="${detailsUrl}" style="color:#176b4d;font-weight:700;text-decoration:underline;">View details</a>
        ${officialLink ? `&nbsp;&nbsp;&nbsp;${officialLink}` : ""}
      </p>
    </article>`;
}

function renderHtmlSection(
  title: string,
  eyebrow: string,
  events: ReadonlyArray<EsgEventDto>,
  baseUrl: string,
): string {
  if (events.length === 0) return "";
  return `
    <section style="margin-top:30px;">
      <p style="margin:0 0 5px;text-transform:uppercase;letter-spacing:0.14em;font-size:11px;font-weight:700;color:#8a641a;">${escapeHtml(eyebrow)}</p>
      <h2 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;color:#15251e;">${escapeHtml(title)} <span style="font-family:Arial,sans-serif;font-size:14px;color:#6b7e74;">(${events.length})</span></h2>
      ${events.map((event) => renderHtmlEvent(event, baseUrl)).join("")}
    </section>`;
}

export function renderEsgWeeklyDigest(args: RenderEsgWeeklyDigestArgs): EsgWeeklyDigestTemplate {
  const baseUrl = safePortalBaseUrl(args.portalBaseUrl);
  const online = args.events.filter((event) => event.attendanceMode === "online");
  const other = args.events.filter((event) => event.attendanceMode !== "online");
  const range = formatEsgWeeklyDigestRange(args.weekStart, args.weekEnd);
  const prefix = args.testMode ? "[TEST] " : "";
  const subject = `${prefix}ESG events this week — ${range}`;
  const eventsUrl = new URL("/esg/events", baseUrl).toString();

  const textSections = [
    renderTextSection("Online & webinars", online, baseUrl),
    renderTextSection("In person & hybrid", other, baseUrl),
  ].filter(Boolean);
  const emptyText = "No confirmed ESG events are scheduled for this week. We will check again next Monday.";
  const text = [
    subject,
    "",
    `Your confirmed ESG event schedule for ${range}. Events already in progress are included when they overlap this week.`,
    "",
    textSections.length ? textSections.join("\n\n") : emptyText,
    "",
    `Browse all ESG events: ${eventsUrl}`,
  ].join("\n");

  const htmlSections = [
    renderHtmlSection("Online & webinars", "Join from anywhere", online, baseUrl),
    renderHtmlSection("In person & hybrid", "On the agenda", other, baseUrl),
  ].filter(Boolean).join("");
  const emptyHtml = `
    <div style="margin:28px 0;padding:22px;border:1px solid #dce7e1;background:#f6faf8;border-radius:8px;">
      <p style="margin:0;color:#42544b;font-size:15px;line-height:1.6;">No confirmed ESG events are scheduled for this week. We will check again next Monday.</p>
    </div>`;
  const html = `<!doctype html>
  <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:#f2f5f3;color:#15251e;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;">Confirmed ESG events for ${escapeHtml(range)}.</div>
      <main style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #dce7e1;border-radius:10px;padding:34px 34px 28px;">
          ${args.testMode ? `<p style="margin:0 0 16px;padding:8px 12px;background:#fff4d6;color:#6d4f13;font-size:12px;font-weight:700;border-radius:5px;">TEST DELIVERY — production recipients were not used</p>` : ""}
          <p style="margin:0 0 8px;text-transform:uppercase;letter-spacing:0.16em;font-size:11px;font-weight:700;color:#176b4d;">ESG Event Ledger</p>
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:500;color:#15251e;">The week ahead</h1>
          <p style="margin:12px 0 0;color:#54675e;font-size:15px;line-height:1.6;">${escapeHtml(range)} · ${args.events.length} confirmed ${args.events.length === 1 ? "event" : "events"}</p>
          <p style="margin:8px 0 0;color:#6b7e74;font-size:13px;line-height:1.6;">Events already in progress are included when they overlap this week. Date TBC records are excluded.</p>
          ${htmlSections || emptyHtml}
          <p style="margin:30px 0 0;">
            <a href="${escapeHtml(eventsUrl)}" style="display:inline-block;padding:12px 18px;background:#176b4d;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">Browse all ESG events</a>
          </p>
          <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #dce7e1;color:#7a8b82;font-size:12px;line-height:1.6;">This weekly schedule is generated every Monday at 09:00 UAE time.</p>
        </div>
      </main>
    </body>
  </html>`;

  return { subject, text, html, onlineCount: online.length, otherCount: other.length };
}
