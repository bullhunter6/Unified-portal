"use client";

import { useEffect, useState, useCallback } from "react";

interface Alert {
  id: number;
  user_id: number;
  alert_name: string;
  alert_type: string;
  is_active: boolean;
  email_enabled: boolean;
  sources: string[];
  keywords: string[];
  immediate_sources: string[];
  immediate_keywords: string[];
  domains: string[];
  last_sent_at: string | null;
  created_at: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  total_sent: string;
}

interface Metrics {
  overview: {
    totalAlerts: number;
    activeAlerts: number;
    inactiveAlerts: number;
    pausedAlerts: number;
  };
  alertsByType: Array<{ alert_type: string; count: number }>;
  topAlerts: Array<{
    id: number;
    alert_name: string;
    alert_type: string;
    email: string;
    items_sent: number;
  }>;
}

export default function AlertManagementPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedAlerts, setSelectedAlerts] = useState<number[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter }),
      });

      const res = await fetch(`/api/admin/alerts?${params}`);
      console.log("Fetch response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("Alerts data:", data);
        setAlerts(data.alerts);
        setTotalPages(data.pagination.totalPages);
      } else {
        const error = await res.json();
        console.error("Error response:", error);
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/admin/alerts/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchMetrics();
  }, [fetchAlerts]);

  const handleBulkAction = async (action: string) => {
    if (selectedAlerts.length === 0) {
      alert("Please select alerts first");
      return;
    }

    const confirmMsg =
      action === "delete"
        ? "Are you sure you want to delete selected alerts?"
        : `Are you sure you want to ${action} selected alerts?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/alerts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          alertIds: selectedAlerts,
        }),
      });

      if (res.ok) {
        fetchAlerts();
        fetchMetrics();
        setSelectedAlerts([]);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to perform bulk action");
      }
    } catch (error) {
      console.error("Error performing bulk action:", error);
      alert("Failed to perform bulk action");
    }
  };

  const toggleAlert = async (alertId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        fetchAlerts();
        fetchMetrics();
      }
    } catch (error) {
      console.error("Error toggling alert:", error);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;

    try {
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAlerts();
        fetchMetrics();
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedAlerts.length === alerts.length) {
      setSelectedAlerts([]);
    } else {
      setSelectedAlerts(alerts.map((a) => a.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Alert Management</h1>
        <p className="mt-2 text-gray-600">
          Manage all user alerts, preferences, and performance metrics
        </p>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Alerts</p>
            <p className="text-3xl font-bold text-blue-600">
              {metrics.overview.totalAlerts}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-3xl font-bold text-green-600">
              {metrics.overview.activeAlerts}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Paused</p>
            <p className="text-3xl font-bold text-orange-600">
              {metrics.overview.pausedAlerts}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Inactive (30d)</p>
            <p className="text-3xl font-bold text-red-600">
              {metrics.overview.inactiveAlerts}
            </p>
          </div>
        </div>
      )}

      {/* Filters & Bulk Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search alerts, users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Paused</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="immediate_alerts">Immediate</option>
            <option value="daily_digest">Daily Digest</option>
            <option value="weekly_digest">Weekly Digest</option>
          </select>
        </div>

        {selectedAlerts.length > 0 && (
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              {selectedAlerts.length} selected
            </span>
            <button
              onClick={() => handleBulkAction("pause")}
              className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
            >
              Pause
            </button>
            <button
              onClick={() => handleBulkAction("resume")}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Resume
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No alerts found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.length === alerts.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Alert Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      User
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Items Sent
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Last Sent
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.includes(alert.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAlerts([...selectedAlerts, alert.id]);
                            } else {
                              setSelectedAlerts(
                                selectedAlerts.filter((id) => id !== alert.id)
                              );
                            }
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-900">
                          {alert.alert_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {alert.keywords.length > 0 && `${alert.keywords.length} keywords`}
                          {alert.keywords.length > 0 && alert.sources.length > 0 && " • "}
                          {alert.sources.length > 0 && `${alert.sources.length} sources`}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <p>{alert.email}</p>
                        <p className="text-xs text-gray-500">
                          {alert.team?.toUpperCase()}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                          {alert.alert_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleAlert(alert.id, alert.is_active)}
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            alert.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {alert.is_active ? "Active" : "Paused"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {alert.total_sent}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {alert.last_sent_at
                          ? new Date(alert.last_sent_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="px-3 py-1 text-sm text-red-700 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Top Alerts */}
      {metrics && metrics.topAlerts.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Most Active Alerts (Last 30 Days)
          </h2>
          <div className="space-y-2">
            {metrics.topAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {alert.alert_name}
                  </p>
                  <p className="text-xs text-gray-500">{alert.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {alert.items_sent}
                  </p>
                  <p className="text-xs text-gray-500">items sent</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
