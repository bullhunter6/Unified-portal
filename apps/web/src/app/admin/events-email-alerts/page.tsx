import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  MailCheck,
  MailWarning,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import { requireAdminSession } from "@/lib/api-auth";
import {
  getNextDigestRunLabel,
  loadEsgEventDigestAdminSnapshot,
  type EsgEventDigestDeliveryDto,
  type EsgEventDigestDeliveryStatus,
} from "@/lib/esg-events/digest-admin";
import {
  buildEsgEventDigestAdminQuery,
  parseEsgEventDigestAdminQuery,
} from "@/lib/esg-events/digest-admin-query";
import { createEsgRequestClock } from "@/lib/esg-events/dates";
import { listEsgWeeklyDigestEvents } from "@/lib/esg-events/repository";
import { getEsgWeeklyDigestWindow } from "@/lib/esg-events/weekly-digest-dates";
import {
  AddRecipientForm,
  RecipientToggle,
  TestDigestButton,
} from "./EventEmailAlertActions";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

export default async function EventsEmailAlertsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const auth = await requireAdminSession();
  if (auth.response) redirect("/");

  const rawSearch = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearch)) {
    if (Array.isArray(value)) value.forEach((entry) => urlParams.append(key, entry));
    else if (value !== undefined) urlParams.append(key, value);
  }
  const filters = parseEsgEventDigestAdminQuery(urlParams);
  if (!filters) redirect("/admin/events-email-alerts");

  const now = new Date();
  const currentWindow = getEsgWeeklyDigestWindow(now);
  const [snapshot, previewEvents] = await Promise.all([
    loadEsgEventDigestAdminSnapshot(filters),
    listEsgWeeklyDigestEvents(currentWindow, createEsgRequestClock(now)),
  ]);
  if (filters.page > snapshot.totalPages) {
    redirect(`/admin/events-email-alerts${buildEsgEventDigestAdminQuery(filters, snapshot.totalPages)}`);
  }
  const nextRun = getNextDigestRunLabel(now);
  const activeSchedule = snapshot.scheduleEnabled && snapshot.activeRecipients > 0;
  const testRecipient = snapshot.testRecipient ?? "saikrishna.pashapu@finvizier.com";
  const successRate = snapshot.attemptedLast30Days
    ? Math.round(snapshot.successfulLast30Days / snapshot.attemptedLast30Days * 100)
    : null;

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-8 pb-12 text-foreground">
      <header className="relative overflow-hidden rounded-xl border border-emerald-950/15 bg-[#f7f5ef] px-5 py-7 shadow-[0_18px_50px_-38px_rgba(3,48,35,.55)] dark:bg-card sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_100%_0%,rgba(180,125,35,.16),transparent_68%)]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-800 dark:text-emerald-400">
              ESG event operations
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-event-alert-editorial)] text-4xl font-semibold leading-none tracking-[-0.035em] text-[#13271f] dark:text-foreground sm:text-5xl">
              Weekly delivery ledger
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-muted-foreground sm:text-base">
              Control who receives the Monday event agenda, verify test editions, and follow every delivery from queue to inbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-semibold ${
              activeSchedule
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            }`}>
              <span aria-hidden="true" className={`size-2 rounded-full ${activeSchedule ? "bg-emerald-600" : "bg-amber-600"}`} />
              {activeSchedule
                ? "Enabled · Mondays, 09:00 UAE"
                : snapshot.scheduleEnabled
                  ? "Paused · no active recipients"
                  : "Disabled by environment"}
            </span>
            <Link
              href="/admin/email-queue"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 text-xs font-semibold text-slate-700 transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border dark:bg-background dark:text-foreground"
            >
              Full email queue <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {!snapshot.scheduleEnabled || snapshot.activeRecipients === 0 ? (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <MailWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p>
            {!snapshot.scheduleEnabled
              ? "Automatic delivery is disabled. Set ESG_EVENTS_DIGEST_ENABLED=true and restart the background worker."
              : "All recipients are paused. The worker will record no deliveries until an address is added or reactivated."}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="delivery-overview" className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Signal</p>
            <h2 id="delivery-overview" className="mt-1 font-[family-name:var(--font-event-alert-editorial)] text-2xl font-semibold">Delivery overview</h2>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">Live queue status and persistent delivery history</p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={UsersRound} label="Active recipients" value={String(snapshot.activeRecipients)} detail={`${snapshot.recipients.length} registered`} />
          <Metric icon={CalendarClock} label="Next scheduled run" value={activeSchedule ? formatDay(nextRun.date) : "Paused"} detail="09:00 Asia/Dubai" time={activeSchedule ? nextRun.iso : undefined} />
          <Metric icon={MailCheck} label="Last production send" value={snapshot.lastProductionSentAt ? formatRelativeDate(snapshot.lastProductionSentAt) : "No sends yet"} detail={snapshot.lastProductionSentAt ? formatDateTime(snapshot.lastProductionSentAt) : "Awaiting first edition"} time={snapshot.lastProductionSentAt ?? undefined} />
          <Metric icon={Activity} label="30-day success" value={successRate === null ? "No data" : `${successRate}%`} detail={`${snapshot.successfulLast30Days} of ${snapshot.attemptedLast30Days} delivered`} />
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
        <section aria-labelledby="recipient-register" className="min-w-0 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-400">Distribution</p>
            <h2 id="recipient-register" className="mt-1 font-[family-name:var(--font-event-alert-editorial)] text-2xl font-semibold">Recipient register</h2>
            <p className="mt-1 text-sm text-muted-foreground">Production addresses are stored in the database and can be paused without losing history.</p>
          </div>
          {snapshot.recipients.length ? (
            <ul className="divide-y divide-border">
              {snapshot.recipients.map((recipient) => (
                <li key={recipient.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all text-sm font-semibold text-foreground">{recipient.email}</p>
                      <StatusPill active={recipient.isActive} />
                      {recipient.email === testRecipient ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Test target</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {recipient.isActive ? "Eligible for editions from " : "Paused · eligibility began "}
                      <time dateTime={recipient.startsOn}>{formatDay(recipient.startsOn)}</time>
                    </p>
                  </div>
                  <RecipientToggle
                    id={recipient.id}
                    email={recipient.email}
                    isActive={recipient.isActive}
                    updatedAt={recipient.updatedAt}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-12 text-center">
              <UsersRound aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No production recipients</p>
              <p className="mt-1 text-xs text-muted-foreground">Add the first address to resume future Monday editions.</p>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <AddRecipientForm />
          </section>
          <section aria-labelledby="test-delivery" className="rounded-xl border border-amber-300/80 bg-[#fffaf0] p-5 dark:border-amber-900 dark:bg-amber-950/20 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-200/70 p-2 text-amber-950 dark:bg-amber-900/70 dark:text-amber-100"><Send aria-hidden="true" className="size-4" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300">Safe test</p>
                <h2 id="test-delivery" className="mt-1 font-[family-name:var(--font-event-alert-editorial)] text-xl font-semibold">Preview this week</h2>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-amber-300/70 py-4 text-sm dark:border-amber-900">
              <div><dt className="text-xs text-muted-foreground">Window</dt><dd className="mt-1 font-semibold">{formatShortRange(currentWindow.weekStart, currentWindow.weekEnd)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Events</dt><dd className="mt-1 font-semibold tabular-nums">{previewEvents.length}</dd></div>
            </dl>
            <p className="mt-4 break-all text-xs leading-5 text-muted-foreground">
              Locked to <strong className="text-foreground">{testRecipient}</strong>. Production recipients are never included in a test.
            </p>
            <div className="mt-4"><TestDigestButton recipient={testRecipient} /></div>
          </section>
        </aside>
      </div>

      <section aria-labelledby="delivery-ledger" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-400">Chronology</p>
              <h2 id="delivery-ledger" className="mt-1 font-[family-name:var(--font-event-alert-editorial)] text-2xl font-semibold">Delivery ledger</h2>
              <p className="mt-1 text-sm text-muted-foreground">{snapshot.totalDeliveries} persistent delivery {snapshot.totalDeliveries === 1 ? "record" : "records"}</p>
            </div>
            <form method="get" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_150px_150px_auto]">
              <label className="relative">
                <span className="sr-only">Search recipient</span>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <input name="recipient" defaultValue={filters.recipient} maxLength={120} autoCapitalize="none" spellCheck={false} placeholder="Recipient email" className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </label>
              <label>
                <span className="sr-only">Delivery status</span>
                <select name="status" defaultValue={filters.status ?? ""} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">All statuses</option><option value="queued">Queued</option><option value="processing">Processing</option><option value="sent">Sent</option><option value="failed">Failed</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Delivery mode</span>
                <select name="mode" defaultValue={filters.mode ?? ""} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">All modes</option><option value="production">Production</option><option value="test">Test</option>
                </select>
              </label>
              <button className="min-h-11 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:col-span-2 xl:col-span-1 dark:bg-emerald-800 dark:hover:bg-emerald-700">Apply</button>
            </form>
          </div>
          {filters.status || filters.mode || filters.recipient ? (
            <Link href="/admin/events-email-alerts" className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-emerald-300">Clear ledger filters</Link>
          ) : null}
        </div>

        {snapshot.deliveries.length ? (
          <>
            <div
              role="region"
              aria-labelledby="delivery-ledger"
              tabIndex={0}
              className="hidden overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:block"
            >
              <table className="w-full min-w-[960px] text-left text-sm">
                <caption className="sr-only">ESG weekly event email delivery history</caption>
                <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <tr><th scope="col" className="px-5 py-3 font-semibold">Edition</th><th scope="col" className="px-5 py-3 font-semibold">Recipient</th><th scope="col" className="px-5 py-3 font-semibold">Mode</th><th scope="col" className="px-5 py-3 font-semibold">Events</th><th scope="col" className="px-5 py-3 font-semibold">Status</th><th scope="col" className="px-5 py-3 font-semibold">Attempts</th><th scope="col" className="px-5 py-3 font-semibold">Timing</th></tr>
                </thead>
                <tbody className="divide-y divide-border">{snapshot.deliveries.map((delivery) => <DeliveryTableRow key={delivery.id} delivery={delivery} />)}</tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">{snapshot.deliveries.map((delivery) => <DeliveryCard key={delivery.id} delivery={delivery} />)}</ul>
          </>
        ) : (
          <div className="px-6 py-14 text-center"><MailCheck aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No matching deliveries</p><p className="mt-1 text-xs text-muted-foreground">New test and Monday editions will appear here.</p></div>
        )}

        <nav aria-label="Delivery ledger pagination" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border px-5 py-4 sm:px-6">
          <PaginationDirection
            direction="previous"
            disabled={filters.page <= 1}
            href={`/admin/events-email-alerts${buildEsgEventDigestAdminQuery(filters, Math.max(1, filters.page - 1))}`}
          />
          <span aria-current="page" className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            Page {filters.page} of {snapshot.totalPages}
          </span>
          <PaginationDirection
            direction="next"
            disabled={filters.page >= snapshot.totalPages}
            href={`/admin/events-email-alerts${buildEsgEventDigestAdminQuery(filters, Math.min(snapshot.totalPages, filters.page + 1))}`}
          />
        </nav>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, time }: { icon: typeof Activity; label: string; value: string; detail: string; time?: string }) {
  return <div className="bg-card px-5 py-5"><div className="flex items-center gap-2 text-muted-foreground"><Icon aria-hidden="true" className="size-4" /><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</p></div><p className="mt-4 font-[family-name:var(--font-event-alert-editorial)] text-2xl font-semibold tabular-nums">{time ? <time dateTime={time}>{value}</time> : value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${active ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{active ? "Active" : "Paused"}</span>;
}

function DeliveryStatus({ status }: { status: EsgEventDigestDeliveryStatus }) {
  const styles = { sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200", failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200", processing: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200", queued: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}>{status}</span>;
}

function PaginationDirection({
  direction,
  disabled,
  href,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  href: string;
}) {
  const previous = direction === "previous";
  const label = previous ? "Previous" : "Next";
  const className = `inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-semibold ${
    previous ? "justify-self-start" : "justify-self-end"
  }`;
  const content = (
    <>
      {previous ? <ArrowLeft aria-hidden="true" className="size-3.5" /> : null}
      <span className="hidden sm:inline">{label}</span>
      {!previous ? <ArrowRight aria-hidden="true" className="size-3.5" /> : null}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={`${label} page unavailable`} className={`${className} text-muted-foreground opacity-40`}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={previous ? "prev" : "next"}
      aria-label={`${label} delivery page`}
      className={`${className} transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
    >
      {content}
    </Link>
  );
}

function DeliveryTableRow({ delivery }: { delivery: EsgEventDigestDeliveryDto }) {
  return (
    <tr className="align-top transition hover:bg-muted/25">
      <td className="px-5 py-4 font-[family-name:var(--font-event-alert-editorial)] text-base font-semibold">
        {delivery.weekStart ? <time dateTime={delivery.weekStart}>{formatDay(delivery.weekStart)}</time> : "Unknown"}
      </td>
      <td className="max-w-[280px] break-all px-5 py-4 text-xs font-medium">{delivery.recipient}</td>
      <td className="px-5 py-4 text-xs capitalize text-muted-foreground">{delivery.mode}</td>
      <td className="px-5 py-4 tabular-nums">{delivery.eventCount}</td>
      <td className="px-5 py-4">
        <DeliveryStatus status={delivery.status} />
        {delivery.error ? (
          <details className="mt-2 max-w-xs">
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-[11px] font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-300">
              View error<span className="sr-only"> for {delivery.recipient}</span>
            </summary>
            <p className="mt-1 break-words text-[11px] leading-5 text-red-700 dark:text-red-300">{delivery.error}</p>
          </details>
        ) : null}
      </td>
      <td className="px-5 py-4 tabular-nums text-muted-foreground">{delivery.attempts}</td>
      <td className="px-5 py-4 text-xs text-muted-foreground">
        <p>Queued <time dateTime={delivery.createdAt}>{formatDateTime(delivery.createdAt)}</time></p>
        <p className="mt-1">
          {delivery.sentAt ? (
            <>Sent <time dateTime={delivery.sentAt}>{formatDateTime(delivery.sentAt)}</time></>
          ) : delivery.lastAttemptAt ? (
            <>Tried <time dateTime={delivery.lastAttemptAt}>{formatDateTime(delivery.lastAttemptAt)}</time></>
          ) : "Awaiting worker"}
        </p>
      </td>
    </tr>
  );
}

function DeliveryCard({ delivery }: { delivery: EsgEventDigestDeliveryDto }) {
  return (
    <li className="space-y-3 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-event-alert-editorial)] text-lg font-semibold">
            {delivery.weekStart ? <time dateTime={delivery.weekStart}>{formatDay(delivery.weekStart)}</time> : "Unknown edition"}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{delivery.recipient}</p>
        </div>
        <DeliveryStatus status={delivery.status} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted-foreground">Mode</dt><dd className="mt-1 capitalize">{delivery.mode}</dd></div>
        <div><dt className="text-muted-foreground">Events</dt><dd className="mt-1 tabular-nums">{delivery.eventCount}</dd></div>
        <div><dt className="text-muted-foreground">Attempts</dt><dd className="mt-1 tabular-nums">{delivery.attempts}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Queued <time dateTime={delivery.createdAt}>{formatDateTime(delivery.createdAt)}</time></p>
      {delivery.error ? (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-xs font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-300">
            Delivery error<span className="sr-only"> for {delivery.recipient}</span>
          </summary>
          <p className="mt-2 break-words text-xs leading-5 text-red-700 dark:text-red-300">{delivery.error}</p>
        </details>
      ) : null}
    </li>
  );
}

function formatDay(value: string): string { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }
function formatDateTime(value: string): string { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai", timeZoneName: "short" }).format(new Date(value)); }
function formatRelativeDate(value: string): string { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(new Date(value)); }
function formatShortRange(start: string, end: string): string { return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`))}–${formatDay(end)}`; }
