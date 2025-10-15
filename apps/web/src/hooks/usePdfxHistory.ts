'use client';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function usePdfxHistory(page = 1, size = 20) {
  const { data, error, mutate, isLoading } = useSWR(
    `/api/pdfx/history?page=${page}&size=${size}`,
    fetcher,
    { refreshInterval: 10_000 } // auto-refresh every 10 seconds
  );
  
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    page,
    size,
    isLoading,
    error,
    refresh: mutate,
  };
}