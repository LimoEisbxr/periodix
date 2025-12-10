import type { FC, ReactNode } from 'react';

interface AnalyticsCardProps {
    title: string;
    icon: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    badge?: string | number;
    collapsible?: boolean;
    defaultExpanded?: boolean;
}

/**
 * Reusable analytics card component with consistent styling
 */
export const AnalyticsCard: FC<AnalyticsCardProps> = ({
    title,
    icon,
    children,
    className = '',
    onClick,
    badge,
    collapsible = false,
    defaultExpanded = true,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    const handleClick = () => {
        if (collapsible) {
            setExpanded(!expanded);
        } else if (onClick) {
            onClick();
        }
    };

    const isClickable = onClick || collapsible;

    return (
        <div
            className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${
                isClickable
                    ? 'cursor-pointer hover:border-sky-300 dark:hover:border-sky-600 transition-colors'
                    : ''
            } ${className}`}
            onClick={isClickable ? handleClick : undefined}
        >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                        {title}
                    </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {badge !== undefined && (
                        <span className="text-xs bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full font-medium">
                            {badge}
                        </span>
                    )}
                    {collapsible && (
                        <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                                expanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    )}
                    {onClick && !collapsible && (
                        <svg
                            className="w-4 h-4 text-slate-400"
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
                    )}
                </div>
            </div>
            {(!collapsible || expanded) && (
                <div className="p-4">{children}</div>
            )}
        </div>
    );
};

import { useState } from 'react';
export default AnalyticsCard;
