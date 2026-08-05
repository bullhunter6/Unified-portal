'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isPdfxActiveStatus, isPdfxTerminalStatus } from '@/lib/pdfx/constants';
import { 
  ChevronLeft, 
  ChevronRight, 
  SkipBack, 
  SkipForward, 
  Book, 
  BookOpen, 
  Download, 
  ArrowLeft, 
  Copy, 
  Check,
  XCircle,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';

type PagePayload = {
  pageNumber: number;
  originalText: string;
  translatedText: string;
};

export default function PdfView() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [pages, setPages] = useState<PagePayload[]>([]);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'single' | 'continuous'>('single');
  const [loading, setLoading] = useState(true);
  const [jobStatus, setJobStatus] = useState('queued');
  const [jobMessage, setJobMessage] = useState('Loading translation…');
  const [jobProgress, setJobProgress] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let failures = 0;

    const load = async () => {
      controller = new AbortController();
      try {
        const statusResponse = await fetch(`/api/pdfx/status?jobId=${encodeURIComponent(jobId)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const statusPayload = await readJson(statusResponse);
        if (!statusResponse.ok) {
          throw new Error(apiError(statusPayload, `Unable to load translation (${statusResponse.status})`));
        }
        const state = readJobState(statusPayload);
        if (disposed) return;

        failures = 0;
        setJobStatus(state.status);
        setJobMessage(state.message || humanizeStatus(state.status));
        setJobProgress(Math.max(0, Math.min(state.progress, 100)));

        if (state.status === 'completed') {
          const pagesResponse = await fetch(`/api/pdfx/pages?jobId=${encodeURIComponent(jobId)}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          });
          const pagesPayload = await readJson(pagesResponse);
          if (!pagesResponse.ok) {
            throw new Error(apiError(pagesPayload, `Unable to load pages (${pagesResponse.status})`));
          }
          const loadedPages = readPages(pagesPayload);
          if (!disposed) {
            setPages(loadedPages);
            setPage(loadedPages[0]?.pageNumber ?? 1);
            setLoading(false);
          }
          return;
        }

        if (isPdfxTerminalStatus(state.status)) {
          setLoading(false);
          return;
        }
        if (!isPdfxActiveStatus(state.status)) {
          throw new Error(`The service returned an unknown job status: ${state.status}`);
        }

        timer = setTimeout(() => void load(), 1_500);
      } catch (caught) {
        if (disposed || controller?.signal.aborted) return;
        failures += 1;
        if (failures < 3) {
          setJobMessage(`Connection interrupted. Retrying (${failures}/3)…`);
          timer = setTimeout(() => void load(), 1_500);
        } else {
          setLoadError(caught instanceof Error ? caught.message : 'Unable to load this translation');
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [jobId]);

  const total = pages.length;
  const current = pages.find(p => p.pageNumber === page);

  const copyToClipboard = async (text: string, type: 'original' | 'translated') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const goToPage = (pageNum: number) => {
    setPage(Math.max(1, Math.min(total, pageNum)));
  };

  const filteredPages = pages.filter(p => 
    searchTerm === '' || 
    p.originalText.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.translatedText.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="flex items-center justify-center h-64">
          <div className="w-full max-w-md rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{humanizeStatus(jobStatus)}</p>
                <p className="truncate text-sm text-gray-600">{jobMessage}</p>
              </div>
              <span className="text-sm font-medium text-gray-700">{jobProgress}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${jobProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || jobStatus !== 'completed') {
    const cancelled = jobStatus === 'cancelled' || jobStatus === 'stopped';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/50 bg-white/90 p-8 text-center shadow-xl">
          <XCircle className={`mx-auto h-12 w-12 ${cancelled ? 'text-gray-500' : 'text-red-500'}`} />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {cancelled ? 'Translation cancelled' : 'Unable to open translation'}
          </h1>
          <p role="alert" className="mt-2 text-sm text-gray-600">
            {loadError || jobMessage || humanizeStatus(jobStatus)}
          </p>
          <Link href="/esg/pdfx" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" />
            Back to PDF Translator
          </Link>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/50 bg-white/90 p-8 text-center shadow-xl">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">No page text is available</h1>
          <p className="mt-2 text-sm text-gray-600">
            The translation completed, but it did not produce readable page text. You can still download the generated PDF.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/esg/pdfx" className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <a href={`/api/pdfx/download?jobId=${encodeURIComponent(jobId)}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/50 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href={`/esg/pdfx`}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to PDF Translator
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                PDF Translation Viewer
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <a
                href={`/api/pdfx/download?jobId=${jobId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="inline-flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMode('single')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    mode === 'single'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Book className="h-4 w-4" />
                  Single Page
                </button>
                <button
                  onClick={() => setMode('continuous')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    mode === 'continuous'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  Continuous
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search in pages..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value) setMode('continuous');
                  }}
                  className="pl-10 pr-4 py-2 bg-white/80 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64"
                />
              </div>

              {/* Font Size Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(f => Math.max(10, f - 2))}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  title="Decrease font size"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                  {fontSize}px
                </span>
                <button
                  onClick={() => setFontSize(f => Math.min(24, f + 2))}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  title="Increase font size"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setFontSize(14)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  title="Reset font size"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Single Page Navigation */}
          {mode === 'single' && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => goToPage(1)}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Page</span>
                <input
                  type="number"
                  min={1}
                  max={total}
                  value={page}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 text-center bg-white border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <span className="text-sm text-gray-600">of {total}</span>
              </div>

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === total}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => goToPage(total)}
                disabled={page === total}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {mode === 'single' && current && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Original Text */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="font-medium text-gray-900">Original Text</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(current.originalText, 'original')}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    {copiedText === 'original' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedText === 'original' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-auto max-h-[70vh]">
                <pre 
                  className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {current.originalText || (
                    <span className="text-gray-400 italic">No original text available for this page</span>
                  )}
                </pre>
              </div>
            </div>

            {/* Translated Text */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-gray-900">Translated Text</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(current.translatedText, 'translated')}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-900 hover:bg-blue-200 rounded-md transition-colors"
                  >
                    {copiedText === 'translated' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedText === 'translated' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-auto max-h-[70vh]">
                <pre 
                  className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {current.translatedText || (
                    <span className="text-gray-400 italic">No translation available for this page</span>
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}

        {mode === 'continuous' && (
          <div className="space-y-8">
            {(searchTerm ? filteredPages : pages).map((p, index) => (
              <div key={p.pageNumber} className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Original Text */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <span className="font-medium text-gray-900">Original - Page {p.pageNumber}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(p.originalText, 'original')}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="p-6 overflow-auto">
                    <pre 
                      className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {p.originalText || (
                        <span className="text-gray-400 italic">No original text available for this page</span>
                      )}
                    </pre>
                  </div>
                </div>

                {/* Translated Text */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="font-medium text-gray-900">Translated - Page {p.pageNumber}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(p.translatedText, 'translated')}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-900 hover:bg-blue-200 rounded-md transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="p-6 overflow-auto">
                    <pre 
                      className="whitespace-pre-wrap text-gray-800 leading-relaxed"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      {p.translatedText || (
                        <span className="text-gray-400 italic">No translation available for this page</span>
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
            
            {searchTerm && filteredPages.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function apiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

function readJobState(payload: unknown): { status: string; message: string; progress: number } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The status service returned an invalid response');
  }
  const root = payload as Record<string, unknown>;
  if (root.success !== true || !root.job || typeof root.job !== 'object' || Array.isArray(root.job)) {
    throw new Error(apiError(payload, 'The status service returned an invalid response'));
  }
  const job = root.job as Record<string, unknown>;
  if (typeof job.status !== 'string' || typeof job.progress !== 'number') {
    throw new Error('The status service returned an invalid job state');
  }
  return {
    status: job.status,
    message: typeof job.message === 'string' ? job.message : '',
    progress: Number.isFinite(job.progress) ? job.progress : 0,
  };
}

function readPages(payload: unknown): PagePayload[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The page service returned an invalid response');
  }
  const root = payload as Record<string, unknown>;
  if (root.success !== true || !Array.isArray(root.pages)) {
    throw new Error(apiError(payload, 'The page service returned an invalid response'));
  }

  const pages = root.pages.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The page service returned an invalid page');
    }
    const page = value as Record<string, unknown>;
    if (!Number.isSafeInteger(page.pageNumber) || Number(page.pageNumber) < 1) {
      throw new Error('The page service returned an invalid page number');
    }
    return {
      pageNumber: Number(page.pageNumber),
      originalText: typeof page.originalText === 'string' ? page.originalText : '',
      translatedText: typeof page.translatedText === 'string' ? page.translatedText : '',
    };
  });

  return pages.sort((left, right) => left.pageNumber - right.pageNumber);
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
