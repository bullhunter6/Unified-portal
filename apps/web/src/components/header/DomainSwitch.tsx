"use client";
import { usePathname, useRouter } from "next/navigation";
import { useDomainSwitch } from "@/components/providers/DomainSwitchAnimation";

export default function DomainSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const { triggerAnimation } = useDomainSwitch();

  // Check if we're on a home page (e.g., /esg or /credit)
  const isHomePage = () => {
    const parts = pathname.split("/").filter(Boolean);
    // Home page has exactly 1 segment: the domain name
    return parts.length === 1 && (parts[0] === "esg" || parts[0] === "credit");
  };

  // replace the first segment (/esg/... or /credit/...) and keep the rest
  const go = (to: "esg" | "credit") => {
    const parts = pathname.split("/").filter(Boolean);
    
    // If on home page, trigger the animation
    if (isHomePage() && parts[0] !== to) {
      triggerAnimation(to);
      // Delay navigation to let animation play
      setTimeout(() => {
        if (parts.length === 0) return router.push(`/${to}`);
        parts[0] = to;
        router.push("/" + parts.join("/"));
      }, 1000); // Start transitioning at peak of animation
    } else {
      // Normal navigation for non-home pages
      if (parts.length === 0) return router.push(`/${to}`);
      parts[0] = to;
      router.push("/" + parts.join("/"));
    }
  };

  const isESG = pathname.startsWith("/esg");
  return (
    <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
      <button
        onClick={() => go("esg")}
        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
          isESG ? "bg-emerald-600 text-white" : "hover:bg-slate-50"
        }`}
      >
        ESG
      </button>
      <button
        onClick={() => go("credit")}
        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
          !isESG ? "bg-slate-800 text-white" : "hover:bg-slate-50"
        }`}
      >
        Credit
      </button>
    </div>
  );
}