'use client';

import useSWR from 'swr';
import { isPdfxActiveStatus } from '@/lib/pdfx/constants';

export type PdfxHistoryItem = {
  id: string;
  filename: string;
  stored_filename: string;
  status: string;
  message: string | null;
  progress: number;
  total_pages: number;
  created_at: string;
  updated_at: string;
  canDownload: boolean;
};

type PdfxHistoryResponse = {
  items: PdfxHistoryItem[];
  total: number;
  page: number;
  size: number;
};

async function fetchHistory(url: string): Promise<PdfxHistoryResponse> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, `Unable to load history (${response.status})`));
  }
  if (!isHistoryResponse(payload)) {
    throw new Error('The history service returned an invalid response');
  }

  return payload;
}

export function usePdfxHistory(page = 1, size = 20) {
  const { data, error, mutate, isLoading, isValidating } = useSWR<PdfxHistoryResponse>(
    `/api/pdfx/history?page=${page}&size=${size}`,
    fetchHistory,
    {
      keepPreviousData: true,
      errorRetryCount: 2,
      refreshInterval: (latest) =>
        latest?.items.some((item) => isPdfxActiveStatus(item.status)) ? 5_000 : 0,
    },
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page,
    size,
    isLoading,
    isValidating,
    error: error instanceof Error ? error : null,
    refresh: mutate,
  };
}

function isHistoryResponse(value: unknown): value is PdfxHistoryResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.items) &&
    record.items.every(isHistoryItem) &&
    typeof record.total === 'number' &&
    typeof record.page === 'number' &&
    typeof record.size === 'number'
  );
}

function isHistoryItem(value: unknown): value is PdfxHistoryItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.filename === 'string' &&
    typeof record.status === 'string' &&
    typeof record.canDownload === 'boolean'
  );
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}
