import { fetchSources } from "@/lib/articles";

export default async function ArticleFilterBar({
  domain,
  searchParams,
}: {
  domain: "esg" | "credit";
  searchParams: { page?: string; source?: string; date?: string };
}) {
  const sources = await fetchSources(domain);
  return (
    <form className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]" method="GET">
      <select
        name="source"
        defaultValue={searchParams.source ?? ""}
        className="rounded-lg border px-3 py-2 text-sm"
      >
        <option value="">All sources</option>
        {sources.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <input
        type="date"
        name="date"
        defaultValue={searchParams.date}
        placeholder="Filter by date"
        className="rounded-lg border px-3 py-2 text-sm"
      />

      <button
        type="submit"
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        Apply
      </button>
    </form>
  );
}