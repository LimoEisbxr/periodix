import { useState, useMemo, type FC } from 'react';
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
    { title: string; icon: string; description: string; color: string }
> = {
    logins_today: {
        title: 'Authentication',
        icon: '🔑',
        description: 'Users who successfully logged in today',
        color: 'from-blue-500 to-indigo-600',
    },
    active_today: {
        title: 'Engagement',
        icon: '✨',
        description: 'Users with documented activity today',
        color: 'from-emerald-500 to-teal-600',
    },
    timetable_views_today: {
        title: 'Curious Minds',
        icon: '📅',
        description: 'Users checking their schedules today',
        color: 'from-violet-500 to-purple-600',
    },
    searches_today: {
        title: 'Investigators',
        icon: '🔍',
        description: 'Users utilizing the search engine today',
        color: 'from-indigo-500 to-blue-600',
    },
    new_users_today: {
        title: 'Fresh Arrivals',
        icon: '🆕',
        description: 'Users who created an account today',
        color: 'from-amber-400 to-orange-500',
    },
    session_duration_top: {
        title: 'Session Leaders',
        icon: '⏱️',
        description: 'Longest average interaction times',
        color: 'from-rose-500 to-pink-600',
    },
    total_users: {
        title: 'Platform Citizens',
        icon: '👥',
        description: 'Complete directory of all registered users',
        color: 'from-slate-600 to-slate-800',
    },
    retention: {
        title: 'Loyalty Check',
        icon: '📈',
        description: 'Users returning within 7-day intervals',
        color: 'from-emerald-600 to-cyan-600',
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
    const [search, setSearch] = useState('');

    const filteredItems = useMemo(() => {
        if (!search) return items;
        const low = search.toLowerCase();
        return items.filter(
            (i) =>
                i.username.toLowerCase().includes(low) ||
                (i.displayName && i.displayName.toLowerCase().includes(low)),
        );
    }, [items, search]);

    if (!open || !metric) return null;

    const info = metricInfo[metric];

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full sm:w-[min(500px,95vw)] max-h-[85vh] sm:max-h-[80vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
                {/* Header */}
                <div
                    className={`p-6 bg-gradient-to-br ${info.color} text-white flex-shrink-0`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl drop-shadow-lg">
                                {info.icon}
                            </span>
                            <h3 className="font-black text-xl tracking-tight uppercase">
                                {info.title}
                            </h3>
                        </div>
                        <button
                            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/80 hover:text-white"
                            onClick={onClose}
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest leading-relaxed">
                        {info.description}
                    </p>
                </div>

                {/* Sub-Header / Search */}
                {!loading && !error && items.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search contributors..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                            <svg
                                className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 scrollbar-hide">
                    {loading ? (
                        <div className="p-16 text-center">
                            <div className="inline-block w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-6">
                                Retrieving Records...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-6 opacity-30">🚫</div>
                            <p className="text-sm font-black text-red-500 uppercase tracking-widest">
                                {error}
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="text-6xl mb-6 opacity-10">🌫️</div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                {search
                                    ? 'No matches found'
                                    : 'Database is empty'}
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {filteredItems.map((item, index) => (
                                <button
                                    key={item.userId}
                                    className="w-full h-16 flex items-center gap-4 px-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-left group active:scale-[0.98]"
                                    onClick={() => onUserClick?.(item.userId)}
                                >
                                    {/* Rank Decoration */}
                                    <div className="w-8 flex justify-center flex-shrink-0">
                                        {metric === 'session_duration_top' &&
                                        !search ? (
                                            <span className="text-sm font-black text-slate-400">
                                                {index === 0
                                                    ? '🥇'
                                                    : index === 1
                                                      ? '🥈'
                                                      : index === 2
                                                        ? '🥉'
                                                        : index + 1}
                                            </span>
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 transition-colors" />
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-slate-800 dark:to-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                        {(item.displayName || item.username)
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-slate-800 dark:text-slate-100 truncate text-sm">
                                            {item.displayName || item.username}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                            @{item.username}
                                        </p>
                                    </div>

                                    {/* Metric Specific Stats */}
                                    <div className="text-right flex-shrink-0 pr-2">
                                        {metric === 'session_duration_top' ? (
                                            <>
                                                <p className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                                    {(
                                                        item.avgSessionMinutes ??
                                                        0
                                                    ).toFixed(1)}
                                                    m
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {item.sessionCount ?? 1}{' '}
                                                    sess
                                                </p>
                                            </>
                                        ) : item.count !== undefined ? (
                                            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
                                                    {item.count}
                                                </span>
                                            </div>
                                        ) : item.lastAt ? (
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                                                {new Date(
                                                    item.lastAt,
                                                ).toLocaleDateString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </p>
                                        ) : (
                                            <div className="w-4 h-4 rounded bg-slate-50 dark:bg-slate-800" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-white/5 text-center flex-shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {filteredItems.length} Total Entries Showing
                    </p>
                </div>
            </div>
        </div>
    );
};
