'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  DollarSign,
  Calculator,
  FlaskConical,
  AlertCircle,
  TrendingUp,
  Users,
  FileText,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

// Types matching backend schemas
interface DashboardStats {
  total_spent: string;
  rd_eligible_spend_ytd: string;
  gst_position: string;
  payg_withheld: string;
  monthly_burn_rate: string;
  unclassified_transactions_count: number;
  missing_evidence_count: number;
  open_exceptions_count: number;
}

interface ComplianceReminder {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  due_date?: string;
}

interface RecentActivityItem {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  timestamp: string;
  user_email?: string;
}

interface DashboardData {
  stats: DashboardStats;
  compliance_reminders: ComplianceReminder[];
  recent_activity: RecentActivityItem[];
}

// Loading skeleton component
function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div className="w-full">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
          <div className="mt-2 h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
          <div className="mt-1 h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="h-12 w-12 rounded-lg bg-slate-100 animate-pulse"></div>
      </div>
    </div>
  );
}

// Stat card component with click navigation
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
  href?: string;
  valueColor?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, href, valueColor }: StatCardProps) {
  const cardContent = (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className={`mt-2 text-3xl font-semibold ${valueColor || 'text-slate-900'}`}>{value}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          {trend && (
            <div className={`mt-2 flex items-center text-sm ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className="h-4 w-4 mr-1" />
              {trend.value}
            </div>
          )}
        </div>
        <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}

// Severity icon component
function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />;
    case 'info':
    default:
      return <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />;
  }
}

// Severity badge component
function SeverityBadge({ severity }: { severity: string }) {
  const styles = {
    critical: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[severity as keyof typeof styles] || styles.info}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

// Format currency to AUD
function formatCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(numValue);
}

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU');
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/dashboard/');
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-600">Overview of your company's financial and R&D position</p>
        </div>

        {/* Stats skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Middle row skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="h-6 w-40 bg-slate-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity skeleton */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-600">Overview of your company's financial and R&D position</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { stats, compliance_reminders, recent_activity } = data;

  // Determine GST position color and text
  const gstValue = parseFloat(stats.gst_position);
  const gstColor = gstValue < 0 ? 'text-green-600' : 'text-red-600';
  const gstSubtitle = gstValue < 0 ? 'Refundable' : 'Payable';

  // Determine exceptions color
  const openExceptions = stats.open_exceptions_count;
  const exceptionsColor = openExceptions > 0 ? 'text-red-600' : 'text-slate-900';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-slate-600">Overview of your company's financial and R&D position</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          title="Refresh dashboard"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Spent This Month"
          value={formatCurrency(stats.total_spent)}
          icon={DollarSign}
          href="/transactions"
        />
        <StatCard
          title="R&D Eligible Spend YTD"
          value={formatCurrency(stats.rd_eligible_spend_ytd)}
          subtitle="Since July 1"
          icon={FlaskConical}
          href="/projects"
        />
        <StatCard
          title="GST Position"
          value={formatCurrency(Math.abs(gstValue))}
          subtitle={gstSubtitle}
          icon={Calculator}
          href="/gst"
          valueColor={gstColor}
        />
        <StatCard
          title="PAYG Withheld"
          value={formatCurrency(stats.payg_withheld)}
          subtitle="This month"
          icon={Users}
          href="/payroll"
        />
        <StatCard
          title="Monthly Burn Rate"
          value={formatCurrency(stats.monthly_burn_rate)}
          subtitle="3-month average"
          icon={TrendingUp}
        />
        <StatCard
          title="Open Exceptions"
          value={String(openExceptions)}
          subtitle={openExceptions > 0 ? 'Needs attention' : 'All clear'}
          icon={AlertCircle}
          href="/exceptions"
          valueColor={exceptionsColor}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Reminders */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-slate-500" />
            Compliance Reminders
          </h2>
          {compliance_reminders.length === 0 ? (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Info className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-slate-600">All compliance items are up to date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {compliance_reminders.map((reminder, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <SeverityIcon severity={reminder.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{reminder.message}</p>
                    {reminder.due_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        Due: {new Date(reminder.due_date).toLocaleDateString('en-AU')}
                      </p>
                    )}
                  </div>
                  <SeverityBadge severity={reminder.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-slate-500" />
            Quick Stats
          </h2>
          <div className="space-y-4">
            {/* Unclassified Transactions */}
            <Link href="/transactions" className="block">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Unclassified Transactions</p>
                    <p className="text-sm text-slate-500">Transactions without a category</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-semibold ${stats.unclassified_transactions_count > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {stats.unclassified_transactions_count}
                  </span>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            </Link>

            {/* Missing Evidence */}
            <Link href="/exceptions" className="block">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Missing Evidence</p>
                    <p className="text-sm text-slate-500">High-value transactions without evidence</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-semibold ${stats.missing_evidence_count > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {stats.missing_evidence_count}
                  </span>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        {recent_activity.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity to display</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recent_activity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.description}
                  </p>
                  <p className="text-xs text-slate-500">
                    {activity.entity_type} • {formatRelativeTime(activity.timestamp)}
                    {activity.user_email && ` • ${activity.user_email}`}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  {activity.action}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
