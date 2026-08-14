import { ArrowLeft, CalendarX2 } from "lucide-react";
import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="min-h-[70vh] overflow-x-clip bg-background px-4 py-16 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarX2 aria-hidden="true" className="h-6 w-6" />
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Entry unavailable
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-event-editorial)] text-3xl font-semibold tracking-tight sm:text-4xl">
          This event is not in the ledger
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
          It may have been removed, or the event address may be malformed. Browse the current ledger to find another event.
        </p>
        <Link
          href="/esg/events"
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to ESG events
        </Link>
      </div>
    </main>
  );
}
