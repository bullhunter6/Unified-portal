import Link from "next/link";

type Props = {
  pub: {
    id: number | string;
    title: string;
    link: string | null;
    image_url: string | null;
    source: string | null;
    published: string | null; // ISO
    summary: string | null;
  };
};

export default function PublicationCard({ pub }: Props) {
  const when =
    pub.published &&
    !Number.isNaN(new Date(pub.published).getTime()) &&
    new Date(pub.published).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-background/60 backdrop-blur transition hover:shadow-xl">
      {pub.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={pub.image_url}
          alt={pub.title}
          className="h-40 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-40 w-full bg-muted" />
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pub.source ?? "Unknown source"}</span>
          <time>{when || "—"}</time>
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          {pub.title}
        </h3>

        {pub.summary && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {pub.summary}
          </p>
        )}

        {pub.link && (
          <Link
            href={pub.link}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open publication →
          </Link>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
    </article>
  );
}