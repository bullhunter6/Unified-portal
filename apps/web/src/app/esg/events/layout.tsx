import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";

const eventSans = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-event-sans",
  weight: ["400", "500", "600"],
});

const eventEditorial = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-event-editorial",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "ESG Event Ledger",
    template: "%s | ESG Event Ledger",
  },
  description:
    "Discover ESG, climate, sustainable-finance, and responsible-investment events around the world.",
};

export default function EsgEventsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${eventSans.variable} ${eventEditorial.variable} min-w-0 font-[family-name:var(--font-event-sans)]`}
    >
      {children}
    </div>
  );
}
