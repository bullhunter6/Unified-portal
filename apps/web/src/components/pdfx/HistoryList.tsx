'use client';

import { usePdfxHistory } from '@/hooks/usePdfxHistory';
import Link from 'next/link';
import { useState } from 'react';
import { FileText, Eye, Download, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryList() {
  const [page, setPage] = useState(1);
  const { items, total, size, isLoading, refresh } = usePdfxHistory(page, 20);

  const onDelete = async (id: string) => {
    const ok = confirm('Delete this translation job and its files?');
    if (!ok) return;
    
    try {
      const res = await fetch(`/api/pdfx/job/${id}`, { method: 'DELETE' });
      if (res.ok) {
        refresh();
      } else {
        alert('Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job');
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading history…</div>;

  return (
    <div className="space-y-6">
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No translations yet</h3>
          <p className="text-gray-500">Upload a PDF to get started with your first translation.</p>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((job: any) => (
          <div key={job.id} className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/50 p-6 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* File Info */}
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate mb-1">{job.filename}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{job.total_pages ?? 0} pages</span>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      job.status === 'completed' 
                        ? 'bg-green-100 text-green-700' 
                        : job.status === 'error' 
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {job.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                      {job.status === 'error' && <XCircle className="h-3 w-3" />}
                      {job.status !== 'completed' && job.status !== 'error' && (
                        <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                      )}
                      {job.status}
                    </span>
                    {job.message && (
                      <span className="text-xs text-gray-500">{job.message}</span>
                    )}
                  </div>
                  
                  {/* Progress Bar for Active Jobs */}
                  {job.status !== 'completed' && job.status !== 'error' && (
                    <div className="mt-3 w-full max-w-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Progress</span>
                        <span className="text-xs font-medium text-gray-700">{job.progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(job.progress ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/esg/pdfx/${job.id}/view`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Link>

                <button
                  disabled={job.status !== 'completed' || !job.output_path}
                  onClick={() => window.open(`/api/pdfx/download?jobId=${job.id}`, '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>

                <button
                  onClick={() => onDelete(job.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > size && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(total / size)}
            </span>
          </div>
          
          <button
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={page * size >= total}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}