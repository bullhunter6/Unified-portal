import Link from "next/link";
import {
  ArrowRight,
  CalendarOff,
  CalendarClock,
  Database,
  SearchX,
} from "lucide-react";

type EmptyVariant = "filtered" | "no-upcoming" | "date-tbc" | "no-data";

interface LedgerEmptyStateProps {
  variant: EmptyVariant;
  clearHref?: string;
  allEventsHref?: string;
}

const stateContent: Record<
  EmptyVariant,
  {
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof SearchX;
  }
> = {
  filtered: {
    eyebrow: "No matches",
    title: "The ledger has no entry for that combination.",
    description: "Try removing a location, source or attendance filter, or broaden the words in your search.",
    icon: SearchX,
  },
  "no-upcoming": {
    eyebrow: "Calendar pause",
    title: "No upcoming dates are confirmed yet.",
    description: "The archive remains available, and events without a confirmed date are kept in a separate view.",
    icon: CalendarOff,
  },
  "date-tbc": {
    eyebrow: "No unconfirmed dates",
    title: "Every event in this view has a date.",
    description: "There are currently no records waiting for a confirmed calendar date.",
    icon: CalendarClock,
  },
  "no-data": {
    eyebrow: "Ledger unavailable",
    title: "There are no ESG event records yet.",
    description: "Once verified event records are added, they will appear here in chronological order.",
    icon: Database,
  },
};

export function LedgerEmptyState({ variant, clearHref, allEventsHref }: LedgerEmptyStateProps) {
  const content = stateContent[variant];
  const Icon = content.icon;

  return (
    <section className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center sm:px-10 sm:py-16">
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-600 to-transparent"
      />
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-700/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-5 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
        {content.eyebrow}
      </p>
      <h2
        className="mx-auto mt-2 max-w-xl text-3xl font-medium leading-tight text-foreground"
        style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
      >
        {content.title}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{content.description}</p>

      {clearHref || allEventsHref ? (
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {clearHref ? (
            <Link
              href={clearHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
            >
              Clear filters
            </Link>
          ) : null}
          {allEventsHref ? (
            <Link
              href={allEventsHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Browse all events
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function EventAgendaSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section aria-label="Loading ESG events" aria-busy="true" className="min-w-0">
      <span className="sr-only">Loading events…</span>
      <div className="mb-6 border-b border-border pb-4">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-8 w-52 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="grid gap-4 border-b border-border py-7 first:pt-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6"
          >
            <div className="h-20 w-20 animate-pulse rounded-lg bg-muted" />
            <div className="min-w-0">
              <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              <div className="mt-4 h-8 w-11/12 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-3/5 animate-pulse rounded bg-muted" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-5 h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
