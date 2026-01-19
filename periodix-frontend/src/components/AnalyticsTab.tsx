import { useState } from 'react';
import { useAnalyticsData } from './analytics/useAnalyticsData';
import { StatItem } from './analytics/StatItem';
import { ActivitySummary } from './analytics/ActivitySummary';
import { UserList } from './analytics/UserList';
import { FeatureList } from './analytics/FeatureList';
import { AnalyticsDetailsModal } from './analytics/AnalyticsDetailsModal';
import { UserInsightModal } from './analytics/UserInsightModal';
import { ActivityByHourChart } from './analytics/ActivityByHourChart';
import { UserGrowthChart } from './analytics/UserGrowthChart';
import type { AnalyticsDetailMetric } from '../api';

type TabType = 'overview' | 'activity' | 'users' | 'growth';

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

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [userInsightUserId, setUserInsightUserId] = useState<string | null>(
        null,
    );
    const openUserInsight = (userId: string) => setUserInsightUserId(userId);
    const closeUserInsight = () => setUserInsightUserId(null);

    // Loading state
    if (state.loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-6 max-w-sm w-full">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 rounded-2xl animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">
                            Compiling Intelligence
                        </p>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase">
                            Synchronizing with live traffic data...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (state.error) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="max-w-md w-full rounded-[2.5rem] border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 shadow-2xl p-10 text-center animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-3xl">
                        📡
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 uppercase tracking-tight">
                        Pipeline Interrupted
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
                        {state.error}
                    </p>
                    <button
                        onClick={refresh}
                        className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20"
                    >
                        Re-Establish Connection
                    </button>
                </div>
            </div>
        );
    }

    const handleDetailClick = (metric: string) => {
        openDetails(metric as AnalyticsDetailMetric);
    };

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: '⚡' },
        { id: 'activity', label: 'Activity', icon: '📊' },
        { id: 'users', label: 'Community', icon: '🏆' },
        { id: 'growth', label: 'Growth', icon: '📈' },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-transparent">
            {/* Header Area */}
            <div className="p-0 lg:p-4 pb-0 space-y-6 lg:space-y-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 lg:gap-5">
                        <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white dark:bg-slate-800 rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center text-xl lg:text-2xl shadow-indigo-500/5">
                            🧠
                        </div>
                        <div>
                            <h2 className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                Analytics Center
                            </h2>
                            <div className="flex items-center gap-2 text-[8px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Live Analytics Active
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={refresh}
                        disabled={state.refreshing}
                        className="group flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl lg:rounded-2xl transition-all shadow-sm disabled:opacity-50 active:scale-95"
                    >
                        <svg
                            className={`w-4 h-4 lg:w-5 lg:h-5 text-slate-400 group-hover:text-indigo-500 transition-colors ${
                                state.refreshing ? 'animate-spin' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>
                </div>

                {/* Navigation Bar */}
                <div className="flex p-1 lg:p-1.5 gap-1 lg:gap-2 bg-slate-200/50 dark:bg-slate-800/40 backdrop-blur-md rounded-xl lg:rounded-2xl border border-slate-200/20 dark:border-slate-700/30">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 lg:px-4 py-2 lg:py-2.5 rounded-lg lg:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1
                                ${
                                    activeTab === tab.id
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xl shadow-slate-900/5'
                                        : 'text-slate-500 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }
                            `}
                        >
                            <span className="text-sm lg:text-base">
                                {tab.icon}
                            </span>
                            <span className="inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Surface */}
            <div className="flex-1 p-4 lg:p-8 overflow-y-auto min-h-0 space-y-6 lg:space-y-8 scroll-area-native">
                {activeTab === 'overview' && (
                    <div className="space-y-6 lg:space-y-8">
                        {/* Key Metrics grid with new StatItem design */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                            <StatItem
                                label="Total Users"
                                value={state.dashboardStats?.totalUsers || 0}
                                icon="👥"
                                color="sky"
                                onClick={() => handleDetailClick('total_users')}
                            />
                            <StatItem
                                label="Active Today"
                                value={
                                    state.dashboardStats?.activeUsersToday || 0
                                }
                                icon="✨"
                                color="emerald"
                                onClick={() =>
                                    handleDetailClick('active_today')
                                }
                            />
                            <StatItem
                                label="Logins Today"
                                value={
                                    state.dashboardStats?.totalLoginsToday || 0
                                }
                                icon="🔑"
                                color="violet"
                                onClick={() =>
                                    handleDetailClick('logins_today')
                                }
                            />
                            <StatItem
                                label="Retention"
                                value={`${state.engagementMetrics?.retentionRate || 0}%`}
                                icon="📈"
                                color="amber"
                                onClick={() => handleDetailClick('retention')}
                            />
                        </div>

                        {/* Peak Usage Summary */}
                        <ActivitySummary
                            peakHour={formatHourLocal(
                                state.dashboardStats?.peakHour,
                            )}
                            todayTotal={
                                (state.dashboardStats?.timetableViewsToday ||
                                    0) +
                                (state.dashboardStats?.searchQueriesToday || 0)
                            }
                            timetableViews={
                                state.dashboardStats?.timetableViewsToday || 0
                            }
                            searches={
                                state.dashboardStats?.searchQueriesToday || 0
                            }
                            avgSession={formatDuration(
                                state.dashboardStats?.avgSessionDuration,
                            )}
                            onDetailClick={handleDetailClick}
                        />

                        {/* Actionable Banner */}
                        {(state.dashboardStats?.newUsersToday || 0) > 0 && (
                            <button
                                className="w-full relative group overflow-hidden"
                                onClick={() =>
                                    handleDetailClick('new_users_today')
                                }
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-between group-hover:text-white transition-all">
                                    <div className="flex items-center gap-4 lg:gap-6">
                                        <div className="w-12 h-12 lg:w-16 lg:h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl lg:rounded-3xl flex items-center justify-center text-2xl lg:text-3xl shadow-sm group-hover:bg-white/20 transition-colors">
                                            🎉
                                        </div>
                                        <div className="text-left">
                                            <h4 className="text-base lg:text-xl font-black uppercase tracking-tight">
                                                {
                                                    state.dashboardStats
                                                        ?.newUsersToday
                                                }{' '}
                                                New Pulse
                                            </h4>
                                            <p className="text-[10px] lg:text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-white/80 transition-colors line-clamp-1 lg:line-clamp-none">
                                                New users joined in the last 24
                                                hours. Analyze onboarding.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-full border border-slate-200 dark:border-slate-700 group-hover:border-white/40 flex items-center justify-center transition-colors flex-shrink-0">
                                        <svg
                                            className="w-4 h-4 lg:w-6 lg:h-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <ActivityByHourChart
                            labels={state.hourlyChart.labels}
                            data={state.hourlyChart.data}
                            max={state.maxHourly}
                        />
                        <FeatureList features={state.featureUsage || []} />
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                        <UserList
                            users={(
                                state.engagementMetrics?.mostActiveUsers || []
                            ).map((u) => ({
                                id: u.userId,
                                username: u.username,
                                displayName: u.displayName || u.username,
                                _count: { activity: u.activityCount },
                            }))}
                            title="Active Community"
                            onUserClick={openUserInsight}
                        />
                        <div className="hidden lg:flex items-center justify-center p-12 bg-white dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 border-dashed">
                            <div className="text-center opacity-40">
                                <div className="text-5xl mb-4">🔍</div>
                                <h4 className="text-sm font-black uppercase">
                                    User Deep Dive
                                </h4>
                                <p className="text-xs font-bold mt-2">
                                    Select a user to analyze individual behavior
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'growth' && (
                    <div className="">
                        <UserGrowthChart
                            labels={state.growthChart.labels}
                            data={state.growthChart.data}
                        />
                    </div>
                )}
            </div>

            {/* Global Overlays */}
            {details.open && (
                <AnalyticsDetailsModal
                    {...details}
                    onClose={closeDetails}
                    onUserClick={(id) => {
                        closeDetails();
                        openUserInsight(id);
                    }}
                />
            )}
            {userInsightUserId && (
                <UserInsightModal
                    userId={userInsightUserId}
                    onClose={closeUserInsight}
                />
            )}
        </div>
    );
}
