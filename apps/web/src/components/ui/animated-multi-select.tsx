"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Search } from "lucide-react";

export type Option = { value: string; label: string };

export function AnimatedMultiSelect({
  options, value, onChange, placeholder = "Search...",
}: {
  options: Option[];
  value?: Option[];
  onChange?: (opts: Option[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Option[]>(value ?? []);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { onChange?.(selected); }, [selected, onChange]);
  useEffect(() => { setSelected(value ?? []); }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const lower = q.toLowerCase();
  const pool = useMemo(
    () => options.filter(o =>
      !selected.some(s => s.value === o.value) &&
      (o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower))
    ), [options, selected, lower]
  );

  const add = (opt: Option) => setSelected(prev => [...prev, opt]);
  const remove = (val: string) => setSelected(prev => prev.filter(p => p.value !== val));

  return (
    <div ref={ref} className="w-full">
      <div
        className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-2 rounded-lg border px-2 py-1 card-surface"
        onClick={() => setOpen(true)}
      >
        {selected.map((s) => (
          <motion.span
            key={s.value}
            layout
            initial={{ scale: 0.9, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs"
          >
            {s.label}
            <button onClick={(e) => { e.stopPropagation(); remove(s.value); }} aria-label="Remove">
              <X className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
            </button>
          </motion.span>
        ))}
        <div className="ml-auto flex items-center gap-1 text-[color:var(--muted)]">
          <Search className="h-4 w-4" />
          <input
            className="w-36 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="mt-2 max-h-56 overflow-auto rounded-lg border p-1 card-surface"
          >
            {pool.length === 0 ? (
              <div className="px-2 py-3 text-sm text-[color:var(--muted)]">No matches</div>
            ) : pool.map((o) => (
              <button
                key={o.value}
                onClick={() => add(o)}
                className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-black/5 data-[theme=credit]:hover:bg-white/5"
              >
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}