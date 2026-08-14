"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ESG events route failed", error);
  }, [error]);

  return (
    <main className="min-h-[70vh] bg-background px-4 py-16 text-foreground sm:px-6">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <AlertTriangle aria-hidden="true" className="h-6 w-6" />
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          ESG Event Ledger
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-event-editorial)] text-3xl font-semibold tracking-tight sm:text-4xl">
          The ledger could not be opened
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          The events service is temporarily unavailable. Your filters are still in the address bar, so it is safe to try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      </div>
    </main>
  );
}
