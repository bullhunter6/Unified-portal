import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Radio,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { EsgAgendaEvent, LedgerStatusTone } from "./types";

interface EventAgendaProps {
  events: EsgAgendaEvent[];
  heading?: string;
  resultDescription?: string;
}

const statusClasses: Record<LedgerStatusTone, string> = {
  live: "border-emerald-600/30 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100",
  today: "border-amber-500/30 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
  progress: "border-amber-500/30 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100",
  upcoming: "border-border bg-muted text-foreground",
  past: "border-border bg-muted text-muted-foreground",
  tbc: "border-dashed border-border bg-background text-muted-foreground",
};

function EventDate({ event }: { event: EsgAgendaEvent }) {
  const content = (
    <>
      <span className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-300">
        {event.dateMonth}
      </span>
      <span
        className="text-3xl font-medium leading-none tabular-nums text-foreground"
        style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
      >
        {event.dateDay}
      </span>
      <span className="text-[0.63rem] font-semibold text-muted-foreground">{event.dateYear}</span>
    </>
  );

  return (
    <div className="relative z-10 flex min-w-16 shrink-0 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm sm:min-h-[5rem] sm:w-20 sm:flex-col sm:justify-center sm:gap-0 sm:px-1">
      {event.startDate ? <time dateTime={event.startDate} className="contents">{content}</time> : content}
    </div>
  );
}

function LocationIcon({ label }: { label: string }) {
  return label.toLowerCase().includes("online") ? (
    <Globe2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  ) : (
    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  );
}

export function AgendaEventRow({ event }: { event: EsgAgendaEvent }) {
  return (
    <article
      aria-labelledby={`esg-event-${event.id}`}
      className="group relative grid min-w-0 gap-4 border-b border-border py-6 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6 sm:py-8"
    >
      <EventDate event={event} />

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.68rem] font-bold uppercase tracking-[0.1em]",
              statusClasses[event.statusTone],
            )}
          >
            {event.statusTone === "live" ? (
              <Radio className="h-3 w-3 motion-safe:animate-pulse" aria-hidden="true" />
            ) : null}
            {event.statusLabel}
          </span>
          {event.attendanceLabel ? (
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {event.attendanceLabel}
            </span>
          ) : null}
        </div>

        <h3
          id={`esg-event-${event.id}`}
          className="mt-3 max-w-4xl break-words text-2xl font-medium leading-[1.08] tracking-[-0.018em] text-foreground sm:text-[1.8rem]"
          style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
        >
          <Link
            href={event.detailHref}
            className="decoration-emerald-600/40 decoration-1 underline-offset-4 transition-colors hover:text-emerald-800 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-emerald-300"
          >
            {event.title}
          </Link>
        </h3>

        <div className="mt-4 grid min-w-0 gap-2 text-sm leading-5 text-muted-foreground md:grid-cols-2">
          <p className="flex min-w-0 items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <span className="min-w-0">
              <span className="font-semibold text-foreground">{event.dateLabel}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              {event.startDateTime ? <time dateTime={event.startDateTime}>{event.timeLabel}</time> : event.timeLabel}
              {event.timezoneLabel ? ` ${event.timezoneLabel}` : ""}
            </span>
          </p>
          <p className="flex min-w-0 items-start gap-2">
            <LocationIcon label={event.locationLabel} />
            <span className="min-w-0 break-words">
              <span className="font-semibold text-foreground">{event.locationLabel}</span>
              {event.venueName && event.venueName !== event.locationLabel ? ` — ${event.venueName}` : ""}
            </span>
          </p>
          {event.venueAddress ? (
            <p className="flex min-w-0 items-start gap-2 md:col-start-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{event.venueAddress}</span>
            </p>
          ) : null}
        </div>

        {event.summary ? (
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
            {event.summary}
          </p>
        ) : null}

        <footer className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            {event.organizer ? (
              <>
                <span className="font-semibold text-foreground">Organized by</span> {event.organizer}
              </>
            ) : event.source ? (
              <>
                <span className="font-semibold text-foreground">Source</span> {event.source}
              </>
            ) : (
              "Event source not listed"
            )}
            {event.organizer && event.source && event.organizer !== event.source ? (
              <span className="ml-2 border-l border-border pl-2">Source: {event.source}</span>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center gap-1">
            {event.officialUrl ? (
              <a
                href={event.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Official website
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
            <Link
              href={event.detailHref}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              View details
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </footer>
      </div>
    </article>
  );
}

export function EventAgenda({ events, heading = "Event agenda", resultDescription }: EventAgendaProps) {
  return (
    <section className="min-w-0" aria-labelledby="esg-event-agenda-title">
      <div className="mb-6 flex min-w-0 items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Curated chronology
          </p>
          <h2
            id="esg-event-agenda-title"
            className="mt-1 text-3xl font-medium leading-none text-foreground"
            style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
          >
            {heading}
          </h2>
        </div>
        {resultDescription ? (
          <p className="max-w-[14rem] text-right text-xs leading-5 text-muted-foreground" aria-live="polite">
            {resultDescription}
          </p>
        ) : null}
      </div>

      <div className="relative min-w-0">
        <span
          aria-hidden="true"
          className="absolute bottom-10 left-[2.475rem] top-10 hidden w-px bg-gradient-to-b from-emerald-600/50 via-border to-transparent sm:block"
        />
        <ol className="min-w-0 list-none p-0">
          {events.map((event) => (
            <li key={event.id} className="min-w-0">
              <AgendaEventRow event={event} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
