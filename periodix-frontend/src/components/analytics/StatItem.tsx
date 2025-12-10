import type { FC } from 'react';

interface StatItemProps {
    label: string;
    value: string | number;
    icon: string;
    color:
        | 'blue'
        | 'green'
        | 'purple'
        | 'amber'
        | 'rose'
        | 'emerald'
        | 'indigo'
        | 'sky';
    onClick?: () => void;
    subtitle?: string;
}

const colorClasses = {
    blue: 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200 dark:border-blue-700/50 text-blue-600 dark:text-blue-400',
    green: 'from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-green-200 dark:border-green-700/50 text-green-600 dark:text-green-400',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border-purple-200 dark:border-purple-700/50 text-purple-600 dark:text-purple-400',
    amber: 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-200 dark:border-amber-700/50 text-amber-600 dark:text-amber-400',
    rose: 'from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-800/20 border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400',
    emerald:
        'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700/50 text-emerald-600 dark:text-emerald-400',
    indigo: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700/50 text-indigo-600 dark:text-indigo-400',
    sky: 'from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/20 border-sky-200 dark:border-sky-700/50 text-sky-600 dark:text-sky-400',
};

/**
 * Compact stat item for displaying a single metric
 */
export const StatItem: FC<StatItemProps> = ({
    label,
    value,
    icon,
    color,
    onClick,
    subtitle,
}) => {
    const classes = colorClasses[color];

    return (
        <div
            className={`bg-gradient-to-br ${classes} rounded-lg border p-3 ${
                onClick
                    ? 'cursor-pointer hover:shadow-md transition-shadow'
                    : ''
            }`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium opacity-80 truncate">
                        {label}
                    </p>
                    <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
                    {subtitle && (
                        <p className="text-[10px] opacity-60 mt-0.5 truncate">
                            {subtitle}
                        </p>
                    )}
                </div>
                <span className="text-lg flex-shrink-0">{icon}</span>
            </div>
            {onClick && (
                <p className="text-[10px] opacity-50 mt-1">Tap for details</p>
            )}
        </div>
    );
};

export default StatItem;
