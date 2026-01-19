import { type FC } from 'react';

interface StatItemProps {
    label: string;
    value: string | number;
    icon: string;
    color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
    onClick?: () => void;
    subtitle?: string;
}

const colorConfigs = {
    indigo: {
        bg: 'from-indigo-500/10 to-indigo-600/5 dark:from-indigo-500/20 dark:to-indigo-600/10',
        border: 'border-indigo-200/50 dark:border-indigo-800/50',
        text: 'text-indigo-700 dark:text-indigo-300',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
        shadow: 'shadow-indigo-500/10',
    },
    emerald: {
        bg: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10',
        border: 'border-emerald-200/50 dark:border-emerald-800/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        shadow: 'shadow-emerald-500/10',
    },
    amber: {
        bg: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10',
        border: 'border-amber-200/50 dark:border-amber-800/50',
        text: 'text-amber-700 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        shadow: 'shadow-amber-500/10',
    },
    rose: {
        bg: 'from-rose-500/10 to-rose-600/5 dark:from-rose-500/20 dark:to-rose-600/10',
        border: 'border-rose-200/50 dark:border-rose-800/50',
        text: 'text-rose-700 dark:text-rose-300',
        iconBg: 'bg-rose-100 dark:bg-rose-900/40',
        shadow: 'shadow-rose-500/10',
    },
    sky: {
        bg: 'from-sky-500/10 to-sky-600/5 dark:from-sky-500/20 dark:to-sky-600/10',
        border: 'border-sky-200/50 dark:border-sky-800/50',
        text: 'text-sky-700 dark:text-sky-300',
        iconBg: 'bg-sky-100 dark:bg-sky-900/40',
        shadow: 'shadow-sky-500/10',
    },
    violet: {
        bg: 'from-violet-500/10 to-violet-600/5 dark:from-violet-500/20 dark:to-violet-600/10',
        border: 'border-violet-200/50 dark:border-violet-800/50',
        text: 'text-violet-700 dark:text-violet-300',
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
        shadow: 'shadow-violet-500/10',
    },
};

/**
 * Modern stat item for displaying a single metric with a curated color palette
 */
export const StatItem: FC<StatItemProps> = ({
    label,
    value,
    icon,
    color,
    onClick,
    subtitle,
}) => {
    const config = colorConfigs[color];

    return (
        <button
            className={`
                relative bg-gradient-to-br ${config.bg} rounded-[1.5rem] lg:rounded-3xl border ${config.border} p-4 lg:p-5 text-left group transition-all duration-300 overflow-hidden
                ${onClick ? 'hover:scale-[1.02] hover:shadow-2xl ' + config.shadow : 'cursor-default'}
            `}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2 lg:gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-1 lg:mb-1.5">
                        {label}
                    </p>
                    <p
                        className={`text-2xl lg:text-3xl font-black tabular-nums tracking-tight transition-colors ${config.text}`}
                    >
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-[10px] lg:text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 lg:mt-1.5 truncate flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                            {subtitle}
                        </p>
                    )}
                </div>
                <div
                    className={`w-10 h-10 lg:w-12 lg:h-12 ${config.iconBg} rounded-xl lg:rounded-2xl flex items-center justify-center text-xl lg:text-2xl shadow-sm transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 flex-shrink-0`}
                >
                    {icon}
                </div>
            </div>

            {onClick && (
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all duration-300">
                    <svg
                        className={`w-4 h-4 ${config.text}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                    </svg>
                </div>
            )}
        </button>
    );
};

export default StatItem;
