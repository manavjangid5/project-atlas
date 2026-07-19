import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { fetchOverview, fetchNodeUsage, fetchDailyExecutions, fetchActiveUsers } from "./analyticsApi";
import type { Overview } from "./analyticsApi";
import StatCard from "./StatCard";
import { useAuthStore } from "../../store/authStore";

const PIE_COLORS = ["#E8622C", "#4A9E8E", "#C2A83E", "#7B6BA8", "#4A7FA8", "#A85C7B"];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [nodeUsage, setNodeUsage] = useState<{ kind: string; count: number }[]>([]);
  const [dailyExec, setDailyExec] = useState<{ date: string; count: number }[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ user?: { email: string }; actionCount: number }[]>([]);

  // useEffect(() => {
  //   fetchOverview().then(setOverview);
  //   fetchNodeUsage().then(setNodeUsage);
  //   fetchDailyExecutions().then(setDailyExec);
  //   fetchActiveUsers().then(setActiveUsers);
  // }, []);

  const activeOrgId = useAuthStore((s) => s.activeOrgId);
useEffect(() => {
  fetchOverview().then(setOverview);
  fetchNodeUsage().then(setNodeUsage);
  fetchDailyExecutions().then(setDailyExec);
  fetchActiveUsers().then(setActiveUsers);
}, [activeOrgId]);

  return (
    <div className="p-8 max-w-5xl">
      <h2 className="text-xl font-bold mb-6">Analytics</h2>

      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Runs" value={overview.totalRuns} />
          <StatCard label="Success Rate" value={`${overview.successRate}%`} accent />
          <StatCard label="Avg Duration" value={`${overview.avgDurationSeconds}s`} />
          <StatCard label="Workflows" value={overview.totalWorkflows} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-surface border border-border rounded-md p-4">
          <h3 className="text-sm font-semibold mb-4">Daily Executions (last 14 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyExec}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#9E9E9E", fontSize: 10 }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis tick={{ fill: "#9E9E9E", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#161616", border: "1px solid #2A2A2A" }} />
              <Bar dataKey="count" fill="#E8622C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface border border-border rounded-md p-4">
          <h3 className="text-sm font-semibold mb-4">Node Usage Breakdown</h3>
          {nodeUsage.length === 0 ? (
            <p className="text-xs text-muted">No workflow nodes created yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={nodeUsage} dataKey="count" nameKey="kind" outerRadius={80} label>
                  {nodeUsage.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#161616", border: "1px solid #2A2A2A" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-md p-4">
        <h3 className="text-sm font-semibold mb-4">Most Active Users</h3>
        {activeUsers.length === 0 ? (
          <p className="text-xs text-muted">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {activeUsers.map((u, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted">{u.user?.email || "Unknown"}</span>
                <span className="font-semibold">{u.actionCount} actions</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}