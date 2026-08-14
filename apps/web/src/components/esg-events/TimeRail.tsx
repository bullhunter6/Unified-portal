"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { EsgTimeOption } from "./types";

interface TimeRailProps {
  options: EsgTimeOption[];
  monthOptions: EsgTimeOption[];
  currentValue: string;
  allMonthsHref: string;
  label?: string;
}

export function TimeRail({
  options,
  monthOptions,
  currentValue,
  allMonthsHref,
  label = "Browse by date",
}: TimeRailProps) {
  const [interactive, setInteractive] = useState(false);
  const currentMonth = monthOptions.find((option) => option.value === currentValue);

  useEffect(() => {
    setInteractive(true);
  }, []);

  const navigateToMonth = (value: string) => {
    const target = monthOptions.find((option) => option.value === value);
    window.location.assign(target?.href ?? allMonthsHref);
  };

  return (
    <section className="border-b border-border bg-background" aria-labelledby="esg-time-rail-title">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <h2
          id="esg-time-rail-title"
          className="hidden shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:block"
        >
          {label}
        </h2>
        <span className="hidden h-5 w-px bg-border lg:block" aria-hidden="true" />

        <nav
          aria-label="Event time period"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max items-center gap-1.5 pr-2">
            {options.map((option) => {
              const active = option.value === currentValue || (!currentValue && option.value === "upcoming");
              return (
                <a
                  key={option.value}
                  href={option.href}
                  aria-current={active ? "page" : undefined}
                  title={option.description}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-black"
                      : "border-border bg-card text-foreground hover:border-emerald-600/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                  )}
                >
                  {option.label}
                </a>
              );
            })}
          </div>
        </nav>

        {monthOptions.length ? (
          <div className="relative hidden shrink-0 sm:block">
            <CalendarDays
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor="esg-ledger-month" className="sr-only">
              Choose any event month
            </label>
            <select
              id="esg-ledger-month"
              value={currentMonth?.value ?? ""}
              onChange={(event) => navigateToMonth(event.target.value)}
              disabled={!interactive}
              aria-busy={!interactive}
              className="min-h-11 max-w-[12rem] appearance-none rounded-full border border-border bg-card py-2 pl-9 pr-9 text-sm font-semibold text-foreground outline-none transition-colors hover:border-emerald-600/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              <option value="">All months</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        ) : null}
      </div>

      {monthOptions.length ? (
        <div className="border-t border-border/70 px-4 py-2 sm:hidden">
          <label htmlFor="esg-ledger-month-mobile" className="sr-only">
            Choose any event month
          </label>
          <div className="relative">
            <CalendarDays
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              id="esg-ledger-month-mobile"
              value={currentMonth?.value ?? ""}
              onChange={(event) => navigateToMonth(event.target.value)}
              disabled={!interactive}
              aria-busy={!interactive}
              className="min-h-11 w-full appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-9 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
            >
              <option value="">Complete month calendar</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
