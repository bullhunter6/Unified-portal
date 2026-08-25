'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  History,
  Languages,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { MAX_PDF_UPLOAD_BYTES } from '@/lib/pdfx-v2/constants';
import {
  PDFX_V2_SUPPORTED_LANGUAGES,
  type PdfxV2TargetLanguage,
} from '@/lib/pdfx-v2/types';

type HistoryItem = {
  id: string;
  filename: string;
  target_lang: string;
  status: string;
  stage: string;
  message: string | null;
  progress: number;
  total_pages: number;
  created_at: string;
  canDownload: boolean;
};

type HistoryFilter = 'all' | 'active' | 'completed' | 'attention';

const ACTIVE_STATUSES = new Set(['queued', 'processing', 'cancelling']);
const ATTENTION_STATUSES = new Set(['error', 'cancelled']);
const HISTORY_FILTERS: Array<{ key: HistoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'attention', label: 'Needs attention' },
];

export default function PdfTranslator2Client() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState<PdfxV2TargetLanguage>('Russian');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await fetch('/api/pdfx-v2/history?page=1&pageSize=8', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load translation history');
      const payload = await response.json() as { items?: HistoryItem[]; total?: number };
      setHistory(payload.items ?? []);
      setHistoryTotal(payload.total ?? 0);
    } catch {
      setHistoryError('Translation history is temporarily unavailable.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const deleteTranslation = async (item: HistoryItem) => {
    if (ACTIVE_STATUSES.has(item.status) || deletingId) return;
    const confirmed = window.confirm(
      `Delete “${item.filename}”?\n\nThe saved source PDF, translated PDF, and page results will be permanently removed.`,
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setDeleteError('');
    try {
      const response = await fetch(`/api/pdfx-v2/jobs/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to delete this translation.');

      setHistory((current) => current.filter((translation) => translation.id !== item.id));
      setHistoryTotal((current) => Math.max(0, current - 1));
      await loadHistory();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : 'Unable to delete this translation.');
    } finally {
      setDeletingId(null);
    }
  };

  const chooseFile = (next: File | null) => {
    setError('');
    if (!next) return setFile(null);
    const isPdf = next.type === 'application/pdf' || next.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return setError('Choose a PDF document.');
    if (next.size < 1) return setError('The selected PDF is empty.');
    if (next.size > MAX_PDF_UPLOAD_BYTES) return setError('The selected PDF exceeds 512 MB.');
    setFile(next);
  };

  const submit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('targetLang', targetLang);
      const response = await fetch('/api/pdfx-v2/upload', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({})) as { jobId?: string; error?: string };
      if (!response.ok || !payload.jobId) throw new Error(payload.error ?? 'Upload failed');
      router.push(`/esg/tools/pdf-translator-2/${encodeURIComponent(payload.jobId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
      setSubmitting(false);
    }
  };

  const visibleHistory = history.filter((item) => {
    if (historyFilter === 'active') return ACTIVE_STATUSES.has(item.status);
    if (historyFilter === 'completed') return item.status === 'completed';
    if (historyFilter === 'attention') return ATTENTION_STATUSES.has(item.status);
    return true;
  });

  return (
    <main className="min-h-[calc(100vh-65px)] bg-[#f3f0e8] text-slate-950">
      <header className="border-b border-slate-900/10 bg-[#132a33] text-white">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-9">
          <Link href="/esg/tools" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All ESG tools
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="rounded-full border border-[#e0b65f]/50 bg-[#e0b65f]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.2em] text-[#f1ce84]">PDF Translator</span>
                <span className="text-xs text-slate-400">OpenAI document translation</span>
              </div>
              <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">PDF translation workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Start a translation or reopen a recent document without leaving this page.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <ShieldCheck className="h-5 w-5 text-[#e0b65f]" />
              <div><p className="font-semibold text-white">Accuracy mode</p><p className="text-xs text-slate-400">One page at a time · up to 512 MB</p></div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl items-start gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[430px_minmax(0,1fr)] lg:py-9">
        <section className="rounded-2xl border border-slate-900/10 bg-[#fffdf8] p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,.6)] sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a6718]">New translation</p>
            <h2 className="mt-1 font-serif text-2xl">Choose a document</h2>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0] ?? null); }}
            className={`group flex min-h-48 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition ${dragging ? 'border-[#bd8425] bg-[#fff4d9]' : 'border-slate-300 bg-white hover:border-[#bd8425] hover:bg-[#fff9ec]'}`}
          >
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#132a33] text-white shadow-lg shadow-slate-900/15 transition group-hover:-translate-y-0.5"><UploadCloud className="h-6 w-6" /></span>
            <span className="font-serif text-xl">Drop your PDF here</span>
            <span className="mt-1 text-xs text-slate-500">or click to browse</span>
          </button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <FileCheck2 className="h-7 w-7 shrink-0 text-emerald-700" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1_048_576).toFixed(2)} MB · ready to translate</p></div>
              <button type="button" aria-label="Remove PDF" onClick={() => chooseFile(null)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4 text-[#9a6718]" />Target language</span>
            <select value={targetLang} onChange={(event) => setTargetLang(event.target.value as PdfxV2TargetLanguage)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none ring-[#d6a84b]/30 focus:border-[#b47b20] focus:ring-4">
              {PDFX_V2_SUPPORTED_LANGUAGES.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          <button type="button" disabled={!file || submitting} onClick={() => void submit()} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#bd8425] px-6 text-sm font-bold text-white shadow-lg shadow-[#9b681e]/20 transition hover:bg-[#a96e14] disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{submitting ? 'Starting translation…' : 'Start translation'}
          </button>
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-5 text-xs text-slate-600">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" />Normal or scanned PDF</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" />Tables preserved</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-[0_22px_60px_-42px_rgba(15,23,42,.6)]">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><History className="h-5 w-5 text-[#9a6718]" /><h2 className="font-serif text-2xl">Recent translations</h2></div>
                <p className="mt-1 text-xs text-slate-500">Showing {history.length} of {historyTotal} saved jobs</p>
              </div>
              <button type="button" disabled={historyLoading} onClick={() => void loadHistory()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />Refresh</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter translation history">
              {HISTORY_FILTERS.map((filter) => (
                <button key={filter.key} type="button" onClick={() => setHistoryFilter(filter.key)} aria-pressed={historyFilter === filter.key} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${historyFilter === filter.key ? 'bg-[#132a33] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter.label}</button>
              ))}
            </div>
            {deleteError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{deleteError}</p>}
          </div>
          <div className="divide-y divide-slate-100">
            {historyLoading && history.length === 0 && <div className="grid min-h-72 place-items-center text-sm text-slate-400"><LoaderCircle className="h-6 w-6 animate-spin" /><span className="sr-only">Loading translation history</span></div>}
            {!historyLoading && historyError && history.length === 0 && (
              <div className="grid min-h-72 place-items-center px-6 text-center"><div><X className="mx-auto h-8 w-8 text-red-300" /><p className="mt-3 text-sm font-semibold text-slate-700">{historyError}</p><button type="button" onClick={() => void loadHistory()} className="mt-3 text-xs font-bold text-[#9a6718] hover:underline">Try again</button></div></div>
            )}
            {!historyLoading && !historyError && visibleHistory.length === 0 && (
              <div className="grid min-h-72 place-items-center px-6 text-center"><div><FileText className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">No matching translations</p><p className="mt-1 text-xs text-slate-400">New jobs will appear here automatically.</p></div></div>
            )}
            {visibleHistory.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                deleting={deletingId === item.id}
                deleteDisabled={deletingId !== null}
                onDelete={() => void deleteTranslation(item)}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function HistoryRow({
  item,
  deleting,
  deleteDisabled,
  onDelete,
}: {
  item: HistoryItem;
  deleting: boolean;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  const isActive = ACTIVE_STATUSES.has(item.status);
  return (
    <div className="group relative transition hover:bg-[#fffaf0]">
      <Link
        href={`/esg/tools/pdf-translator-2/${item.id}`}
        className={`block py-4 pl-5 sm:pl-6 ${isActive ? 'pr-5 sm:pr-6' : 'pr-16 sm:pr-20'}`}
      >
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ATTENTION_STATUSES.has(item.status) ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            {item.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : isActive ? <LoaderCircle className={`h-5 w-5 ${item.status === 'processing' ? 'animate-spin' : ''}`} /> : <X className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.filename}</p><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span>{item.total_pages || '—'} pages</span><span aria-hidden="true">·</span><span>{item.target_lang}</span><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatHistoryDate(item.created_at)}</span></p></div>
              <div className="flex items-center gap-2"><StatusPill status={item.status} /><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#9a6718]" /></div>
            </div>
            {isActive && <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} /></div><span className="w-8 text-right font-mono text-[11px] font-bold text-slate-500">{item.progress}%</span></div>}
            {ATTENTION_STATUSES.has(item.status) && item.message && <p className="mt-2 line-clamp-1 text-xs text-red-700">{item.message}</p>}
          </div>
        </div>
      </Link>
      {!isActive && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          aria-label={`Delete translation ${item.filename}`}
          title="Delete translation"
          className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg border border-transparent text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:right-5"
        >
          {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles = status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ATTENTION_STATUSES.has(status) ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  const label = status === 'processing' ? 'Processing' : status === 'queued' ? 'Queued' : status === 'cancelling' ? 'Stopping' : status === 'cancelled' ? 'Cancelled' : status === 'error' ? 'Failed' : 'Completed';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}>{label}</span>;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
