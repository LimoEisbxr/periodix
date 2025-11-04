import { useState } from 'react';
import { useAnalyticsData } from './analytics/useAnalyticsData.ts';
import { MetricCards } from './analytics/MetricCards.tsx';
import { ActivityByHourChart } from './analytics/ActivityByHourChart.tsx';
import { UserGrowthChart } from './analytics/UserGrowthChart.tsx';
import { FeatureUsageList } from './analytics/FeatureUsageList.tsx';
import { MostActiveUsers } from './analytics/MostActiveUsers.tsx';
import { MostActiveUsersAllTime } from './analytics/MostActiveUsersAllTime.tsx';
import { UsageInsights } from './analytics/UsageInsights.tsx';
import { DetailsModal } from './analytics/DetailsModal.tsx';
import { UserInsightModal } from './analytics/UserInsightModal.tsx';

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

    if (state.loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="h-24 bg-slate-200 dark:bg-slate-700 rounded"
                            />
                        ))}
                    </div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="p-6">
                <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                    <h3 className="font-medium">Error loading analytics</h3>
                    <p className="text-sm mt-1">{state.error}</p>
                    <button
                        onClick={refresh}
                        className="mt-3 btn-secondary text-sm"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            📊 App Statistics
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                            Usage analytics and insights for Periodix
                        </p>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={state.refreshing}
                        className="btn-secondary flex items-center gap-2"
                        title="Refresh data"
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
                                strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        {state.refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <MetricCards
                    dashboard={state.dashboardStats}
                    engagement={state.engagementMetrics}
                    onOpen={openDetails}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                        className="card p-4 cursor-pointer"
                        onClick={() => openDetails('timetable_views_today')}
                        title="View users who viewed timetables today"
                    >
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            📅 Timetable Views Today
                        </h3>
                        <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                            {state.dashboardStats?.timetableViewsToday || 0}
                        </p>
                    </div>
                    <div
                        className="card p-4 cursor-pointer"
                        onClick={() => openDetails('searches_today')}
                        title="View users who searched today"
                    >
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            🔍 Searches Today
                        </h3>
                        <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                            {state.dashboardStats?.searchQueriesToday || 0}
                        </p>
                    </div>
                    <div
                        className="card p-4 cursor-pointer hover:ring-2 hover:ring-emerald-400/60 transition"
                        onClick={() => openDetails('session_duration_top')}
                        title="View top users by avg session duration today"
                    >
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                            ⏱️ Avg Session
                            <span className="inline-block text-[10px] font-normal text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Top Users
                            </span>
                        </h3>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatDuration(
                                state.dashboardStats?.avgSessionDuration
                            )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Click to see ranking
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ActivityByHourChart
                        labels={state.hourlyChart.labels}
                        data={state.hourlyChart.data}
                        max={state.maxHourly}
                    />
                    <UserGrowthChart
                        labels={state.growthChart.labels}
                        data={state.growthChart.data}
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FeatureUsageList features={state.featureUsage} />
                    <MostActiveUsers
                        engagement={state.engagementMetrics}
                        onUserClick={openUserInsight}
                        onViewAll={() => openDetails('most_active_7_days')}
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <MostActiveUsersAllTime
                        engagement={state.engagementMetrics}
                        onUserClick={openUserInsight}
                        onViewAll={() => openDetails('most_active_all_time')}
                    />
                </div>
                <UsageInsights
                    dashboard={state.dashboardStats}
                    engagement={state.engagementMetrics}
                    onOpen={openDetails}
                    formatHour={formatHourLocal}
                />
                <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                    <p>
                        Analytics data is updated in real-time. Last refreshed:{' '}
                        {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
            <DetailsModal
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
