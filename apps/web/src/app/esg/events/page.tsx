import {
  AppliedFilters,
  EventAgenda,
  EventFilters,
  EventPaginator,
  LedgerEmptyState,
  LedgerHero,
  TimeRail,
} from "@/components/esg-events";
import type {
  EsgAppliedFilter,
  EsgCountryChoice,
  EsgPageLink,
  EsgTimeOption,
} from "@/components/esg-events/types";
import {
  createEsgRequestClock,
  parseEsgEventSearchParams,
  type EsgEventFilters,
} from "@/lib/esg-events";
import { listEsgEvents } from "@/lib/esg-events/repository";
import { buildEsgEventsUrl, updateEsgEventFilters } from "@/lib/esg-events/urls";
import { redirect } from "next/navigation";
import {
  formatMonthLabel,
  toAgendaEvent,
} from "./_presentation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventSearchParams = Record<string, string | string[] | undefined>;
type DiscoveryFilter = "q" | "country" | "city" | "format" | "source";

function urlWithoutFilter(filters: EsgEventFilters, key: DiscoveryFilter): string {
  const next = { ...filters, page: 1 };
  delete next[key];
  if (key === "country") delete next.city;
  return buildEsgEventsUrl(next);
}

function urlForPage(filters: EsgEventFilters, page: number): string {
  return buildEsgEventsUrl({ ...filters, page });
}

function pageLinks(filters: EsgEventFilters, totalPages: number): EsgPageLink[] {
  const pages = new Set([1, totalPages]);
  for (let page = Math.max(1, filters.page - 2); page <= Math.min(totalPages, filters.page + 2); page += 1) {
    pages.add(page);
  }
  return Array.from(pages)
    .sort((a, b) => a - b)
    .map((page) => ({ page, href: urlForPage(filters, page) }));
}

function timeOption(
  filters: EsgEventFilters,
  value: EsgEventFilters["when"],
  label: string,
  count?: number,
): EsgTimeOption {
  return {
    value,
    label,
    href: buildEsgEventsUrl(updateEsgEventFilters(filters, { when: value })),
    description: typeof count === "number" ? `${count.toLocaleString("en")} events` : undefined,
  };
}

function headingForWhen(when: EsgEventFilters["when"]): string {
  switch (when) {
    case "upcoming":
      return "Upcoming events";
    case "week":
      return "This week";
    case "past":
      return "Past events";
    case "tbc":
      return "Dates to be confirmed";
    case "all":
      return "All events";
    default:
      return formatMonthLabel(when);
  }
}

export default async function EsgEventsPage({
  searchParams,
}: {
  searchParams: Promise<EventSearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const requestClock = createEsgRequestClock(new Date());
  const parsed = parseEsgEventSearchParams(rawSearchParams, { now: requestClock.now });

  if (parsed.needsRedirect) {
    redirect(parsed.canonicalSearch ? `/esg/events?${parsed.canonicalSearch}` : "/esg/events");
  }

  const result = await listEsgEvents(parsed.filters, requestClock);
  if (parsed.filters.page > result.totalPages) {
    redirect(urlForPage(parsed.filters, result.totalPages));
  }

  const filters = parsed.filters;
  const quickCounts = new Map(result.facets.time.map((facet) => [facet.value, facet.count]));
  const forwardMonths = result.facets.months
    .filter((month) => month.value >= requestClock.currentMonth)
    .slice(0, 3);
  const selectedMonth = /^\d{4}-\d{2}$/.test(filters.when)
    ? result.facets.months.find((month) => month.value === filters.when)
    : undefined;
  const railMonths = selectedMonth && !forwardMonths.some((month) => month.value === selectedMonth.value)
    ? [selectedMonth, ...forwardMonths]
    : forwardMonths;
  const quickOptions: EsgTimeOption[] = [
    timeOption(filters, "upcoming", "Upcoming", quickCounts.get("upcoming")),
    timeOption(filters, "week", "This week", quickCounts.get("week")),
    ...railMonths.map((month) => timeOption(filters, month.value as EsgEventFilters["when"], month.label, month.count)),
    timeOption(filters, "past", "Past", quickCounts.get("past")),
    timeOption(filters, "tbc", "Date TBC", quickCounts.get("tbc")),
    timeOption(filters, "all", "All", quickCounts.get("all")),
  ];
  const monthOptions = result.facets.months.map((month) => ({
    ...timeOption(filters, month.value as EsgEventFilters["when"], month.label, month.count),
    group: "month" as const,
  }));

  const countries: EsgCountryChoice[] = result.facets.countries.map((country) => ({
    ...country,
    cities: (result.facets.citiesByCountry[country.value] ?? []).map((city) => ({ ...city })),
  }));
  const activeFilterCount = (["q", "country", "city", "format", "source"] as const)
    .filter((key) => Boolean(filters[key])).length;
  const clearFilters: EsgEventFilters = { when: filters.when, page: 1 };
  const clearHref = buildEsgEventsUrl(clearFilters);

  const appliedFilters: EsgAppliedFilter[] = [];
  if (filters.q) {
    appliedFilters.push({ key: "q", label: "Search", value: filters.q, removeHref: urlWithoutFilter(filters, "q") });
  }
  if (filters.country) {
    const label = countries.find((country) => country.value === filters.country)?.label ?? filters.country;
    appliedFilters.push({ key: "country", label: "Country", value: label, removeHref: urlWithoutFilter(filters, "country") });
  }
  if (filters.city) {
    appliedFilters.push({ key: "city", label: "City", value: filters.city, removeHref: urlWithoutFilter(filters, "city") });
  }
  if (filters.format) {
    const label = result.facets.formats.find((format) => format.value === filters.format)?.label ?? filters.format;
    appliedFilters.push({ key: "format", label: "Attendance", value: label, removeHref: urlWithoutFilter(filters, "format") });
  }
  if (filters.source) {
    appliedFilters.push({ key: "source", label: "Source", value: filters.source, removeHref: urlWithoutFilter(filters, "source") });
  }

  const allCount = quickCounts.get("all") ?? 0;
  const emptyVariant = activeFilterCount > 0
    ? "filtered"
    : filters.when === "upcoming" && allCount > 0
      ? "no-upcoming"
      : filters.when === "tbc" && allCount > 0
        ? "date-tbc"
        : allCount === 0
          ? "no-data"
          : "filtered";
  const allEventsHref = buildEsgEventsUrl({ ...filters, when: "all", page: 1 });
  const agendaEvents = result.items.map((event) => toAgendaEvent(event, filters));
  const rangeStart = result.total ? (filters.page - 1) * result.pageSize + 1 : 0;
  const rangeEnd = Math.min(result.total, filters.page * result.pageSize);
  const resultDescription = result.total
    ? `Showing ${rangeStart.toLocaleString("en")}–${rangeEnd.toLocaleString("en")} of ${result.total.toLocaleString("en")}`
    : "No matching entries";

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LedgerHero
        summary={{
          upcoming: result.summary.upcoming,
          thisMonth: result.summary.thisMonth,
          countries: result.summary.representedCountries,
        }}
        asOfLabel={`As of ${new Intl.DateTimeFormat("en", {
          timeZone: "Asia/Dubai",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(requestClock.now)} · Dubai time`}
      />
      <TimeRail
        options={quickOptions}
        monthOptions={monthOptions}
        currentValue={filters.when}
        allMonthsHref={buildEsgEventsUrl(updateEsgEventFilters(filters, { when: "all" }))}
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <AppliedFilters filters={appliedFilters} clearHref={clearHref} />
        <div className="mt-5 flex min-w-0 flex-col gap-7 lg:flex-row lg:items-start lg:gap-9">
          <EventFilters
            state={{
              q: filters.q ?? "",
              country: filters.country ?? "",
              city: filters.city ?? "",
              format: filters.format ?? "",
              source: filters.source ?? "",
              when: filters.when,
            }}
            countries={countries}
            formats={result.facets.formats.map((format) => ({ ...format }))}
            sources={result.facets.sources.map((source) => ({ ...source }))}
            activeFilterCount={activeFilterCount}
            clearHref={clearHref}
            resultCount={result.total}
          />

          <div className="min-w-0 flex-1">
            {agendaEvents.length ? (
              <>
                <EventAgenda
                  events={agendaEvents}
                  heading={headingForWhen(filters.when)}
                  resultDescription={resultDescription}
                />
                <EventPaginator
                  page={filters.page}
                  totalPages={result.totalPages}
                  total={result.total}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  previousHref={filters.page > 1 ? urlForPage(filters, filters.page - 1) : undefined}
                  nextHref={filters.page < result.totalPages ? urlForPage(filters, filters.page + 1) : undefined}
                  pageLinks={pageLinks(filters, result.totalPages)}
                />
              </>
            ) : (
              <LedgerEmptyState
                variant={emptyVariant}
                clearHref={activeFilterCount ? clearHref : undefined}
                allEventsHref={allEventsHref}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
