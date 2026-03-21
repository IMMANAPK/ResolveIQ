import { motion } from "framer-motion";
import { FileText, Clock, AlertTriangle, Loader2, TrendingUp, CheckCircle, Star } from "lucide-react";
import { StatCard } from "@/components/cms/StatCard";
import { useComplaintStats } from "@/hooks/useComplaintStats";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
} from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  frustrated: "#ef4444",
  angry: "#dc2626",
  neutral: "#94a3b8",
  concerned: "#f59e0b",
  satisfied: "#22c55e",
  unknown: "#cbd5e1",
};

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useComplaintStats(30);

  if (loadingStats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sentimentData = stats ? Object.entries(stats.bySentiment).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">30-day overview of complaint processing and SLA performance.</p>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Volume" value={stats.total} icon={FileText} color="primary" delay={0} />
          <StatCard 
            title="Avg Resolution Info" 
            value={stats.avgResolutionHours ? `${stats.avgResolutionHours.toFixed(1)}h` : "N/A"} 
            icon={Clock} 
            color="success" 
            delay={0.1} 
          />
          <StatCard 
            title="SLA Breach Rate" 
            value={`${(stats.slaBreachRate * 100).toFixed(1)}%`} 
            icon={AlertTriangle} 
            color={stats.slaBreachRate > 0.1 ? "critical" : "high"} 
            delay={0.2} 
            trend={`${stats.slaBreachCount} breached`}
          />
          <StatCard 
            title="Avg Feedback Rating" 
            value={stats.avgFeedbackRating ? `${stats.avgFeedbackRating}/5` : "N/A"} 
            icon={Star} 
            color="primary" 
            delay={0.3} 
          />
        </div>
      )}

      {stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Issue Volume Over Time */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Issue Volume Trend
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.overTime}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{fontSize: 12}} tickMargin={10} minTickGap={30} />
                  <YAxis tick={{fontSize: 12}} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip wrapperClassName="text-sm rounded-md shadow-sm border border-border" />
                  <Legend wrapperStyle={{fontSize: '12px'}} />
                  <Area type="monotone" dataKey="created" name="New" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCreated)" />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" fillOpacity={1} fill="url(#colorResolved)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Sentiment Distribution */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-surface p-5 tracking-tight">
            <h2 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> AI Sentiment Analysis
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name] || SENTIMENT_COLORS.unknown} />
                    ))}
                  </Pie>
                  <Tooltip wrapperClassName="text-sm rounded-md shadow-sm border border-border" />
                  <Legend wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Committee Workload */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-surface p-5 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Committee Workload & Performance</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.committeeWorkload} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="committeeName" tick={{fontSize: 12}} />
                  <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" tick={{fontSize: 12}} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{fontSize: 12}} domain={[0, 5]} />
                  <Tooltip wrapperClassName="text-sm rounded-md shadow-sm border border-border" />
                  <Legend wrapperStyle={{fontSize: '12px'}} />
                  <Bar yAxisId="left" dataKey="count" name="Total Complaints" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="avgRating" name="Avg Rating (1-5)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
