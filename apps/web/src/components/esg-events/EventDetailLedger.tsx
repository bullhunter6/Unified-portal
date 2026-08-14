import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Radio,
  Tag,
  Ticket,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { EventShareActions } from "./EventShareActions";
import type { EsgDetailEvent, EsgRelatedEvent, LedgerStatusTone } from "./types";

interface EventDetailLedgerProps {
  event: EsgDetailEvent;
  backHref: string;
  backLabel?: string;
  related?: EsgRelatedEvent[];
}

const statusClasses: Record<LedgerStatusTone, string> = {
  live: "border-emerald-600/30 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100",
  today: "border-amber-500/30 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
  progress: "border-amber-500/30 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
  upcoming: "border-border bg-muted text-foreground",
  past: "border-border bg-muted text-muted-foreground",
  tbc: "border-dashed border-border bg-background text-muted-foreground",
};

function DetailStatus({ tone, children }: { tone: LedgerStatusTone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em]",
        statusClasses[tone],
      )}
    >
      {tone === "live" ? <Radio className="h-3 w-3 motion-safe:animate-pulse" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function DetailFacts({ event }: { event: EsgDetailEvent }) {
  const facts = [
    {
      label: "Date",
      icon: CalendarDays,
      content: event.startDate ? (
        <>
          <time dateTime={event.startDate}>{event.dateLabel}</time>
          {event.endDate && event.endDate !== event.startDate ? (
            <time dateTime={event.endDate} className="sr-only"> through {event.endDate}</time>
          ) : null}
        </>
      ) : (
        event.dateLabel
      ),
    },
    {
      label: "Time",
      icon: Clock3,
      content: event.startDateTime ? (
        <>
          <time dateTime={event.startDateTime}>{event.timeLabel}</time>
          {event.endDateTime ? <time dateTime={event.endDateTime} className="sr-only"> until {event.endDateTime}</time> : null}
          {event.timezoneLabel ? <span> {event.timezoneLabel}</span> : null}
        </>
      ) : (
        <>{event.timeLabel}{event.timezoneLabel ? ` ${event.timezoneLabel}` : ""}</>
      ),
    },
    {
      label: "Location",
      icon: event.locationLabel.toLowerCase().includes("online") ? Globe2 : MapPin,
      content: (
        <address className="not-italic">
          <span className="block">{event.locationLabel}</span>
          {event.venueName && event.venueName !== event.locationLabel ? (
            <span className="mt-0.5 block text-muted-foreground">{event.venueName}</span>
          ) : null}
          {event.venueAddress ? (
            <span className="mt-0.5 block break-words text-muted-foreground">{event.venueAddress}</span>
          ) : null}
        </address>
      ),
    },
    {
      label: "Attendance",
      icon: UsersRound,
      content: event.attendanceLabel ?? "Format TBC",
    },
    {
      label: "Organizer",
      icon: Building2,
      content: event.organizer ?? "Organizer TBC",
    },
  ];

  return (
    <aside aria-label="Event essentials" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
        <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
          Event essentials
        </p>
        <dl className="divide-y divide-border">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 py-4 first:pt-0 last:pb-0">
                <dt className="col-span-2 grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <span>{fact.label}</span>
                </dt>
                <dd className="col-start-2 mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-foreground">
                  {fact.content}
                </dd>
              </div>
            );
          })}
        </dl>

        {event.officialUrl || event.ticketUrl ? (
          <div className="mt-5 space-y-2 border-t border-border pt-5">
            {event.officialUrl ? (
              <a
                href={event.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
              >
                Official website
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
            {event.ticketUrl ? (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Tickets or registration
                <Ticket className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function RelatedEvents({ events }: { events: EsgRelatedEvent[] }) {
  if (!events.length) return null;

  return (
    <section aria-labelledby="related-esg-events" className="border-t border-border pt-8">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
        Continue through the ledger
      </p>
      <h2
        id="related-esg-events"
        className="mt-1 text-3xl font-medium text-foreground"
        style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
      >
        Related events
      </h2>
      <ol className="mt-5 divide-y divide-border border-y border-border">
        {events.map((related, index) => (
          <li key={related.id}>
            <Link
              href={related.href}
              className="group grid min-h-20 min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-4 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span
                aria-hidden="true"
                className="text-xl tabular-nums text-muted-foreground"
                style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block break-words text-base font-semibold text-foreground transition-colors group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                  {related.title}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {related.dateLabel} · {related.locationLabel}
                  {related.statusLabel ? ` · ${related.statusLabel}` : ""}
                </span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-700"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EventDetailLedger({
  event,
  backHref,
  backLabel = "Back to the event ledger",
  related = [],
}: EventDetailLedgerProps) {
  const detailCopy = event.description || event.summary;

  return (
    <article className="min-w-0 bg-background text-foreground">
      <header className="relative isolate overflow-hidden border-b border-border bg-card">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_65%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>

          <div className={cn("mt-7 grid min-w-0 gap-8", event.media ? "lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center" : "")}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DetailStatus tone={event.statusTone}>{event.statusLabel}</DetailStatus>
                {event.source ? (
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{event.source}</span>
                ) : null}
              </div>
              <h1
                className="mt-4 max-w-5xl break-words text-balance text-4xl font-medium leading-[0.98] tracking-[-0.035em] sm:text-5xl lg:text-6xl"
                style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
              >
                {event.title}
              </h1>
              {event.summary ? (
                <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{event.summary}</p>
              ) : null}
              <div className="mt-6">
                <EventShareActions title={event.title} text={event.summary ?? undefined} />
              </div>
            </div>

            {event.media ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted p-2 shadow-sm [&_img]:aspect-[4/3] [&_img]:h-auto [&_img]:w-full [&_img]:rounded-lg [&_img]:object-cover">
                {event.media}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12 lg:px-8 lg:py-14">
        <div className="min-w-0">
          <section aria-labelledby="event-overview">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              The briefing
            </p>
            <h2
              id="event-overview"
              className="mt-1 text-3xl font-medium text-foreground"
              style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
            >
              About this event
            </h2>
            {detailCopy ? (
              <div className="mt-5 max-w-3xl whitespace-pre-line text-[0.96rem] leading-7 text-muted-foreground">
                {detailCopy}
              </div>
            ) : (
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                The organizer has not published a detailed event brief yet. Use the official website for the latest agenda.
              </p>
            )}
          </section>

          {event.tags?.length ? (
            <section aria-labelledby="event-topics" className="mt-9 border-t border-border pt-7">
              <h2 id="event-topics" className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-foreground">
                <Tag className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                Topics
              </h2>
              <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
                {event.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-12">
            <RelatedEvents events={related} />
          </div>
        </div>

        <DetailFacts event={event} />
      </div>
    </article>
  );
}
