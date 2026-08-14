"use client";

import { Check, Clipboard, Share2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface EventShareActionsProps {
  title: string;
  text?: string;
  url?: string;
}

type Feedback = "idle" | "copied" | "shared" | "error";

function copyWithFallback(value: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
}

export function EventShareActions({ title, text, url }: EventShareActionsProps) {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const feedbackId = useId();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const showFeedback = (next: Feedback) => {
    setFeedback(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setFeedback("idle"), 3500);
  };

  const eventUrl = () => url ?? window.location.href;

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventUrl());
      } else if (!copyWithFallback(eventUrl())) {
        throw new Error("Copy is unavailable");
      }
      showFeedback("copied");
    } catch {
      showFeedback("error");
    }
  };

  const shareEvent = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, text, url: eventUrl() });
      showFeedback("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showFeedback("error");
    }
  };

  const feedbackCopy = {
    idle: "",
    copied: "Link copied to clipboard.",
    shared: "Share sheet opened successfully.",
    error: "Sharing failed. Copy the address from your browser instead.",
  }[feedback];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareEvent}
          aria-describedby={feedbackId}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share event
        </button>
        <button
          type="button"
          onClick={copyLink}
          aria-describedby={feedbackId}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {feedback === "copied" ? (
            <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          ) : (
            <Clipboard className="h-4 w-4" aria-hidden="true" />
          )}
          {feedback === "copied" ? "Copied" : "Copy link"}
        </button>
      </div>
      <p
        id={feedbackId}
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-xs text-muted-foreground"
      >
        {feedback === "error" ? (
          <span className="inline-flex items-start gap-1.5 text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {feedbackCopy}
          </span>
        ) : (
          feedbackCopy
        )}
      </p>
    </div>
  );
}
