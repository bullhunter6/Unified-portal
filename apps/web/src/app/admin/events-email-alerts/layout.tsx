import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";

const ledgerSans = IBM_Plex_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-event-alert-sans",
  weight: ["400", "500", "600"],
});

const ledgerEditorial = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-event-alert-editorial",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Event Email Alerts | Admin",
  description: "Manage and monitor the ESG weekly event email alert.",
};

export default function EventEmailAlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ledgerSans.variable} ${ledgerEditorial.variable} min-w-0 font-[family-name:var(--font-event-alert-sans)]`}>
      {children}
    </div>
  );
}
