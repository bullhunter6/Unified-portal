"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, Clock, Filter, Check, X, Loader2, Send } from "lucide-react";

type AlertPreferences = {
  domain: "esg" | "credit";
  weekly_digest: boolean;
  daily_digest: boolean;
  immediate_alerts: boolean;
  alert_articles: boolean;
  alert_events: boolean;
  alert_publications: boolean;
  sources: string[];
  keywords: string[];
  team_likes_only: boolean;
  email_enabled: boolean;
  email_address: string;
  digest_day: string;
  digest_hour: number;
  timezone: string;
};

export default function AlertSettings({ domain }: { domain: "esg" | "credit" }) {
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/alerts/preferences?domain=${domain}`);
      const data = await res.json();
      if (data.success) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch("/api/alerts/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Alert preferences saved successfully!" });
        setPreferences(data.preferences);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save preferences" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save preferences" });
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async (alertType: "weekly_digest" | "daily_digest" | "immediate") => {
    try {
      setSendingTest(true);
      setMessage(null);

      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, alertType }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send test email" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to send test email" });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-gray-600">Loading preferences...</span>
      </div>
    );
  }

  if (!preferences) return null;

  const domainColor = domain === "esg" ? "emerald" : "blue";

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Alert Types */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">Alert Types</h3>
        </div>

        <div className="space-y-4">
          {/* Weekly Digest */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.weekly_digest}
              onChange={(e) =>
                setPreferences({ ...preferences, weekly_digest: e.target.checked })
              }
              className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Weekly Digest</div>
              <p className="text-sm text-gray-500">
                Get a summary of team-liked articles every Monday at 9 AM
              </p>
            </div>
            <button
              onClick={() => sendTestEmail("weekly_digest")}
              disabled={sendingTest}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Test
            </button>
          </label>

          {/* Daily Digest */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.daily_digest}
              onChange={(e) =>
                setPreferences({ ...preferences, daily_digest: e.target.checked })
              }
              className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Daily Digest</div>
              <p className="text-sm text-gray-500">
                Get new articles published in the last 24 hours
              </p>
              {preferences.daily_digest && (
                <div className="mt-2">
                  <label className="text-sm text-gray-700">
                    Send at:{" "}
                    <select
                      value={preferences.digest_hour}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          digest_hour: parseInt(e.target.value),
                        })
                      }
                      className="ml-2 px-2 py-1 border border-gray-300 rounded"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
            <button
              onClick={() => sendTestEmail("daily_digest")}
              disabled={sendingTest}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Test
            </button>
          </label>

          {/* Immediate Alerts */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.immediate_alerts}
              onChange={(e) =>
                setPreferences({ ...preferences, immediate_alerts: e.target.checked })
              }
              className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Immediate Alerts</div>
              <p className="text-sm text-gray-500">
                Get notified immediately when new content is published
              </p>
            </div>
            <button
              onClick={() => sendTestEmail("immediate")}
              disabled={sendingTest}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Test
            </button>
          </label>
        </div>
      </div>

      {/* Content Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">Content Filters</h3>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Content Types</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.alert_articles}
                  onChange={(e) =>
                    setPreferences({ ...preferences, alert_articles: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Articles</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.alert_events}
                  onChange={(e) =>
                    setPreferences({ ...preferences, alert_events: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Events</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.alert_publications}
                  onChange={(e) =>
                    setPreferences({ ...preferences, alert_publications: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Publications</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.team_likes_only}
              onChange={(e) =>
                setPreferences({ ...preferences, team_likes_only: e.target.checked })
              }
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Only show content liked by my team</span>
          </label>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">Email Settings</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.email_enabled}
              onChange={(e) =>
                setPreferences({ ...preferences, email_enabled: e.target.checked })
              }
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Enable email notifications</span>
          </label>

          {preferences.email_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address (optional)
              </label>
              <input
                type="email"
                value={preferences.email_address}
                onChange={(e) =>
                  setPreferences({ ...preferences, email_address: e.target.value })
                }
                placeholder="Override default email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use your account email
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={fetchPreferences}
          disabled={saving}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
        >
          Reset
        </button>
        <button
          onClick={savePreferences}
          disabled={saving}
          className={`px-6 py-2 bg-${domainColor}-600 text-white rounded-lg hover:bg-${domainColor}-700 font-medium flex items-center gap-2`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
