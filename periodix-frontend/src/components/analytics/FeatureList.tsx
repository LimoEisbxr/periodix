import type { FC } from 'react';

interface Feature {
    feature: string;
    count: number;
    percentage: number;
    displayName: string;
}

interface FeatureListProps {
    features: Feature[];
    maxItems?: number;
    onFeatureClick?: (feature: string) => void;
}

/**
 * Compact feature usage list with progress bars
 */
export const FeatureList: FC<FeatureListProps> = ({
    features,
    maxItems = 6,
    onFeatureClick,
}) => {
    const displayFeatures = features.slice(0, maxItems);
    const maxCount = Math.max(...features.map((f) => f.count), 1);

    return (
        <div className="space-y-2">
            {displayFeatures.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    No feature usage data available
                </p>
            ) : (
                displayFeatures.map((feature, index) => (
                    <button
                        key={feature.feature}
                        className="w-full p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left group"
                        onClick={() => onFeatureClick?.(feature.feature)}
                    >
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{
                                        backgroundColor: `hsl(${
                                            (index * 47) % 360
                                        }, 65%, 50%)`,
                                    }}
                                />
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {feature.displayName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                                    {feature.count}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums w-10 text-right">
                                    {feature.percentage}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${
                                        (feature.count / maxCount) * 100
                                    }%`,
                                    backgroundColor: `hsl(${
                                        (index * 47) % 360
                                    }, 65%, 50%)`,
                                }}
                            />
                        </div>
                    </button>
                ))
            )}

            {features.length > maxItems && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
                    +{features.length - maxItems} more features
                </p>
            )}
        </div>
    );
};

export default FeatureList;
