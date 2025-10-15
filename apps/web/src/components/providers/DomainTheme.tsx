"use client";
import { usePathname } from "next/navigation";

export default function DomainTheme({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const domain = path.startsWith("/credit") ? "credit" : "esg";
  return <div data-domain={domain}>{children}</div>;
}