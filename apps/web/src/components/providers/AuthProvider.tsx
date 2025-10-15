"use client";

import { SessionProvider } from "next-auth/react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  // You can also pass `session` prop if you want SSR hydration, but it's optional.
  return <SessionProvider>{children}</SessionProvider>;
}