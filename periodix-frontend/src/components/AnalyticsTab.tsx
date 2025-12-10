import { useState } from 'react';
import { useAnalyticsData } from './analytics/useAnalyticsData';
import { StatItem } from './analytics/StatItem';
import { ActivitySummary } from './analytics/ActivitySummary';
import { UserList } from './analytics/UserList';
import { FeatureList } from './analytics/FeatureList';
import { AnalyticsDetailsModal } from './analytics/AnalyticsDetailsModal';
import { UserInsightModal } from './analytics/UserInsightModal';
import type { AnalyticsDetailMetric } from '../api';

export default function AnalyticsTab({ token }: { token: string }) {
    const {
        state,
        details,
        refresh,
        openDetails,
        closeDetails,
        formatDuration,
        formatHourLocal,
    } = useAnalyticsData(token);

    const [userInsightUserId, setUserInsightUserId] = useState<string | null>(
        null
    );
    const openUserInsight = (userId: string) => setUserInsightUserId(userId);
    const closeUserInsight = () => setUserInsightUserId(null);

    // Loading state
    if (state.loading) {
        return (
            <div className="p-4 sm:p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg"
                            />
                        ))}
                    </div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (state.error) {
        return (
            <div className="p-4 sm:p-6">
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-red-800 dark:text-red-200">
                                Failed to load analytics
                            </h3>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {state.error}
                            </p>
                            <button
                                onClick={refresh}
                                className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleDetailClick = (metric: string) => {
        openDetails(metric as AnalyticsDetailMetric);
    };

    return (
        <>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>📊</span>
                            <span className="truncate">Analytics</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Usage insights for Periodix
                        </p>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={state.refreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                        <svg
                            className={`w-4 h-4 ${
                                state.refreshing ? 'animate-spin' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        <span className="hidden sm:inline">
                            {state.refreshing ? 'Refreshing...' : 'Refresh'}
                        </span>
                    </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <StatItem
                        label="Total Users"
                        value={state.dashboardStats?.totalUsers || 0}
                        icon="👥"
                        color="blue"
                        onClick={() => handleDetailClick('total_users')}
                    />
                    <StatItem
                        label="Active Today"
                        value={state.dashboardStats?.activeUsersToday || 0}
                        icon="✨"
                        color="green"
                        onClick={() => handleDetailClick('active_today')}
                    />
                    <StatItem
                        label="Logins Today"
                        value={state.dashboardStats?.totalLoginsToday || 0}
                        icon="🔑"
                        color="purple"
                        onClick={() => handleDetailClick('logins_today')}
                    />
                    <StatItem
                        label="Retention"
                        value={`${
                            state.engagementMetrics?.retentionRate || 0
                        }%`}
                        icon="📈"
                        color="amber"
                        subtitle="7-day average"
                        onClick={() => handleDetailClick('retention')}
                    />
                </div>

                {/* Activity Summary */}
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-base">📊</span>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            Today's Activity
                        </h3>
                    </div>
                    <ActivitySummary
                        peakHour={formatHourLocal(
                            state.dashboardStats?.peakHour
                        )}
                        todayTotal={
                            (state.dashboardStats?.timetableViewsToday || 0) +
                            (state.dashboardStats?.searchQueriesToday || 0)
                        }
                        timetableViews={
                            state.dashboardStats?.timetableViewsToday || 0
                        }
                        searches={state.dashboardStats?.searchQueriesToday || 0}
                        avgSession={formatDuration(
                            state.dashboardStats?.avgSessionDuration
                        )}
                        onDetailClick={handleDetailClick}
                    />
                </div>

                {/* Two-Column Layout for Lists */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Most Active Users */}
                    <UserList
                        users={state.engagementMetrics?.mostActiveUsers || []}
                        title="Most Active (7 Days)"
                        icon="🏆"
                        maxItems={5}
                        onUserClick={openUserInsight}
                        showRank={true}
                    />

                    {/* Feature Usage */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
                            <span className="text-base">🎯</span>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                Feature Usage (7 Days)
                            </h3>
                        </div>
                        <div className="p-4">
                            <FeatureList
                                features={state.featureUsage}
                                maxItems={6}
                            />
                        </div>
                    </div>
                </div>

                {/* New Users Today */}
                {(state.dashboardStats?.newUsersToday || 0) > 0 && (
                    <button
                        className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700/50 p-4 flex items-center justify-between hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                        onClick={() => handleDetailClick('new_users_today')}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🆕</span>
                            <div className="text-left">
                                <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                                    {state.dashboardStats?.newUsersToday} new
                                    user
                                    {(state.dashboardStats?.newUsersToday ||
                                        0) !== 1
                                        ? 's'
                                        : ''}{' '}
                                    today!
                                </p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                    Tap to see who joined
                                </p>
                            </div>
                        </div>
                        <svg
                            className="w-5 h-5 text-emerald-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                )}

                {/* Footer */}
                <div className="text-center pt-2">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        Last updated:{' '}
                        {new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </p>
                </div>
            </div>

            {/* Modals */}
            <AnalyticsDetailsModal
                open={details.open}
                metric={details.metric}
                items={details.items}
                loading={details.loading}
                error={details.error}
                onClose={closeDetails}
                onUserClick={openUserInsight}
            />

            <UserInsightModal
                userId={userInsightUserId}
                onClose={closeUserInsight}
                token={token}
            />
        </>
    );
}
