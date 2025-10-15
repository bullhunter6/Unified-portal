"use client";
import ErrorResult from "@/components/ui/error-result";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorResult title="Something went wrong" description={error.message} onRetry={reset} />;
}