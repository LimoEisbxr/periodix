import type { FC } from 'react';

interface ActivitySummaryProps {
    peakHour: string;
    todayTotal: number;
    timetableViews: number;
    searches: number;
    avgSession: string;
    onDetailClick?: (metric: string) => void;
}

/**
 * Simple, mobile-friendly activity summary without complex charts
 */
export const ActivitySummary: FC<ActivitySummaryProps> = ({
    peakHour,
    todayTotal,
    timetableViews,
    searches,
    avgSession,
    onDetailClick,
}) => {
    return (
        <div className="space-y-3">
            {/* Peak activity indicator */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200/50 dark:border-amber-700/30">
                <div className="flex items-center gap-3">
                    <span className="text-xl">⏰</span>
                    <div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Peak Hour Today
                        </p>
                        <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
                            {peakHour}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total Activity
                    </p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                        {todayTotal}
                    </p>
                </div>
            </div>

            {/* Activity breakdown */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200/50 dark:border-sky-700/30 text-center hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                    onClick={() => onDetailClick?.('timetable_views_today')}
                >
                    <span className="block text-lg">📅</span>
                    <p className="text-lg font-bold text-sky-700 dark:text-sky-300">
                        {timetableViews}
                    </p>
                    <p className="text-[10px] text-sky-600 dark:text-sky-400">
                        Views
                    </p>
                </button>

                <button
                    className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200/50 dark:border-indigo-700/30 text-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    onClick={() => onDetailClick?.('searches_today')}
                >
                    <span className="block text-lg">🔍</span>
                    <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                        {searches}
                    </p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                        Searches
                    </p>
                </button>

                <button
                    className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200/50 dark:border-emerald-700/30 text-center hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                    onClick={() => onDetailClick?.('session_duration_top')}
                >
                    <span className="block text-lg">⏱️</span>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        {avgSession}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Avg Session
                    </p>
                </button>
            </div>
        </div>
    );
};

export default ActivitySummary;
