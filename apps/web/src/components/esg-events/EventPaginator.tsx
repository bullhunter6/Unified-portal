import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { EsgPageLink } from "./types";

interface EventPaginatorProps {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  previousHref?: string;
  nextHref?: string;
  pageLinks: EsgPageLink[];
}

function DirectionLink({
  href,
  direction,
}: {
  href?: string;
  direction: "previous" | "next";
}) {
  const previous = direction === "previous";
  const label = previous ? "Previous" : "Next";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground opacity-45"
      >
        {previous ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : null}
        {label}
        {!previous ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={previous ? "prev" : "next"}
      aria-label={`${label} page`}
      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-emerald-600/50 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-emerald-950/30"
    >
      {previous ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : null}
      {label}
      {!previous ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Link>
  );
}

export function EventPaginator({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  previousHref,
  nextHref,
  pageLinks,
}: EventPaginatorProps) {
  if (totalPages <= 1) return null;

  const sequence: Array<EsgPageLink | "ellipsis"> = [];
  let previousPage = 0;
  for (const link of [...pageLinks].sort((a, b) => a.page - b.page)) {
    if (previousPage && link.page - previousPage > 1) sequence.push("ellipsis");
    sequence.push(link);
    previousPage = link.page;
  }

  return (
    <nav aria-label="Event pages" className="mt-8 border-t border-border pt-5">
      <p className="mb-4 text-center text-xs text-muted-foreground sm:text-left">
        Showing {rangeStart.toLocaleString("en")}–{rangeEnd.toLocaleString("en")} of {total.toLocaleString("en")} events
      </p>

      <div className="flex items-center justify-between gap-2 sm:hidden">
        <DirectionLink href={previousHref} direction="previous" />
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
          Page {page} of {totalPages}
        </span>
        <DirectionLink href={nextHref} direction="next" />
      </div>

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <DirectionLink href={previousHref} direction="previous" />
        <div className="flex items-center justify-center gap-1">
          {sequence.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="inline-flex h-11 min-w-8 items-center justify-center text-muted-foreground">
                <span aria-hidden="true">…</span>
                <span className="sr-only">More pages</span>
              </span>
            ) : (
              <Link
                key={item.page}
                href={item.href}
                aria-label={`Page ${item.page}`}
                aria-current={item.page === page ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  item.page === page
                    ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-black"
                    : "border-transparent text-foreground hover:border-border hover:bg-muted",
                )}
              >
                {item.page}
              </Link>
            ),
          )}
        </div>
        <DirectionLink href={nextHref} direction="next" />
      </div>
    </nav>
  );
}
