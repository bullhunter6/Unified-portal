// src/app/[domain]/events/page.tsx
import { listEvents, getEventSources, eventRowToListItem } from "@/lib/events";
import EventCard from "@/components/events/EventCard";
import EventsFilterBar from "@/components/events/EventsFilterBar";
import EventsPaginator from "@/components/events/EventsPaginator";
import EmptyResult from "@/components/ui/empty-result";
import { Calendar, Sparkles, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: { domain: "esg" | "credit" };
  searchParams: { page?: string; pageSize?: string; view?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.pageSize ?? "20")));
  const viewMode = searchParams.view || "grid"; // grid or list

  const sources = await getEventSources(params.domain);
  const { rows, total } = await listEvents({
    domain: params.domain,
    page,
    pageSize,
  });

  // Convert rows to EventListItem format FIRST, then serialize
  const events = rows.map(eventRowToListItem);
  
  // Convert Date objects to strings to prevent React rendering errors
  // Using JSON serialization to safely convert all Date objects to ISO strings
  const serializedEvents = JSON.parse(JSON.stringify(events));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Categorize events by time status
  const now = new Date();
  const categorizedEvents = {
    happening: serializedEvents.filter((e: any) => {
      // For credit domain: single date field
      if (e.date) {
        const eventDate = new Date(e.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay.getTime() === today.getTime();
      }
      // For ESG domain: start_date and end_date
      const start = e.start_date ? new Date(e.start_date) : null;
      const end = e.end_date ? new Date(e.end_date) : null;
      if (start && end) {
        return start <= now && end >= now;
      }
      if (start) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        return eventDay.getTime() === today.getTime();
      }
      return false;
    }),
    upcoming: serializedEvents.filter((e: any) => {
      // For credit domain: single date field
      if (e.date) {
        const eventDate = new Date(e.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay > today;
      }
      // For ESG domain: start_date
      const start = e.start_date ? new Date(e.start_date) : null;
      if (start) {
        return start > now;
      }
      return true; // Default to upcoming if no date
    }),
    past: serializedEvents.filter((e: any) => {
      // For credit domain: single date field
      if (e.date) {
        const eventDate = new Date(e.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay < today;
      }
      // For ESG domain: end_date
      const end = e.end_date ? new Date(e.end_date) : null;
      if (end) {
        return end < now;
      }
      return false;
    }),
  };

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Hero Header */}
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-[var(--brand)]/10 via-[var(--brand)]/5 to-transparent p-8 backdrop-blur-sm border border-[var(--border)]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-xl bg-[var(--brand)]/10 p-3">
                <Calendar className="h-6 w-6 text-[var(--brand)]" />
              </div>
              <h1 className="text-4xl font-bold text-[var(--text)]">
                {params.domain.toUpperCase()} Events
              </h1>
            </div>
            <p className="text-lg text-[var(--text-muted)] max-w-2xl">
              Discover upcoming conferences, workshops, and industry gatherings. Stay connected with the latest events in {params.domain === 'esg' ? 'ESG, sustainability, and corporate responsibility' : 'credit markets, fixed income, and financial services'}.
            </p>
          </div>
          
          {/* Stats Cards */}
          <div className="hidden lg:flex gap-4">
            <div className="glass rounded-2xl border border-[var(--border)] p-4 min-w-[140px]">
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm mb-1">
                <TrendingUp size={14} />
                <span>Total Events</span>
              </div>
              <div className="text-3xl font-bold text-[var(--text)]">{total}</div>
            </div>
            {categorizedEvents.happening.length > 0 && (
              <div className="glass rounded-2xl border border-green-500/20 bg-green-500/5 p-4 min-w-[140px]">
                <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                  <Sparkles size={14} />
                  <span>Live Now</span>
                </div>
                <div className="text-3xl font-bold text-green-600">{categorizedEvents.happening.length}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Filter Bar */}
        <EventsFilterBar sources={sources} domain={params.domain} />
        
        {serializedEvents.length === 0 ? (
          <EmptyResult
            title="No events found"
            description="We couldn't find any events matching your criteria. Try adjusting your filters or check back later for new events."
          />
        ) : (
          <>
            {/* Live Events Section */}
            {categorizedEvents.happening.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-green-100 dark:bg-green-900/20 px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      Happening Now
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-[var(--border)]"></div>
                </div>
                <div className={viewMode === 'list' ? 'space-y-4' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                  {categorizedEvents.happening.map((e: any) => (
                    <EventCard 
                      key={`${params.domain}-happening-${e.id}`} 
                      e={e}
                      viewMode={viewMode as 'grid' | 'list'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Events Section */}
            {categorizedEvents.upcoming.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-[var(--text)]">
                    Upcoming Events
                  </h2>
                  <div className="h-px flex-1 bg-[var(--border)]"></div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {categorizedEvents.upcoming.length} event{categorizedEvents.upcoming.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={viewMode === 'list' ? 'space-y-4' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                  {categorizedEvents.upcoming.map((e: any) => (
                    <EventCard 
                      key={`${params.domain}-upcoming-${e.id}`} 
                      e={e}
                      viewMode={viewMode as 'grid' | 'list'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Events Section */}
            {categorizedEvents.past.length > 0 && (
              <div className="space-y-4 opacity-60">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-[var(--text-muted)]">
                    Past Events
                  </h2>
                  <div className="h-px flex-1 bg-[var(--border)]"></div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {categorizedEvents.past.length} event{categorizedEvents.past.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={viewMode === 'list' ? 'space-y-4' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
                  {categorizedEvents.past.map((e: any) => (
                    <EventCard 
                      key={`${params.domain}-past-${e.id}`} 
                      e={e}
                      viewMode={viewMode as 'grid' | 'list'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            <EventsPaginator
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
            />
          </>
        )}
      </div>
    </main>
  );
}