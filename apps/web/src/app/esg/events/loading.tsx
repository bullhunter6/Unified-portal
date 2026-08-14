function Line({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className}`} />;
}

export default function EventsLoading() {
  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground" aria-busy="true">
      <span className="sr-only">Loading ESG events</span>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8">
          <Line className="h-3 w-28" />
          <Line className="mt-5 h-10 max-w-xl" />
          <Line className="mt-3 h-4 max-w-2xl" />
          <div className="mt-7 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-background p-3 sm:p-4">
                <Line className="h-7 w-14" />
                <Line className="mt-2 h-3 w-20 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1380px] gap-2 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          {["w-24", "w-20", "w-28", "w-20", "w-24"].map((width, index) => (
            <Line key={index} className={`h-11 shrink-0 ${width}`} />
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1380px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        <aside className="hidden space-y-5 lg:block">
          <div className="rounded-2xl border border-border bg-card p-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="mb-5 last:mb-0">
                <Line className="mb-2 h-3 w-24" />
                <Line className="h-11 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </aside>
        <section className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <Line className="h-5 w-44" />
            <Line className="h-5 w-20" />
          </div>
          {[0, 1, 2, 3].map((item) => (
            <article key={item} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-6">
              <div className="space-y-2 border-r border-border pr-4">
                <Line className="h-3 w-10" />
                <Line className="h-9 w-12" />
                <Line className="h-3 w-10" />
              </div>
              <div className="min-w-0 space-y-3">
                <Line className="h-3 w-28" />
                <Line className="h-7 w-4/5" />
                <Line className="h-4 w-full" />
                <Line className="h-4 w-2/3" />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
