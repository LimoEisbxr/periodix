import { type FC } from 'react';

interface ActivitySummaryProps {
    peakHour: string;
    todayTotal: number;
    timetableViews: number;
    searches: number;
    avgSession: string;
    onDetailClick?: (metric: string) => void;
}

/**
 * Modern activity summary component with a unified design
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
        <div className="space-y-6 lg:space-y-8">
            {/* Main Stats Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
                <div className="flex items-center gap-4 lg:gap-5 p-4 lg:p-5 bg-white dark:bg-slate-900/40 rounded-[1.5rem] lg:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                    <div className="w-12 h-12 lg:w-14 lg:h-14 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl lg:rounded-2xl flex items-center justify-center text-2xl lg:text-3xl shadow-sm border border-amber-200/20">
                        ⏰
                    </div>
                    <div>
                        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            Peak Activity
                        </p>
                        <p className="text-xl lg:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                            {peakHour}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 lg:gap-5 p-4 lg:p-5 bg-white dark:bg-slate-900/40 rounded-[1.5rem] lg:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                    <div className="w-12 h-12 lg:w-14 lg:h-14 bg-indigo-100/50 dark:bg-indigo-900/20 rounded-xl lg:rounded-2xl flex items-center justify-center text-2xl lg:text-3xl shadow-sm border border-indigo-200/20">
                        ⚡
                    </div>
                    <div>
                        <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            Actions Today
                        </p>
                        <p className="text-xl lg:text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {todayTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Metric Buttons */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 lg:gap-4">
                {[
                    {
                        id: 'timetable_views_today',
                        icon: '📅',
                        label: 'Views',
                        value: timetableViews,
                        color: 'sky',
                    },
                    {
                        id: 'searches_today',
                        icon: '🔍',
                        label: 'Searches',
                        value: searches,
                        color: 'violet',
                    },
                    {
                        id: 'session_duration_top',
                        icon: '⏱️',
                        label: 'Session',
                        value: avgSession,
                        color: 'emerald',
                    },
                ].map((item) => (
                    <button
                        key={item.id}
                        className={`
                            group p-4 lg:p-5 bg-white dark:bg-slate-900/40 rounded-[1.5rem] lg:rounded-3xl border border-slate-100 dark:border-slate-800 
                            hover:border-indigo-400/50 dark:hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 
                            transition-all duration-300 transform active:scale-95 text-center relative overflow-hidden
                            flex xs:flex-col items-center xs:justify-center gap-4 xs:gap-0
                        `}
                        onClick={() => onDetailClick?.(item.id)}
                    >
                        {/* Background Decoration */}
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform hidden xs:block" />

                        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-50 dark:bg-slate-800/80 rounded-xl lg:rounded-2xl flex items-center justify-center xs:mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors shadow-inner flex-shrink-0">
                            <span className="text-xl lg:text-2xl group-hover:rotate-12 transition-transform duration-500">
                                {item.icon}
                            </span>
                        </div>
                        <div className="text-left xs:text-center">
                            <p className="text-lg lg:text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                {item.value}
                            </p>
                            <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {item.label}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ActivitySummary;
