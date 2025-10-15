"use client";
import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AnimatedMultiSelect, type Option } from "@/components/ui/animated-multi-select";

export default function SourceFilter({ sources }: { sources: string[] }) {
  const router = useRouter(); 
  const pathname = usePathname(); 
  const sp = useSearchParams();
  
  const options: Option[] = useMemo(() => sources.map(s => ({ value: s, label: s })), [sources]);
  const selected = (sp.get("source") || "").split(",").filter(Boolean);
  const selectedOptions = options.filter(o => selected.includes(o.value));
  
  function onChange(next: Option[]) { 
    const p = new URLSearchParams(sp.toString());
    if (next.length) p.set("source", next.map(o => o.value).join(",")); 
    else p.delete("source");
    router.push(`${pathname}?${p.toString()}`, { scroll: false }); 
  }
  
  return <AnimatedMultiSelect options={options} value={selectedOptions} onChange={onChange} placeholder="Filter by source..." />;
}