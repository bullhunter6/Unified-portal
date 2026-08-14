"use client";

import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { EsgCountryChoice, EsgFilterChoice, EsgFilterState } from "./types";

interface EventFiltersProps {
  action?: string;
  state: EsgFilterState;
  countries: EsgCountryChoice[];
  formats: EsgFilterChoice[];
  sources: EsgFilterChoice[];
  activeFilterCount: number;
  clearHref: string;
  resultCount?: number;
}

interface FilterFormProps extends EventFiltersProps {
  idPrefix: string;
}

function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: EsgFilterChoice[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={value ? name : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="min-h-11 w-full appearance-none rounded-lg border border-input bg-background py-2 pl-3 pr-9 text-sm text-foreground outline-none transition-colors hover:border-emerald-600/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}{typeof option.count === "number" ? ` (${option.count})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}

function FilterForm(props: FilterFormProps) {
  const { action = "/esg/events", state, countries, formats, sources, clearHref, idPrefix, resultCount } = props;
  const [query, setQuery] = useState(state.q);
  const [country, setCountry] = useState(state.country);
  const [city, setCity] = useState(state.city);
  const [format, setFormat] = useState(state.format);
  const [source, setSource] = useState(state.source);

  useEffect(() => {
    setQuery(state.q);
    setCountry(state.country);
    setCity(state.city);
    setFormat(state.format);
    setSource(state.source);
  }, [state.city, state.country, state.format, state.q, state.source]);

  const cityOptions = useMemo(
    () => countries.find((option) => option.value === country)?.cities ?? [],
    [countries, country],
  );

  return (
    <form action={action} method="get" className="space-y-5">
      {state.when && state.when !== "upcoming" ? <input type="hidden" name="when" value={state.when} /> : null}

      <div>
        <label
          htmlFor={`${idPrefix}-event-search`}
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground"
        >
          Search the ledger
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={`${idPrefix}-event-search`}
            type="search"
            name={query ? "q" : undefined}
            maxLength={160}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Topic, organizer, venue…"
            className="min-h-11 w-full rounded-lg border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search draft"
              className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <SelectField
        id={`${idPrefix}-event-format`}
        name="format"
        label="Attendance"
        value={format}
        onChange={setFormat}
        options={formats}
        placeholder="All formats"
      />

      <SelectField
        id={`${idPrefix}-event-country`}
        name="country"
        label="Country"
        value={country}
        onChange={(nextCountry) => {
          setCountry(nextCountry);
          setCity("");
        }}
        options={countries}
        placeholder="All countries"
      />

      <SelectField
        id={`${idPrefix}-event-city`}
        name="city"
        label="City"
        value={city}
        onChange={setCity}
        options={cityOptions}
        placeholder={country ? "All cities" : "Choose a country first"}
        disabled={!country}
      />

      <SelectField
        id={`${idPrefix}-event-source`}
        name="source"
        label="Source"
        value={source}
        onChange={setSource}
        options={sources}
        placeholder="All sources"
      />

      <div className="space-y-2 border-t border-border pt-5">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Apply filters
        </button>
        <Link
          href={clearHref}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Clear filters
        </Link>
      </div>

      {typeof resultCount === "number" ? (
        <p className="text-center text-xs leading-5 text-muted-foreground" aria-live="polite">
          {resultCount.toLocaleString("en")} {resultCount === 1 ? "event matches" : "events match"} the applied filters
        </p>
      ) : null}
    </form>
  );
}

export function EventFilters(props: EventFiltersProps) {
  return (
    <>
      <details className="group rounded-xl border border-border bg-card lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            Filters{props.activeFilterCount ? ` (${props.activeFilterCount})` : ""}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border p-4">
          <FilterForm {...props} idPrefix="mobile" />
        </div>
      </details>

      <aside className="hidden w-[17.5rem] shrink-0 lg:block" aria-label="Event filters">
        <div className="sticky top-24 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
            <h2
              className="text-xl font-medium text-foreground"
              style={{ fontFamily: "var(--font-event-editorial), Georgia, serif" }}
            >
              Refine the ledger
            </h2>
            {props.activeFilterCount ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs font-bold text-white dark:bg-emerald-400 dark:text-black">
                {props.activeFilterCount}
                <span className="sr-only"> applied filters</span>
              </span>
            ) : null}
          </div>
          <FilterForm {...props} idPrefix="desktop" />
        </div>
      </aside>
    </>
  );
}
