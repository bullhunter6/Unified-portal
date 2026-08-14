import { TrackActivity } from "@/components/analytics/UserActivityTracker";
import { EventDetailLedger } from "@/components/esg-events";
import { createEsgRequestClock, parseEsgEventId } from "@/lib/esg-events";
import {
  getEsgEventById,
  getRelatedEsgEvents,
} from "@/lib/esg-events/repository";
import { safeRelativePath } from "@/lib/safe-redirect";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { toDetailEvent, toRelatedEvent } from "../_presentation";

type DetailParams = Promise<{ id: string }>;
type DetailSearchParams = Promise<Record<string, string | string[] | undefined>>;

const getEventRecord = cache(async (id: number) => {
  const clock = createEsgRequestClock(new Date());
  const event = await getEsgEventById(id, clock);
  return { clock, event };
});

function returnToLedger(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/esg/events";
  const safe = safeRelativePath(value);
  return safe && /^\/esg\/events(?:\?|$)/.test(safe) ? safe : "/esg/events";
}

function metadataDescription(summary: string | null, title: string): string {
  const text = summary?.trim() || `Event details, dates, location, and source for ${title}.`;
  return text.length <= 160 ? text : `${text.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({ params }: { params: DetailParams }): Promise<Metadata> {
  const id = parseEsgEventId((await params).id);
  if (!id) return { title: "Event not found" };
  const { event } = await getEventRecord(id);
  if (!event) return { title: "Event not found" };

  const description = metadataDescription(event.summary, event.name);
  return {
    title: event.name,
    description,
    alternates: { canonical: `/esg/events/${event.id}` },
    openGraph: {
      type: "article",
      title: event.name,
      description,
      images: event.imageUrl ? [{ url: event.imageUrl, alt: event.name }] : undefined,
    },
  };
}

function eventStructuredData(event: NonNullable<Awaited<ReturnType<typeof getEventRecord>>["event"]>) {
  const startDate = event.temporal.startInstant
    ?? (event.startDate && event.startTime ? `${event.startDate}T${event.startTime}` : event.startDate);
  const effectiveEndDate = event.endDate && event.startDate && event.endDate < event.startDate
    ? event.startDate
    : event.endDate ?? event.startDate;
  const endDate = event.temporal.endInstant
    ?? (effectiveEndDate && event.endTime ? `${effectiveEndDate}T${event.endTime}` : effectiveEndDate);
  const attendanceMode = event.attendanceMode === "online"
    ? "https://schema.org/OnlineEventAttendanceMode"
    : event.attendanceMode === "hybrid"
      ? "https://schema.org/MixedEventAttendanceMode"
      : event.attendanceMode === "in_person"
        ? "https://schema.org/OfflineEventAttendanceMode"
        : undefined;
  const placeLabel = [event.city, event.countryLabel].filter(Boolean).join(", ") || undefined;
  const location = event.attendanceMode === "online"
    ? { "@type": "VirtualLocation", url: event.eventUrl ?? undefined }
    : event.city || event.countryLabel || event.venueName || event.venueAddress
      ? {
          "@type": "Place",
          name: event.venueName ?? placeLabel,
          address: event.venueAddress ?? placeLabel,
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.summary ?? undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
    eventAttendanceMode: attendanceMode,
    eventStatus: event.temporal.status === "past"
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled",
    location,
    image: event.imageUrl ? [event.imageUrl] : undefined,
    organizer: event.organizerName
      ? { "@type": "Organization", name: event.organizerName, url: event.organizerUrl ?? undefined }
      : undefined,
    offers: event.ticketsUrl
      ? { "@type": "Offer", url: event.ticketsUrl, price: event.ticketPrice ?? undefined }
      : undefined,
    url: event.eventUrl ?? undefined,
  };
}

export default async function EsgEventDetailPage({
  params,
  searchParams,
}: {
  params: DetailParams;
  searchParams: DetailSearchParams;
}) {
  const id = parseEsgEventId((await params).id);
  if (!id) notFound();

  const [{ clock, event }, resolvedSearchParams] = await Promise.all([
    getEventRecord(id),
    searchParams,
  ]);
  if (!event) notFound();

  const backHref = returnToLedger(resolvedSearchParams.back);
  const relatedEvents = await getRelatedEsgEvents(event, clock, 3);
  const media = event.imageUrl ? (
    <Image
      src={event.imageUrl}
      alt={`Event artwork for ${event.name}`}
      width={960}
      height={720}
      sizes="(max-width: 1023px) 100vw, 352px"
      unoptimized
      priority
    />
  ) : undefined;
  const structuredData = eventStructuredData(event);

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <TrackActivity
        action="view_event"
        resourceType="event"
        resourceId={id}
        details={`/esg/events/${id}`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <EventDetailLedger
        event={{ ...toDetailEvent(event), media }}
        backHref={backHref}
        related={relatedEvents.map((related) => toRelatedEvent(related, backHref))}
      />
    </main>
  );
}
