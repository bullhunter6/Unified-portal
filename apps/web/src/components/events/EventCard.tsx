"use client";
import Link from "next/link";
import { CalendarDays, MapPin, ExternalLink, Users, Clock, Bookmark, Share2 } from "lucide-react";
import type { EventListItem } from "@/lib/events";
import { useParams } from "next/navigation";
import { fmtDateRange, fmtTime, getRelativeTimeStatus } from "@/lib/date";

export default function EventCard({ 
  e, 
  viewMode = 'grid' 
}: { 
  e: EventListItem;
  viewMode?: 'grid' | 'list';
}) {
  const { domain } = useParams() as { domain: "esg" | "credit" };
  const dateText = fmtDateRange(e.start_date, e.end_date);
  const dateStatus = getRelativeTimeStatus(e.start_date, e.end_date);

  // List view layout
  if (viewMode === 'list') {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex gap-6 p-6">
          {/* Event image - smaller in list view */}
          {e.image_url && (
            <div className="flex-shrink-0">
              <img
                src={e.image_url}
                alt={e.title}
                className="h-32 w-48 rounded-xl object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header with badges */}
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="mb-2 text-lg font-semibold text-[var(--text)] line-clamp-1">
                  <Link href={`/${domain}/events/${e.id}`} className="hover:text-[var(--brand)]">
                    {e.title}
                  </Link>
                </h3>
                
                {/* Meta info row */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
                  {dateText && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      <span>{dateText}</span>
                    </div>
                  )}
                  {e.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      <span className="line-clamp-1">{e.location}</span>
                    </div>
                  )}
                  {e.organizer && (
                    <div className="flex items-center gap-1.5">
                      <Users size={14} />
                      <span>{e.organizer}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                {dateStatus && (
                  <span className={`
                    whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium
                    ${dateStatus.status === 'upcoming' ? 'bg-[var(--brand)]/10 text-[var(--brand)]' : ''}
                    ${dateStatus.status === 'ongoing' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : ''}
                    ${dateStatus.status === 'past' ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : ''}
                    ${dateStatus.status === 'future' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : ''}
                  `}>
                    {dateStatus.label}
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            {e.summary && (
              <p className="mb-4 text-sm text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                {e.summary}
              </p>
            )}

            {/* Footer with actions */}
            <div className="mt-auto flex items-center justify-between pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                {e.source && (
                  <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                    {e.source}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {e.tickets_url && (
                  <Link
                    href={e.tickets_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary text-sm px-4 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Get Tickets
                  </Link>
                )}
                {e.url && (
                  <Link 
                    href={e.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-secondary p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Grid view layout (original design enhanced)
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:shadow-md transition-all duration-300">
      {/* Status badge - positioned absolutely */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {dateStatus && (
          <span className={`
            rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm
            ${dateStatus.status === 'upcoming' ? 'bg-[var(--brand)]/90 text-white' : ''}
            ${dateStatus.status === 'ongoing' ? 'bg-green-500/90 text-white' : ''}
            ${dateStatus.status === 'past' ? 'bg-gray-500/90 text-white' : ''}
            ${dateStatus.status === 'future' ? 'bg-blue-500/90 text-white' : ''}
          `}>
            {dateStatus.label}
          </span>
        )}
      </div>

      {/* Event image */}
      {e.image_url && (
        <div className="relative overflow-hidden">
          <Link href={`/${domain}/events/${e.id}`}>
            <img
              src={e.image_url}
              alt={e.title}
              className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      )}

      {/* Card content */}
      <div className="p-6">
        {/* Title */}
        <h3 className="mb-3 line-clamp-2 text-lg font-semibold leading-tight text-[var(--text)]">
          <Link href={`/${domain}/events/${e.id}`} className="hover:text-[var(--brand)] transition-colors">
            {e.title}
          </Link>
        </h3>

        {/* Meta information */}
        <div className="mb-4 space-y-2.5">
          {dateText && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <CalendarDays size={16} className="flex-shrink-0" />
              <span className="line-clamp-1">{dateText}</span>
              {e.start_time && (
                <>
                  <Clock size={14} className="ml-2 flex-shrink-0" />
                  <span className="line-clamp-1">{fmtTime(e.start_time)}{e.timezone ? ` ${e.timezone}` : ''}</span>
                </>
              )}
            </div>
          )}
          
          {e.location && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <MapPin size={16} className="flex-shrink-0" />
              <span className="line-clamp-1">{e.location}</span>
            </div>
          )}
          
          {e.organizer && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Users size={16} className="flex-shrink-0" />
              <span className="line-clamp-1">{e.organizer}</span>
            </div>
          )}
        </div>

        {/* Summary */}
        {e.summary && (
          <p className="mb-4 text-sm text-[var(--text-muted)] line-clamp-3 leading-relaxed">
            {e.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--border)]">
          {e.source && (
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
              {e.source}
            </span>
          )}
          
          <div className="flex items-center gap-2">
            {e.tickets_url && (
              <Link
                href={e.tickets_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs px-4 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                Get Tickets
              </Link>
            )}
            {e.url && (
              <Link 
                href={e.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary p-2"
                onClick={(e) => e.stopPropagation()}
                title="View event details"
              >
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}