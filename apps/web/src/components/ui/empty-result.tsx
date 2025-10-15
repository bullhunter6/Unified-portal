"use client";
import { Inbox } from "lucide-react";

export default function EmptyResult({
  title = "Nothing here yet",
  description = "Try adjusting filters or check back soon.",
  action,
}: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-secondary">
        <Inbox className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}