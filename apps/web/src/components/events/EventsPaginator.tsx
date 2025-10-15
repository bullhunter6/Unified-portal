// src/components/events/EventsPaginator.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function EventsPaginator({
  page,
  totalPages,
  pageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPage = (p: number) => {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.set("page", String(p));
    sp.set("pageSize", String(pageSize)); // keep current page size
    router.push(`${pathname}?${sp.toString()}`);
    // Router refresh not needed; push triggers RSC fetch
  };

  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <button
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        className="px-3 py-1.5 rounded-md border disabled:opacity-50 text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors disabled:cursor-not-allowed"
      >
        Prev
      </button>

      <div className="text-sm text-[var(--text-muted)]">
        Page <span className="font-medium text-[var(--text)]">{page}</span> of{" "}
        <span className="font-medium text-[var(--text)]">{totalPages}</span>
      </div>

      <button
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
        className="px-3 py-1.5 rounded-md border disabled:opacity-50 text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
}