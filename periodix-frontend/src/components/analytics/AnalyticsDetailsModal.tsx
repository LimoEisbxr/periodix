import type { FC } from 'react';
import type { AnalyticsDetailMetric } from '../../api';

export interface DetailsItem {
    userId: string;
    username: string;
    displayName: string | null;
    count?: number;
    lastAt?: string;
    avgSessionMinutes?: number;
    sessionCount?: number;
}

interface Props {
    open: boolean;
    metric: AnalyticsDetailMetric | null;
    items: DetailsItem[];
    loading: boolean;
    error: string | null;
    onClose: () => void;
    onUserClick?: (userId: string) => void;
}

const metricInfo: Record<
    AnalyticsDetailMetric,
    { title: string; icon: string; description: string }
> = {
    logins_today: {
        title: 'Logins Today',
        icon: '🔑',
        description: 'Users who logged in today',
    },
    active_today: {
        title: 'Active Today',
        icon: '✨',
        description: 'Users with activity today',
    },
    timetable_views_today: {
        title: 'Timetable Views',
        icon: '📅',
        description: 'Users who viewed timetables today',
    },
    searches_today: {
        title: 'Searches Today',
        icon: '🔍',
        description: 'Users who searched today',
    },
    new_users_today: {
        title: 'New Users',
        icon: '🆕',
        description: 'Users who joined today',
    },
    session_duration_top: {
        title: 'Top Session Duration',
        icon: '⏱️',
        description: 'Users with longest average sessions',
    },
    total_users: {
        title: 'All Users',
        icon: '👥',
        description: 'Complete list of registered users',
    },
    retention: {
        title: 'Retention Details',
        icon: '📈',
        description: 'Users who returned within 7 days',
    },
};

export const AnalyticsDetailsModal: FC<Props> = ({
    open,
    metric,
    items,
    loading,
    error,
    onClose,
    onUserClick,
}) => {
    if (!open || !metric) return null;

    const info = metricInfo[metric];

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full sm:w-[min(480px,95vw)] max-h-[85vh] sm:max-h-[80vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{info.icon}</span>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {info.title}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {info.description}
                            </p>
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
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                                Loading...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <div className="text-3xl mb-3">⚠️</div>
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-3xl mb-3">📭</div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No data available
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {items.map((item, index) => (
                                <button
                                    key={item.userId}
                                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                                    onClick={() => onUserClick?.(item.userId)}
                                >
                                    {/* Rank for session duration */}
                                    {metric === 'session_duration_top' && (
                                        <span className="w-6 text-center text-sm font-bold text-slate-400 flex-shrink-0">
                                            {index === 0
                                                ? '🥇'
                                                : index === 1
                                                ? '🥈'
                                                : index === 2
                                                ? '🥉'
                                                : `${index + 1}`}
                                        </span>
                                    )}

                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                        {(item.displayName || item.username)
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                            {item.displayName || item.username}
                                        </p>
                                        {item.displayName && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                @{item.username}
                                            </p>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="text-right flex-shrink-0">
                                        {metric === 'session_duration_top' ? (
                                            <>
                                                <p className="font-bold text-slate-900 dark:text-slate-100">
                                                    {item.avgSessionMinutes ??
                                                        0}
                                                    m
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                    {item.sessionCount ?? 1}{' '}
                                                    session
                                                    {(item.sessionCount ??
                                                        1) !== 1
                                                        ? 's'
                                                        : ''}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                {typeof item.count ===
                                                    'number' && (
                                                    <p className="font-bold text-slate-900 dark:text-slate-100">
                                                        {item.count}
                                                    </p>
                                                )}
                                                {item.lastAt && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {new Date(
                                                            item.lastAt
                                                        ).toLocaleTimeString(
                                                            [],
                                                            {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            }
                                                        )}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Chevron */}
                                    <svg
                                        className="w-4 h-4 text-slate-400 flex-shrink-0"
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
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        {items.length} {items.length === 1 ? 'user' : 'users'} •
                        Tap for details
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDetailsModal;
