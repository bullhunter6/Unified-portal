"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLike } from "@/app/actions/likes";

export default function LikeButton({
  domain,
  contentId,
  initialLiked,
  initialCount,
}: {
  domain: "esg" | "credit";
  contentId: number;              // must be a number
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked]   = useState(initialLiked);
  const [count, setCount]   = useState(initialCount);
  const [isPending, start]  = useTransition();
  const router              = useRouter();

  async function handleClick() {
    const next = !liked;

    // optimistic update
    setLiked(next);
    setCount(c => c + (next ? 1 : -1));

    // server action in a transition
    start(async () => {
      const res = await toggleLike(domain, contentId, "article", next);
      if (!res?.ok) {
        // revert on failure
        setLiked(!next);
        setCount(c => c + (next ? -1 : 1));
        alert(res?.reason || "Failed to like");
      } else {
        // sync to server truth (if other users also liked)
        setLiked(res.liked ?? next);
        setCount(res.count ?? count);
      }
      // refresh RSC tree for immediate UI updates
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
        liked
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : "hover:bg-slate-50"
      }`}
      title={liked ? "Unlike" : "Like"}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}