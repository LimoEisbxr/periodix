export function UserGrowthChart({
    labels,
    data,
}: {
    labels: string[];
    data: number[];
}) {
    if (!data.length) return null;
    const maxValue = Math.max(...data, 1);
    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    const growth = lastValue - firstValue;

    return (
        <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
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
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                    </div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        Community Growth
                    </h3>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{growth}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        New Users
                    </span>
                </div>
            </div>

            <div className="p-4 lg:p-6">
                <div className="h-48 lg:h-64 flex items-end justify-between gap-1 lg:gap-2">
                    {data.map((value, index) => {
                        const height = (value / maxValue) * 100;
                        const showLabel =
                            index === 0 ||
                            index === data.length - 1 ||
                            index === Math.floor(data.length / 2);

                        return (
                            <div
                                key={index}
                                className="flex flex-col items-center gap-2 lg:gap-3 flex-1 group relative"
                            >
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transform group-hover:-translate-y-1 transition-all pointer-events-none whitespace-nowrap z-10 shadow-xl border border-slate-100 dark:border-slate-800">
                                    {labels[index]}:{' '}
                                    <span className="text-emerald-500">
                                        {value}
                                    </span>
                                </div>

                                <div
                                    className="bg-gradient-to-t from-emerald-500/20 to-emerald-400/10 dark:from-emerald-600/20 dark:to-emerald-500/10 hover:from-emerald-500 hover:to-emerald-400 dark:hover:from-emerald-600 dark:hover:to-emerald-500 rounded-t-lg lg:rounded-t-xl transition-all duration-700 ease-out min-h-[5px] w-full"
                                    style={{
                                        height: `${Math.max(height, 5)}%`,
                                    }}
                                />

                                <div
                                    className={`text-[8px] lg:text-[10px] font-black transition-colors ${showLabel ? 'text-slate-400 dark:text-slate-600' : 'text-transparent'}`}
                                >
                                    {labels[index]?.split(' ')[1]}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 lg:mt-10 grid grid-cols-1 xs:grid-cols-3 gap-3 lg:gap-4">
                    {[
                        { label: 'Initial', value: firstValue, icon: '🏠' },
                        { label: 'Current', value: lastValue, icon: '🚀' },
                        {
                            label: 'Trend',
                            value: 'UP',
                            icon: '↗️',
                            highlight: true,
                        },
                    ].map((s, i) => (
                        <div
                            key={i}
                            className="p-3 lg:p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex xs:flex-col items-center gap-3 xs:gap-0 text-center"
                        >
                            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-lg shadow-sm border border-slate-100 dark:border-slate-700 xs:mb-2 flex-shrink-0">
                                {s.icon}
                            </div>
                            <div className="text-left xs:text-center">
                                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
                                    {s.label}
                                </p>
                                <p
                                    className={`text-sm lg:text-base font-black tabular-nums ${s.highlight ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}
                                >
                                    {s.value}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
