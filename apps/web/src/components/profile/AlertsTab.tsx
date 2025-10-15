"use client";

import { useState } from "react";
import { Bell, History } from "lucide-react";
import AlertSettingsNew from "./AlertSettingsNew";
import AlertHistory from "./AlertHistory";

export default function AlertsTab({ domain }: { domain: "esg" | "credit" }) {
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Bell className="w-4 h-4" />
            Alert Settings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <History className="w-4 h-4" />
            Alert History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "settings" && <AlertSettingsNew domain={domain} />}
        {activeTab === "history" && <AlertHistory domain={domain} />}
      </div>
    </div>
  );
}
