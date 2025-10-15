"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function UserMenu({ domain }: { domain: "esg" | "credit" }) {
  const { data } = useSession();
  const name = data?.user?.name || data?.user?.email || "User";
  const initial = String(name).trim().charAt(0).toUpperCase() || "U";
  const isAdmin = (data?.user as any)?.is_admin || false;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-card-foreground border-border"
        aria-label="User menu"
      >
        <span className="text-sm font-semibold">{initial}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-card p-2 shadow-lg border-border">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Signed in as</div>
          <div className="px-2 pb-2 text-sm font-medium text-card-foreground">{name}</div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/profile"
            className="block rounded-lg px-2 py-2 text-sm hover:bg-accent/10 text-card-foreground"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            href={`/${domain}/community`}
            prefetch={false}
            className="block rounded-lg px-2 py-2 text-sm hover:bg-accent/10 text-card-foreground"
            onClick={() => setOpen(false)}
          >
            Community
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="block rounded-lg px-2 py-2 text-sm hover:bg-accent/10 text-card-foreground font-medium"
              onClick={() => setOpen(false)}
            >
              🛡️ Admin Dashboard
            </Link>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="block w-full rounded-lg px-2 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}