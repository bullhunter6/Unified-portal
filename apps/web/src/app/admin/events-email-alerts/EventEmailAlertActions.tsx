"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, FlaskConical, LoaderCircle, Pause, Plus, RotateCcw, X } from "lucide-react";

type Feedback = { tone: "success" | "error"; message: string } | null;

function FeedbackLine({ feedback, id }: { feedback: Feedback; id?: string }) {
  return (
    <p
      id={id}
      role="status"
      aria-atomic="true"
      className={`min-h-5 text-xs ${
        feedback?.tone === "error"
          ? "text-red-700 dark:text-red-300"
          : "text-emerald-700 dark:text-emerald-300"
      }`}
    >
      {feedback?.message ?? ""}
    </p>
  );
}

export function AddRecipientForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/esg-event-email-alerts/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add recipient");
      setEmail("");
      setFeedback({
        tone: "success",
        message: `Added. First edition: ${formatDate(data.recipient.startsOn)}.`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to add recipient",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={busy} className="space-y-3">
      <div>
        <label htmlFor="event-alert-recipient" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          New production recipient
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="event-alert-recipient"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            aria-invalid={feedback?.tone === "error"}
            aria-describedby="event-alert-recipient-help event-alert-recipient-feedback"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden="true" className="size-4" />}
            Add recipient
          </button>
        </div>
      </div>
      <p id="event-alert-recipient-help" className="text-xs leading-5 text-muted-foreground">
        New addresses begin with the next scheduled Monday edition. Email addresses cannot be edited; pause the old address and add the replacement.
      </p>
      <FeedbackLine id="event-alert-recipient-feedback" feedback={feedback} />
    </form>
  );
}

export function RecipientToggle({
  id,
  email,
  isActive,
  updatedAt,
}: {
  id: number;
  email: string;
  isActive: boolean;
  updatedAt: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmButtonRef.current?.focus();
  }, [confirming]);

  function cancelConfirmation() {
    setConfirming(false);
    requestAnimationFrame(() => actionButtonRef.current?.focus());
  }

  async function update() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/esg-event-email-alerts/recipients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive, expectedUpdatedAt: updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update recipient");
      setConfirming(false);
      if (isActive) requestAnimationFrame(() => actionButtonRef.current?.focus());
      setFeedback({
        tone: "success",
        message: data.recipient.isActive
          ? `Reactivated for ${formatDate(data.recipient.startsOn)}.`
          : "Paused for future editions.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Update failed" });
    } finally {
      setBusy(false);
    }
  }

  if (isActive && confirming) {
    return (
      <div role="group" aria-label={`Pause ${email}`} className="space-y-2">
        <p className="max-w-xs text-xs leading-5 text-amber-800">
          Pause {email}? Already queued mail may still be delivered.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={update}
            disabled={busy}
            aria-label={`Confirm pause for ${email}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-3.5" />}
            Confirm pause
          </button>
          <button
            type="button"
            onClick={cancelConfirmation}
            disabled={busy}
            aria-label={`Cancel pause for ${email}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X aria-hidden="true" className="size-3.5" /> Cancel
          </button>
        </div>
        <FeedbackLine feedback={feedback} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        ref={actionButtonRef}
        type="button"
        onClick={() => isActive ? setConfirming(true) : void update()}
        disabled={busy}
        aria-label={`${isActive ? "Pause" : "Reactivate"} ${email}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : isActive ? <Pause aria-hidden="true" className="size-3.5" /> : <RotateCcw aria-hidden="true" className="size-3.5" />}
        {isActive ? "Pause" : "Reactivate"}
      </button>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

export function TestDigestButton({ recipient }: { recipient: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function sendTest() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/test-esg-events-weekly-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to queue test email");
      setFeedback({
        tone: "success",
        message: `Queued ${data.result.eventCount} ${data.result.eventCount === 1 ? "event" : "events"} to ${recipient}.`,
      });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Test failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={sendTest}
        disabled={busy}
        aria-label={`Queue test email to ${recipient}`}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <FlaskConical aria-hidden="true" className="size-4" />}
        Queue test email
      </button>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
