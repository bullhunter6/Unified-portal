'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import HistoryList from '@/components/pdfx/HistoryList';
import { Upload, FileText, Download, Eye, Clock, CheckCircle, XCircle, Languages, Sparkles } from 'lucide-react';
import {
  isPdfxActiveStatus,
  isPdfxTerminalStatus,
  MAX_PDF_UPLOAD_BYTES,
  PDFX_SUPPORTED_LANGUAGES,
  type PdfxSupportedLanguage,
} from '@/lib/pdfx/constants';

const POLL_INTERVAL_MS = 1_500;
const MAX_POLL_FAILURES = 3;

export default function PdfxHome() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<PdfxSupportedLanguage>('English');
  const [jobId, setJobId] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState('');
  const [jobActionError, setJobActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const submitInFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollGenerationRef = useRef(0);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopPolling = useCallback(() => {
    pollGenerationRef.current += 1;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  }, []);

  const beginPolling = useCallback((id: string) => {
    stopPolling();
    const generation = pollGenerationRef.current;
    let consecutiveFailures = 0;

    const poll = async () => {
      if (generation !== pollGenerationRef.current) return;

      const controller = new AbortController();
      pollAbortRef.current = controller;
      let shouldContinue = false;

      try {
        const response = await fetch(`/api/pdfx/status?jobId=${encodeURIComponent(id)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await responseJson(response);
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw new PollingError(
            apiErrorMessage(payload, `Unable to check status (${response.status})`),
            retryable,
          );
        }

        const job = pdfxJobFromPayload(payload);
        consecutiveFailures = 0;
        setProgress(Math.max(0, Math.min(job.progress, 100)));
        setMessage(job.message || humanizeStatus(job.status));
        setStatus(job.status);

        if (isPdfxTerminalStatus(job.status)) {
          pollAbortRef.current = null;
          return;
        }
        if (!isPdfxActiveStatus(job.status)) {
          setStatus('error');
          setMessage(`The service returned an unknown job status: ${job.status}`);
          pollAbortRef.current = null;
          return;
        }
        shouldContinue = true;
      } catch (caught) {
        if (controller.signal.aborted || generation !== pollGenerationRef.current) return;

        const retryable = !(caught instanceof PollingError) || caught.retryable;
        consecutiveFailures += 1;
        if (retryable && consecutiveFailures < MAX_POLL_FAILURES) {
          setMessage(`Connection interrupted. Retrying (${consecutiveFailures}/${MAX_POLL_FAILURES})…`);
          shouldContinue = true;
        } else {
          setStatus('error');
          setMessage(caught instanceof Error ? caught.message : 'Unable to check translation status');
        }
      } finally {
        if (pollAbortRef.current === controller) pollAbortRef.current = null;
      }

      if (shouldContinue && generation === pollGenerationRef.current) {
        pollTimerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
  }, [stopPolling]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const selectFile = (nextFile: File | null) => {
    setFormError('');
    if (!nextFile) {
      setFile(null);
      return;
    }
    const looksLikePdf =
      nextFile.type === 'application/pdf' ||
      (!nextFile.type && nextFile.name.toLowerCase().endsWith('.pdf'));
    if (!looksLikePdf) {
      setFile(null);
      setFormError('Choose a PDF file.');
      return;
    }
    if (nextFile.size <= 0) {
      setFile(null);
      setFormError('The selected PDF is empty.');
      return;
    }
    if (nextFile.size > MAX_PDF_UPLOAD_BYTES) {
      setFile(null);
      setFormError('The selected PDF exceeds the 20 MB limit.');
      return;
    }
    setFile(nextFile);
  };

  const startUpload = async () => {
    if (!file || submitInFlightRef.current || isPdfxActiveStatus(status)) return;

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setFormError('');
    setJobActionError('');
    stopPolling();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetLang', lang);

    try {
      const response = await fetch('/api/pdfx/upload', {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await responseJson(response);
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, `Upload failed (${response.status})`));
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('The upload service returned an invalid response');
      }
      const record = payload as Record<string, unknown>;
      if (record.success !== true || typeof record.jobId !== 'string' || !record.jobId) {
        throw new Error(apiErrorMessage(payload, 'Upload failed'));
      }

      setJobId(record.jobId);
      setProgress(0);
      setMessage('Queued');
      setStatus('queued');
      beginPolling(record.jobId);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setFormError(caught instanceof Error ? caught.message : 'Upload failed');
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const cancelJob = async () => {
    if (!jobId || isCancelling || !isPdfxActiveStatus(status)) return;

    setIsCancelling(true);
    setJobActionError('');
    try {
      const response = await fetch('/api/pdfx/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const payload = await responseJson(response);
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, `Unable to cancel job (${response.status})`));
      }
      const returnedStatus = objectString(payload, 'status');
      if (returnedStatus === 'cancelled') {
        stopPolling();
        setStatus('cancelled');
        setProgress(100);
        setMessage('Cancelled');
      } else {
        setStatus('cancelling');
        setMessage('Cancelling…');
      }
    } catch (caught) {
      setJobActionError(caught instanceof Error ? caught.message : 'Unable to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      uploadAbortRef.current?.abort();
    };
  }, [stopPolling]);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm text-white/90 backdrop-blur-sm mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Translation
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              PDF Translator
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/90 max-w-2xl mx-auto">
              Translate PDF documents into English, Arabic, or Russian with context-aware AI.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center p-1 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-white/50">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'upload'
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
            >
              <Upload className="h-4 w-4" />
              New Translation
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'history'
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
            >
              <Clock className="h-4 w-4" />
              History
            </button>
          </div>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Upload Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your PDF</h2>
                  <p className="text-gray-600">Select a PDF document to translate into your preferred language</p>
                </div>

                {/* File Upload Area */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : file
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={e => selectFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-lg font-medium text-green-700">{file.name}</p>
                        <p className="text-sm text-green-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        Drop your PDF here, or click to browse
                      </p>
                      <p className="text-sm text-gray-500">Supports PDF files up to 20 MB</p>
                    </div>
                  )}
                </div>

                {formError && (
                  <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                {/* Language Selection */}
                <div className="mt-8">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <Languages className="inline h-4 w-4 mr-2" />
                    Target Language
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={lang}
                    onChange={e => setLang(e.target.value as PdfxSupportedLanguage)}
                  >
                    {PDFX_SUPPORTED_LANGUAGES.map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </select>
                </div>

                {/* Start Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={startUpload}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-medium rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    disabled={!file || isSubmitting || isPdfxActiveStatus(status)}
                  >
                    <Sparkles className="h-5 w-5" />
                    {isSubmitting ? 'Uploading…' : isPdfxActiveStatus(status) ? 'Translation in progress' : 'Start Translation'}
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Card */}
            {jobId && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Translation Progress</h3>
                      <p className="text-sm text-gray-500 font-mono">Job ID: {jobId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'completed' ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : ['error', 'failed', 'cancelled', 'stopped'].includes(status) ? (
                        <XCircle className="h-6 w-6 text-red-500" />
                      ) : (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : ['error', 'failed'].includes(status)
                          ? 'bg-red-100 text-red-700'
                          : ['cancelled', 'stopped'].includes(status)
                            ? 'bg-gray-200 text-gray-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>
                        {humanizeStatus(status)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{message}</span>
                      <span className="text-sm font-medium text-gray-900">{Math.max(0, Math.min(progress, 100))}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                      />
                    </div>
                  </div>
                  {jobActionError && (
                    <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {jobActionError}
                    </div>
                  )}
                  {isPdfxActiveStatus(status) && (
                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => void cancelJob()}
                        disabled={isCancelling || status === 'cancelling'}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCancelling || status === 'cancelling' ? 'Cancelling…' : 'Cancel translation'}
                      </button>
                    </div>
                  )}
                  {/* Action Buttons */}
                  {status === 'completed' && (
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Link
                        href={`/esg/pdfx/${jobId}/view`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View Translation
                      </Link>
                      <a
                        href={`/api/pdfx/download?jobId=${jobId}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 overflow-hidden">
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                    <Clock className="h-8 w-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Translation History</h2>
                  <p className="text-gray-600">Manage and access all your translated documents</p>
                </div>
                <HistoryList />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

class PollingError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'PollingError';
  }
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  return objectString(payload, 'error') || fallback;
}

function objectString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const result = (value as Record<string, unknown>)[key];
  return typeof result === 'string' ? result : '';
}

function pdfxJobFromPayload(payload: unknown): {
  status: string;
  message: string;
  progress: number;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PollingError('The status service returned an invalid response', false);
  }
  const root = payload as Record<string, unknown>;
  if (root.success !== true || !root.job || typeof root.job !== 'object' || Array.isArray(root.job)) {
    throw new PollingError(apiErrorMessage(payload, 'The status service returned an invalid response'), false);
  }
  const job = root.job as Record<string, unknown>;
  if (typeof job.status !== 'string' || typeof job.progress !== 'number') {
    throw new PollingError('The status service returned an invalid job state', false);
  }
  return {
    status: job.status,
    message: typeof job.message === 'string' ? job.message : '',
    progress: Number.isFinite(job.progress) ? job.progress : 0,
  };
}

function humanizeStatus(status: string): string {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
