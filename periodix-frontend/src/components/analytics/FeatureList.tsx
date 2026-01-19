import type { FC } from 'react';

interface FeatureUsage {
    feature: string;
    count: number;
}

export const FeatureList: FC<{ features: FeatureUsage[] }> = ({ features }) => {
    const total = features.reduce((acc, f) => acc + f.count, 0);
    const sortedFeatures = [...features].sort((a, b) => b.count - a.count);

    return (
        <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
            <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-sm">
                        Feature Distribution
                    </h3>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 scroll-area-native">
                {sortedFeatures.map((f) => {
                    const percentage = total > 0 ? (f.count / total) * 100 : 0;

                    return (
                        <div
                            key={f.feature}
                            className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all hover:scale-[1.01]"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                                    {f.feature.replace(/_/g, ' ')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-indigo-500 tabular-nums">
                                        {f.count.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase">
                                        uses
                                    </span>
                                </div>
                            </div>

                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out delay-150"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <div className="mt-2 flex justify-end">
                                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase">
                                    {percentage.toFixed(1)}% Usage Share
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                <div className="px-4 py-3 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        Aggregate Velocity
                    </span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {total.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};
