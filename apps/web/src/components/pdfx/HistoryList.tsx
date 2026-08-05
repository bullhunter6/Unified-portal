'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Trash2,
  XCircle,
} from 'lucide-react';
import { usePdfxHistory } from '@/hooks/usePdfxHistory';
import { isPdfxActiveStatus } from '@/lib/pdfx/constants';

export default function HistoryList() {
  const [page, setPage] = useState(1);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState('');
  const { items, total, size, isLoading, isValidating, error, refresh } =
    usePdfxHistory(page, 20);
  const totalPages = Math.max(1, Math.ceil(total / size));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onDelete = async (id: string) => {
    if (deletingIds.has(id) || !confirm('Delete this translation job and its files?')) return;

    setActionError('');
    setDeletingIds((current) => new Set(current).add(id));
    try {
      const response = await fetch(`/api/pdfx/job/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, `Unable to delete job (${response.status})`));
      }
      await refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Unable to delete job');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  if (isLoading && items.length === 0) {
    return <div className="text-sm text-muted-foreground">Loading history…</div>;
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error.message}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(actionError || error) && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError || error?.message}
        </div>
      )}

      {items.length === 0 && (
        <div className="py-12 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">No translations yet</h3>
          <p className="text-gray-500">Upload a PDF to get started with your first translation.</p>
        </div>
      )}

      <div className="grid gap-4" aria-busy={isValidating}>
        {items.map((job) => {
          const active = isPdfxActiveStatus(job.status);
          const completed = job.status === 'completed';
          const failed = job.status === 'error' || job.status === 'failed';
          const cancelled = job.status === 'cancelled' || job.status === 'stopped';
          const deleting = deletingIds.has(job.id);
          const progress = Math.max(0, Math.min(Number(job.progress) || 0, 100));

          return (
            <div
              key={job.id}
              className="rounded-xl border border-white/50 bg-white/60 p-6 backdrop-blur-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 truncate font-semibold text-gray-900">{job.filename}</h3>
                    <div className="mb-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>{formatDate(job.created_at)}</span>
                      <span aria-hidden="true">•</span>
                      <span>{job.total_pages ?? 0} pages</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                        completed
                          ? 'bg-green-100 text-green-700'
                          : failed
                            ? 'bg-red-100 text-red-700'
                            : cancelled
                              ? 'bg-gray-200 text-gray-700'
                              : active
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-800'
                      }`}>
                        {completed && <CheckCircle className="h-3 w-3" />}
                        {failed && <XCircle className="h-3 w-3" />}
                        {active && <LoaderCircle className="h-3 w-3 animate-spin" />}
                        {humanizeStatus(job.status)}
                      </span>
                      {job.message && <span className="text-xs text-gray-500">{job.message}</span>}
                    </div>

                    {active && (
                      <div className="mt-3 w-full max-w-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-gray-500">Progress</span>
                          <span className="text-xs font-medium text-gray-700">{progress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/esg/pdfx/${encodeURIComponent(job.id)}/view`}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>

                  {job.canDownload ? (
                    <a
                      href={`/api/pdfx/download?jobId=${encodeURIComponent(job.id)}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="The translated PDF will be available when processing completes"
                      className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void onDelete(job.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > size && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
}
