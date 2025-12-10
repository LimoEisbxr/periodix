import { useEffect, useState } from 'react';
import {
    trackActivity,
    getUserInsight,
    type UserInsightSummary,
} from '../../api';

interface Props {
    userId: string | null;
    onClose: () => void;
    token: string;
}

export function UserInsightModal({ userId, onClose, token }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [insight, setInsight] = useState<UserInsightSummary | null>(null);
    const [activeTab, setActiveTab] = useState<
        'overview' | 'features' | 'activity'
    >('overview');

    const load = () => {
        if (!userId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setInsight(null);
        setActiveTab('overview');
        (async () => {
            try {
                await trackActivity(token, 'view_user_insight', {
                    targetUserId: userId,
                });
                const res = await getUserInsight(token, userId);
                if (!res || !res.insight)
                    throw new Error('No insight data returned');
                if (!cancelled) setInsight(res.insight);
            } catch (e) {
                if (!cancelled) {
                    const msg =
                        e instanceof Error
                            ? e.message
                            : 'Failed to load insight';
                    if (/401|403/.test(msg)) {
                        setError('Not authorized to view insights');
                    } else {
                        setError(msg);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    };

    useEffect(() => {
        const cleanup = load();
        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    if (!userId) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full sm:w-[min(560px,95vw)] max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        {insight && (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {(insight.displayName || insight.username)
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {insight
                                    ? insight.displayName || insight.username
                                    : 'User Insights'}
                            </h3>
                            {insight?.displayName && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    @{insight.username}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg
                            className="w-5 h-5 text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                                Loading insights...
                            </p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="text-3xl mb-3">⚠️</div>
                            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                                {error}
                            </p>
                            <button
                                onClick={() => load()}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : insight ? (
                    <>
                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                            {(
                                ['overview', 'features', 'activity'] as const
                            ).map((tab) => (
                                <button
                                    key={tab}
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                        activeTab === tab
                                            ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab === 'overview' && '📊 Overview'}
                                    {tab === 'features' && '🎯 Features'}
                                    {tab === 'activity' && '📋 Activity'}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <div className="space-y-4">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/30">
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                Total Activities
                                            </p>
                                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                                                {insight.totalActivities}
                                            </p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200/50 dark:border-green-700/30">
                                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                Today
                                            </p>
                                            <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                                                {insight.todayActivityCount}
                                            </p>
                                        </div>
                                    </div>

                                    {insight.avgSessionMinutesToday !==
                                        undefined && (
                                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200/50 dark:border-purple-700/30">
                                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                                Avg Session (Today)
                                            </p>
                                            <p className="text-xl font-bold text-purple-800 dark:text-purple-200">
                                                {insight.avgSessionMinutesToday}{' '}
                                                min
                                            </p>
                                        </div>
                                    )}

                                    {/* User ID */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                            User ID
                                        </p>
                                        <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                                            {insight.userId}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Features Tab */}
                            {activeTab === 'features' && (
                                <div className="space-y-2">
                                    {insight.featureUsage.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="text-3xl mb-2">
                                                📭
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                No feature usage data
                                            </p>
                                        </div>
                                    ) : (
                                        insight.featureUsage
                                            .slice(0, 15)
                                            .map((f, index) => {
                                                const maxCount = Math.max(
                                                    ...insight.featureUsage.map(
                                                        (x) => x.count
                                                    ),
                                                    1
                                                );
                                                return (
                                                    <div
                                                        key={f.feature}
                                                        className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div
                                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                                    style={{
                                                                        backgroundColor: `hsl(${
                                                                            (index *
                                                                                47) %
                                                                            360
                                                                        }, 65%, 50%)`,
                                                                    }}
                                                                />
                                                                <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                                                                    {f.feature}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                                                                    {f.count}
                                                                </span>
                                                                <span className="text-xs text-slate-500 tabular-nums w-10 text-right">
                                                                    {
                                                                        f.percentage
                                                                    }
                                                                    %
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${
                                                                        (f.count /
                                                                            maxCount) *
                                                                        100
                                                                    }%`,
                                                                    backgroundColor: `hsl(${
                                                                        (index *
                                                                            47) %
                                                                        360
                                                                    }, 65%, 50%)`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            )}

                            {/* Activity Tab */}
                            {activeTab === 'activity' && (
                                <div className="space-y-1">
                                    {insight.recentActivities.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="text-3xl mb-2">
                                                📭
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                No recent activity
                                            </p>
                                        </div>
                                    ) : (
                                        insight.recentActivities.map(
                                            (a, idx) => {
                                                const activityDate = new Date(
                                                    a.createdAt
                                                );
                                                const today = new Date();
                                                const isToday =
                                                    activityDate.toDateString() ===
                                                    today.toDateString();
                                                const yesterday = new Date(
                                                    today
                                                );
                                                yesterday.setDate(
                                                    yesterday.getDate() - 1
                                                );
                                                const isYesterday =
                                                    activityDate.toDateString() ===
                                                    yesterday.toDateString();

                                                let dateLabel: string;
                                                if (isToday) {
                                                    dateLabel = 'Today';
                                                } else if (isYesterday) {
                                                    dateLabel = 'Yesterday';
                                                } else {
                                                    dateLabel =
                                                        activityDate.toLocaleDateString(
                                                            [],
                                                            {
                                                                month: 'short',
                                                                day: 'numeric',
                                                            }
                                                        );
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                    >
                                                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate flex-1 font-mono">
                                                            {a.action}
                                                        </span>
                                                        <div className="flex flex-col items-end flex-shrink-0">
                                                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                                                {activityDate.toLocaleTimeString(
                                                                    [],
                                                                    {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    }
                                                                )}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                                {dateLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            No data available
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
