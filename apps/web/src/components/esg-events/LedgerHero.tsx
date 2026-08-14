import { CalendarRange, Globe2, MoveDown } from "lucide-react";

import type { EsgLedgerSummary } from "./types";

interface LedgerHeroProps {
  summary: EsgLedgerSummary;
  eyebrow?: string;
  title?: string;
  description?: string;
  asOfLabel?: string;
}

const numberFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

export function LedgerHero({
  summary,
  eyebrow = "ESG intelligence / global calendar",
  title = "The ESG Event Ledger",
  description = "A working calendar of the conferences, briefings and forums shaping environmental, social and governance practice.",
  asOfLabel,
}: LedgerHeroProps) {
  const metrics = [
    { label: "Upcoming", value: summary.upcoming, detail: "full calendar" },
    { label: "This month", value: summary.thisMonth, detail: "full calendar" },
    { label: "Countries", value: summary.countries, detail: "mapped locations" },
  ];

  return (
    <header className="relative isolate overflow-hidden border-b border-border bg-card text-card-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_68%)]"
      />
      <div className="relative mx-auto grid w-full max-w-7xl gap-7 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            <span className="h-px w-8 bg-emerald-500" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1
            className="max-w-3xl text-balance text-4xl font-medium leading-[0.96] tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[3.6rem]"
            style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
          >
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
          {asOfLabel ? (
            <p className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
              {asOfLabel}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 divide-x divide-border border-y border-border lg:min-w-[29rem]">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 px-3 py-4 first:pl-0 sm:px-5 lg:first:pl-5">
              <dt className="truncate text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </dt>
              <dd
                className="mt-1 text-3xl leading-none tabular-nums text-foreground sm:text-4xl"
                style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
              >
                {numberFormatter.format(metric.value)}
                <span className="mt-1 hidden font-[family-name:var(--font-event-sans)] text-[0.67rem] font-normal leading-4 text-muted-foreground sm:block">
                  {metric.detail}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="absolute bottom-2 right-4 hidden items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:flex">
        Browse the ledger
        <MoveDown className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <Globe2
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 stroke-[0.7] text-emerald-800/10 dark:text-emerald-200/10"
      />
    </header>
  );
}
