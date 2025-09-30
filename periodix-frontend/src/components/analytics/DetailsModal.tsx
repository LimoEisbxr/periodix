import type { AnalyticsDetailMetric } from '../../api';

export interface DetailsItem {
    userId: string;
    username: string;
    displayName: string | null;
    count?: number;
    lastAt?: string; // ISO string from API
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

export function DetailsModal({
    open,
    metric,
    items,
    loading,
    error,
    onClose,
    onUserClick,
}: Props) {
    if (!open) return null;
    const title = (() => {
        switch (metric) {
            case 'logins_today':
                return 'Logins Today — Users';
            case 'active_today':
                return 'Active Users Today';
            case 'timetable_views_today':
                return 'Timetable Views Today — Users';
            case 'searches_today':
                return 'Searches Today — Users';
            case 'new_users_today':
                return 'New Users Today';
            case 'session_duration_top':
                return 'Top Avg Session Duration (Today)';
            case 'most_active_7_days':
                return '🏆 Most Active Users (Last 7 Days) — Full Rankings';
            case 'most_active_all_time':
                return '🌟 Most Active Users (All Time) — Full Rankings';
            default:
                return 'Details';
        }
    })();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative z-10 w-[92vw] max-w-2xl bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                    </h3>
                    <button className="btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
                <div className="p-4 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="text-slate-600 dark:text-slate-300">
                            Loading…
                        </div>
                    ) : error ? (
                        <div className="text-red-600 dark:text-red-300">
                            {error}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-slate-600 dark:text-slate-300">
                            No data for this metric today.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {items.map((it, index) => (
                                <li
                                    key={it.userId}
                                    className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-2 cursor-pointer"
                                    onClick={() => onUserClick?.(it.userId)}
                                >
                                    <div className="flex items-center gap-3">
                                        {(metric === 'most_active_7_days' ||
                                            metric ===
                                                'most_active_all_time') && (
                                            <div className="w-8 flex-shrink-0 text-center">
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    #{index + 1}
                                                </div>
                                            </div>
                                        )}
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                                            {(it.displayName || it.username)
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-slate-100 font-medium">
                                                {it.displayName || it.username}
                                            </div>
                                            {it.displayName && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    @{it.username}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1">
                                        {metric === 'session_duration_top' ? (
                                            <>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                    {it.avgSessionMinutes ??
                                                        '—'}
                                                    m
                                                </div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    {it.sessionCount || 1} sess
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {typeof it.count ===
                                                    'number' && (
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {it.count}
                                                    </div>
                                                )}
                                                {(metric === 'most_active_7_days' ||
                                                    metric ===
                                                        'most_active_all_time') && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        activities
                                                    </div>
                                                )}
                                                {metric !==
                                                    'most_active_7_days' &&
                                                    metric !==
                                                        'most_active_all_time' && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {it.lastAt
                                                                ? new Date(
                                                                      it.lastAt
                                                                  ).toLocaleTimeString()
                                                                : ''}
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
