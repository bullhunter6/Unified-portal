"use client";
import { AlertTriangle } from "lucide-react";

export default function ErrorResult({
  title = "Something went wrong",
  description = "Please try again.",
  onRetry,
}: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border p-6 text-center card-surface">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-[color:var(--accent)] px-4 py-2 text-white hover:opacity-90"
        >
          Retry
        </button>
      )}
    </div>
  );
}