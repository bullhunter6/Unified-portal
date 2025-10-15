"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Job = {
  id: string;
  filename: string;
  status: string;
  progress: number;
  message?: string | null;
  total_pages?: number | null;
  created_at: string;
  updated_at: string;
};

export default function PdfTranslateHome() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("English");
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ status?: string; progress?: number; message?: string; totalPages?: number; currentPage?: number } | null>(null);
  const [history, setHistory] = useState<Job[]>([]);

  const uploading = busy && !!jobId && status?.status !== "completed" && status?.status !== "error";

  async function loadHistory() {
    const res = await fetch("/api/pdfx/jobs", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      if (j?.success) setHistory(j.items || []);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (!jobId) return;
    let timer: any;
    const tick = async () => {
      const u = new URL("/api/pdfx/status", window.location.origin);
      u.searchParams.set("jobId", jobId);
      const res = await fetch(u, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        if (j?.success) setStatus(j);
        if (j?.status === "completed" || j?.status === "error" || j?.status === "cancelled") {
          setBusy(false);
          loadHistory();
          return;
        }
      }
      timer = setTimeout(tick, 1200);
    };
    tick();
    return () => clearTimeout(timer);
  }, [jobId]);

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("targetLang", target);
    const res = await fetch("/api/pdfx/upload", { method: "POST", body: fd });
    if (res.ok) {
      const j = await res.json();
      if (j?.success) setJobId(j.jobId);
    } else {
      setBusy(false);
      alert("Upload failed");
    }
  }

  async function onCancel() {
    if (!jobId) return;
    await fetch("/api/pdfx/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">PDF Translator</h1>

      {/* Upload */}
      <div className="rounded-xl border p-4 bg-white space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block"
          />
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="border rounded px-2 py-1">
            <option>English</option>
            <option>Arabic</option>
            <option>Russian</option>
            <option>French</option>
            <option>German</option>
            <option>Spanish</option>
          </select>
          <button
            onClick={onUpload}
            disabled={!file || busy}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            Upload & Translate
          </button>
          {uploading && (
            <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border">
              Stop
            </button>
          )}
        </div>

        {/* Progress */}
        {jobId && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              Job: <span className="font-mono">{jobId.slice(0, 8)}</span> — {status?.status} {status?.message ? `• ${status.message}` : ""}
            </div>
            <div className="w-full h-2 rounded bg-gray-100 overflow-hidden">
              <div
                className="h-2 bg-blue-600 transition-all"
                style={{ width: `${Math.min(100, status?.progress ?? 0)}%` }}
              />
            </div>
            {status?.status === "completed" && (
              <div>
                <Link href={`/credit/pdfx/${jobId}/view`} className="text-blue-700 underline">Open viewer</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 font-medium">Your recent translations</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">File</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Pages</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{h.filename}</td>
                  <td className="py-2 pr-4">{h.status}{h.message ? ` — ${h.message}` : ""}</td>
                  <td className="py-2 pr-4">{h.progress}%</td>
                  <td className="py-2 pr-4">{h.total_pages || 0}</td>
                  <td className="py-2 pr-4">
                    {h.status === "completed" ? (
                      <Link href={`/credit/pdfx/${h.id}/view`} className="text-blue-700 underline">Open viewer</Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr><td className="py-4 text-gray-500" colSpan={5}>No recent jobs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}