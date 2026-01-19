export function ActivityByHourChart({
    labels,
    data,
    max,
}: {
    labels: string[];
    data: number[];
    max: number;
}) {
    return (
        <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
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
                    <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        Activity Pulse
                    </h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Live Today
                    </span>
                </div>
            </div>

            <div className="p-4 lg:p-6">
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                    <div className="h-48 lg:h-64 flex items-end gap-1 lg:gap-2 min-w-[450px] lg:min-w-0 lg:justify-between">
                        {data.map((value, index) => {
                            const height = (value / max) * 100;
                            const showLabel = index % 4 === 0;
                            const isNow = new Date().getHours() === index;

                            return (
                                <div
                                    key={index}
                                    className="flex flex-col items-center gap-2 lg:gap-3 flex-1 group relative"
                                >
                                    {/* Glassmorphism Tooltip */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transform group-hover:-translate-y-1 transition-all pointer-events-none whitespace-nowrap z-10 shadow-xl border border-slate-100 dark:border-slate-800">
                                        {labels[index]}:{' '}
                                        <span className="text-indigo-500">
                                            {value}
                                        </span>
                                    </div>

                                    <div
                                        className={`w-full rounded-t-lg lg:rounded-t-xl transition-all duration-700 ease-out group-hover:scale-x-110 group-hover:brightness-110 ${
                                            isNow
                                                ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                                                : value > 0
                                                  ? 'bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 group-hover:from-indigo-100 group-hover:to-indigo-50 dark:group-hover:from-indigo-900/40 dark:group-hover:to-indigo-800/20'
                                                  : 'bg-slate-50 dark:bg-slate-800/20'
                                        }`}
                                        style={{
                                            height: `${Math.max(height, 5)}%`,
                                        }}
                                    />

                                    <div
                                        className={`text-[8px] lg:text-[10px] font-black transition-colors ${
                                            isNow
                                                ? 'text-indigo-500'
                                                : showLabel
                                                  ? 'text-slate-400 dark:text-slate-600'
                                                  : 'text-transparent'
                                        }`}
                                    >
                                        {labels[index]?.split(':')[0]}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-6 lg:mt-8 flex items-center justify-between text-[9px] lg:text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em] px-2">
                    <span>Morning</span>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1 mx-4 lg:mx-8" />
                    <span>Noon</span>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1 mx-4 lg:mx-8" />
                    <span>Night</span>
                </div>
            </div>
        </div>
    );
}
