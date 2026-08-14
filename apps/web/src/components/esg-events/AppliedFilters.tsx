import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";

import type { EsgAppliedFilter } from "./types";

interface AppliedFiltersProps {
  filters: EsgAppliedFilter[];
  clearHref: string;
}

export function AppliedFilters({ filters, clearHref }: AppliedFiltersProps) {
  if (!filters.length) return null;

  return (
    <section aria-label="Applied filters" className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Applied
      </span>
      {filters.map((filter) => (
        <Link
          key={filter.key}
          href={filter.removeHref}
          aria-label={`Remove ${filter.label} filter: ${filter.value}`}
          className="group inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 transition-colors hover:border-emerald-700/50 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70"
        >
          {filter.key === "q" ? <Search className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
          <span className="truncate">
            {filter.label}: {filter.value}
          </span>
          <X className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
        </Link>
      ))}
      <Link
        href={clearHref}
        className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
      >
        Clear all
      </Link>
    </section>
  );
}
