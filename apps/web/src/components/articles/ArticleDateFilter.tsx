"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface ArticleDateFilterProps {
  domain: string;
  currentDate?: string;
}

export default function ArticleDateFilter({ domain, currentDate }: ArticleDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const today = new Date().toISOString().slice(0, 10);

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page"); // Reset to first page when filtering
    
    if (date === today) {
      params.delete("date"); // Remove date param if it's today (default)
    } else {
      params.set("date", date);
    }
    
    const queryString = params.toString();
    const url = `/${domain}/articles${queryString ? `?${queryString}` : ""}`;
    router.push(url);
  };

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="date-picker" className="text-sm font-medium text-[var(--text)]">
        Date:
      </label>
      <input
        id="date-picker"
        type="date"
        value={currentDate || today}
        onChange={(e) => handleDateChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
      />
      {currentDate && currentDate !== today && (
        <button
          onClick={() => handleDateChange(today)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--brand)]"
        >
          Today
        </button>
      )}
    </div>
  );
}