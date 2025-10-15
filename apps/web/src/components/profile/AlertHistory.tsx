"use client";

import { useState, useEffect } from "react";
import { History, Mail, MailOpen, MousePointerClick, Calendar, Filter, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/date";

type AlertHistoryItem = {
  id: number;
  alert_type: string;
  subject: string;
  sent_at: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  metadata: any;
};

type HistoryStats = {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
};

export default function AlertHistory({ domain }: { domain: "esg" | "credit" }) {
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, page, filterType]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        domain,
        page: page.toString(),
        pageSize: "10",
      });

      if (filterType !== "all") {
        params.append("alertType", filterType);
      }

      const res = await fetch(`/api/alerts/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.history);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case "weekly_digest":
        return "Weekly Digest";
      case "daily_digest":
        return "Daily Digest";
      case "immediate":
        return "Immediate Alert";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      sent: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    };

    // Handle undefined or null status
    const displayStatus = status || "unknown";

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          styles[displayStatus as keyof typeof styles] || "bg-gray-100 text-gray-800"
        }`}
      >
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </span>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-600">Loading history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MailOpen className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">Sent</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-600">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MailOpen className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">Opened</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.opened}</p>
            {stats.sent > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((stats.opened / stats.sent) * 100)}% rate
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600">Clicked</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.clicked}</p>
            {stats.sent > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((stats.clicked / stats.sent) * 100)}% rate
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                filterType === "all"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("weekly_digest")}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                filterType === "weekly_digest"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setFilterType("daily_digest")}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                filterType === "daily_digest"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setFilterType("immediate")}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                filterType === "immediate"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Immediate
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200">
          <History className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">Alert History</h3>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No alerts sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {history.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{item.subject}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getAlertTypeLabel(item.alert_type)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {fmtDate(item.sent_at)}
                    </div>
                    <div>{new Date(item.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                  </div>
                </div>

                {/* Engagement Indicators */}
                <div className="flex items-center gap-4 mt-2">
                  {item.opened_at && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <MailOpen className="w-3 h-3" />
                      <span>Opened {fmtDate(item.opened_at)} at {new Date(item.opened_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                  )}
                  {item.clicked_at && (
                    <div className="flex items-center gap-1 text-xs text-purple-600">
                      <MousePointerClick className="w-3 h-3" />
                      <span>Clicked {fmtDate(item.clicked_at)} at {new Date(item.clicked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                {item.metadata?.article_count && (
                  <div className="mt-2 text-xs text-gray-500">
                    {item.metadata.article_count} articles
                    {item.metadata.event_count && `, ${item.metadata.event_count} events`}
                    {item.metadata.publication_count &&
                      `, ${item.metadata.publication_count} publications`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
