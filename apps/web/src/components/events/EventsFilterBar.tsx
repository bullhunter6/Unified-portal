"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, Filter, X, Grid3x3, List, Calendar } from "lucide-react";

export default function EventsFilterBar({ 
  sources, 
  domain 
}: { 
  sources: string[]; 
  domain: "esg" | "credit";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedSource, setSelectedSource] = useState(searchParams.get("source") ?? "");
  const [viewMode, setViewMode] = useState(searchParams.get("view") ?? "grid");
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters
  const handleApplyFilters = () => {
    const params = new URLSearchParams(searchParams);
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    if (selectedSource) {
      params.set("source", selectedSource);
    } else {
      params.delete("source");
    }
    router.push(`/${domain}/events?${params.toString()}`);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setQuery("");
    setSelectedSource("");
    const params = new URLSearchParams();
    if (viewMode !== 'grid') params.set("view", viewMode);
    router.push(`/${domain}/events${params.toString() ? '?' + params.toString() : ''}`);
  };

  // Toggle view mode
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams);
    if (mode === 'grid') {
      params.delete('view');
    } else {
      params.set('view', mode);
    }
    router.push(`/${domain}/events${params.toString() ? '?' + params.toString() : ''}`);
  };

  // Check if any filters are active
  const hasActiveFilters = query.trim() || selectedSource;

  // Handle Enter key in search input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyFilters();
    }
  };

  return (
    <div className="sticky top-20 z-40 mb-8 rounded-2xl glass border-[var(--border)] p-4 shadow-lg backdrop-blur-xl">
      <div className="space-y-4">
        {/* Search and main controls */}
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search events by title, location, or organizer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm focus-ring focus:border-[var(--brand)] transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="hidden md:flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`rounded-md p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
              title="Grid view"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`rounded-md p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--brand)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn px-4 py-2.5 transition-all ${
              showFilters 
                ? 'bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)]' 
                : 'btn-secondary'
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline ml-2">Filters</span>
            {hasActiveFilters && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
                {(query.trim() ? 1 : 0) + (selectedSource ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Apply button */}
          <button
            onClick={handleApplyFilters}
            className="btn btn-primary px-6 py-2.5 transition-all hover:shadow-lg"
          >
            Apply
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="btn btn-secondary px-4 py-2.5 text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
              title="Clear all filters"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="grid gap-4 pt-4 border-t border-[var(--border-muted)] sm:grid-cols-2">
            {/* Source filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                Source
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 px-3 text-sm focus-ring focus:border-[var(--brand)]"
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {/* Date filter placeholder */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text)]">
                Date Range
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 px-3 text-sm focus-ring focus:border-[var(--brand)]"
                defaultValue=""
              >
                <option value="">All dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="this-week">This week</option>
                <option value="this-month">This month</option>
                <option value="past">Past events</option>
              </select>
            </div>
          </div>
        )}

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-muted)]">
            {query.trim() && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-medium text-[var(--brand)]">
                <Search size={12} />
                <span>&quot;{query.trim()}&quot;</span>
                <button
                  onClick={() => {
                    setQuery("");
                    const params = new URLSearchParams();
                    if (selectedSource) params.set("source", selectedSource);
                    router.push(`/${domain}/events?${params.toString()}`);
                  }}
                  className="ml-1 hover:bg-[var(--brand)]/20 rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            
            {selectedSource && (
              <div className="flex items-center gap-1 rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs font-medium text-[var(--brand)]">
                <Filter size={12} />
                <span>{selectedSource}</span>
                <button
                  onClick={() => {
                    setSelectedSource("");
                    const params = new URLSearchParams();
                    if (query.trim()) params.set("q", query.trim());
                    router.push(`/${domain}/events?${params.toString()}`);
                  }}
                  className="ml-1 hover:bg-[var(--brand)]/20 rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}