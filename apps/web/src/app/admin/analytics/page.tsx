"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  userEngagement?: any;
  content?: any;
  alerts?: any;
  teams?: any;
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "content" | "alerts" | "teams">("overview");

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [userEngagement, content, alerts, teams] = await Promise.all([
        fetch(`/api/admin/analytics/user-engagement?days=${days}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/content?days=${days}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/alerts?days=${days}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/teams?days=${days}`).then((r) => r.json()),
      ]);

      setData({ userEngagement, content, alerts, teams });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => {
    if (!data.userEngagement || !data.content || !data.alerts) return null;

    return (
      <div className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold mt-1">{data.userEngagement.overview.totalUsers.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.userEngagement.overview.activeUsers} active in last {days} days
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Content</div>
            <div className="text-2xl font-bold mt-1">{data.content.overview.totalArticles.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.content.overview.recentArticles} published in last {days} days
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Alerts</div>
            <div className="text-2xl font-bold mt-1">{data.alerts.overview.totalAlerts.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.alerts.overview.activeAlerts} active
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Content Sent</div>
            <div className="text-2xl font-bold mt-1">{data.alerts.overview.totalContentSent.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">
              {data.alerts.overview.recentContentSent} in last {days} days
            </div>
          </div>
        </div>

        {/* User Engagement & Alerts by Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Users by Team</h3>
            <div className="space-y-2">
              {data.userEngagement.usersByTeam.slice(0, 5).map((item: any) => (
                <div key={item.team} className="flex justify-between items-center">
                  <span className="text-sm">{item.team}</span>
                  <span className="text-sm font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Alerts by Type</h3>
            <div className="space-y-2">
              {data.alerts.alertsByType.map((item: any) => (
                <div key={item.alert_type} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{item.alert_type}</span>
                  <span className="text-sm">
                    <span className="font-semibold text-green-600">{item.active_count}</span>
                    <span className="text-gray-400"> / {item.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">New Users (Last {days} Days)</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {data.userEngagement.newUsers.slice(0, 10).map((item: any) => (
                <div key={item.date} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{new Date(item.date).toLocaleDateString()}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Content Sent (Last {days} Days)</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {data.alerts.contentSentOverTime.slice(0, 10).map((item: any) => (
                <div key={item.date} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{new Date(item.date).toLocaleDateString()}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (!data.userEngagement) return null;

    return (
      <div className="space-y-6">
        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-2xl font-bold mt-1">{data.userEngagement.overview.totalUsers.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Active Users</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{data.userEngagement.overview.activeUsers.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Users with Alerts</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{data.userEngagement.overview.usersWithAlerts.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Likes</div>
            <div className="text-2xl font-bold mt-1 text-purple-600">{data.userEngagement.overview.totalLikes.toLocaleString()}</div>
          </div>
        </div>

        {/* Top Likers */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4">Top Likers</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Likes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.userEngagement.topLikers.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-sm">{user.team || "N/A"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-purple-600">{user.like_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Users by Team */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-bold mb-4">Users by Team</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.userEngagement.usersByTeam.map((item: any) => (
              <div key={item.team} className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-600">{item.team}</div>
                <div className="text-xl font-bold mt-1">{item.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!data.content) return null;

    return (
      <div className="space-y-6">
        {/* Content Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Articles</div>
            <div className="text-2xl font-bold mt-1">{data.content.overview.totalArticles.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Events</div>
            <div className="text-2xl font-bold mt-1">{data.content.overview.totalEvents.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Recent Articles</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{data.content.overview.recentArticles.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Last {days} days</div>
          </div>
        </div>

        {/* Top Articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Top ESG Articles</h3>
              <div className="space-y-3">
                {data.content.topArticles.esg.map((article: any) => (
                  <div key={article.id} className="border-b pb-3">
                    <div className="text-sm font-medium truncate">{article.title}</div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{article.source}</span>
                      <span className="text-xs font-semibold text-purple-600">{article.like_count} likes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Top Credit Articles</h3>
              <div className="space-y-3">
                {data.content.topArticles.credit.map((article: any) => (
                  <div key={article.id} className="border-b pb-3">
                    <div className="text-sm font-medium truncate">{article.title}</div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{article.source}</span>
                      <span className="text-xs font-semibold text-purple-600">{article.like_count} likes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Sources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Top ESG Sources</h3>
            <div className="space-y-2">
              {data.content.topSources.esg.map((source: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{source.source}</span>
                  <span className="text-sm">
                    <span className="font-semibold">{source.article_count}</span>
                    <span className="text-gray-400 text-xs ml-2">{source.unique_likes} likes</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Top Credit Sources</h3>
            <div className="space-y-2">
              {data.content.topSources.credit.map((source: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{source.source}</span>
                  <span className="text-sm">
                    <span className="font-semibold">{source.article_count}</span>
                    <span className="text-gray-400 text-xs ml-2">{source.unique_likes} likes</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    if (!data.alerts) return null;

    return (
      <div className="space-y-6">
        {/* Alert Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Alerts</div>
            <div className="text-2xl font-bold mt-1">{data.alerts.overview.totalAlerts.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Active Alerts</div>
            <div className="text-2xl font-bold mt-1 text-green-600">{data.alerts.overview.activeAlerts.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Total Content Sent</div>
            <div className="text-2xl font-bold mt-1">{data.alerts.overview.totalContentSent.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="text-sm text-gray-600">Recent Content</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{data.alerts.overview.recentContentSent.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Last {days} days</div>
          </div>
        </div>

        {/* Most Active Alerts */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4">Most Active Alerts (Last {days} Days)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content Sent</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.alerts.mostActiveAlerts.map((alert: any) => (
                    <tr key={alert.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{alert.alert_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded capitalize">
                          {alert.alert_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{alert.user_name}</td>
                      <td className="px-4 py-3 text-sm">{alert.team || "N/A"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">{alert.content_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alerts by Domain & Top Keywords */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Alerts by Domain</h3>
            <div className="space-y-2">
              {data.alerts.alertsByDomain.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm uppercase">{item.domain}</span>
                  <span className="text-sm font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Top Keywords in Alerts</h3>
            <div className="flex flex-wrap gap-2">
              {data.alerts.topKeywords.map((item: any, idx: number) => (
                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {item.keyword} ({item.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTeams = () => {
    if (!data.teams) return null;

    return (
      <div className="space-y-6">
        {/* Team Engagement Scores */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4">Team Engagement Scores</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alerts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Likes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alerts/User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Likes/User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.teams.teamEngagement
                    .sort((a: any, b: any) => b.engagement_score - a.engagement_score)
                    .map((team: any) => (
                      <tr key={team.team} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{team.team}</td>
                        <td className="px-4 py-3 text-sm">{team.user_count}</td>
                        <td className="px-4 py-3 text-sm">{team.alert_count}</td>
                        <td className="px-4 py-3 text-sm">{team.like_count}</td>
                        <td className="px-4 py-3 text-sm">{team.alerts_per_user}</td>
                        <td className="px-4 py-3 text-sm">{team.likes_per_user}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            team.engagement_score > 50 ? "bg-green-100 text-green-800" :
                            team.engagement_score > 20 ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {team.engagement_score}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Team Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Users by Team</h3>
            <div className="space-y-2">
              {data.teams.usersByTeam.map((item: any) => (
                <div key={item.team} className="flex justify-between items-center">
                  <span className="text-sm">{item.team}</span>
                  <span className="text-sm font-semibold">{item.user_count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Alerts by Team</h3>
            <div className="space-y-2">
              {data.teams.alertsByTeam.map((item: any) => (
                <div key={item.team} className="flex justify-between items-center">
                  <span className="text-sm">{item.team}</span>
                  <span className="text-sm">
                    <span className="font-semibold text-green-600">{item.active_alert_count}</span>
                    <span className="text-gray-400"> / {item.alert_count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-bold mb-4">Likes by Team</h3>
            <div className="space-y-2">
              {data.teams.likesByTeam.map((item: any) => (
                <div key={item.team} className="flex justify-between items-center">
                  <span className="text-sm">{item.team}</span>
                  <span className="text-sm font-semibold text-purple-600">{item.like_count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive analytics and insights</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Time Range:</label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="flex border-b">
          {[
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users" },
            { id: "content", label: "Content" },
            { id: "alerts", label: "Alerts" },
            { id: "teams", label: "Teams" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "users" && renderUsers()}
          {activeTab === "content" && renderContent()}
          {activeTab === "alerts" && renderAlerts()}
          {activeTab === "teams" && renderTeams()}
        </div>
      )}
    </div>
  );
}
