import {
    useState,
    useLayoutEffect,
    useRef,
    useCallback,
    type FC,
    type ReactNode,
    memo,
} from 'react';

/**
 * Layout levels for progressive content disclosure (highest to lowest detail)
 * Level 0: Full - Subject, Teacher, Room, Time
 * Level 1: NoTime - Subject, Teacher, Room (no time)
 * Level 2: Compact - Subject + Teacher inline, Room below
 * Level 3: SubjectRoom - Subject, Room only (no teacher)
 * Level 4: InlineRoom - Subject + Room on same line
 * Level 5: SubjectOnly - Just the subject
 * Level 6: InlineAll - Subject, Room, Teacher on one line (no time)
 */
export type LayoutLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AdaptiveLessonContentProps {
    /** Available height in pixels for the content */
    availableHeight: number;
    /** Available width in pixels for the content */
    availableWidth: number;
    /** Content for each layout level - only provide the ones relevant to your use case */
    layouts: Partial<{
        full: ReactNode; // Level 0: Subject, Teacher, Room, Time
        noTime: ReactNode; // Level 1: Subject, Teacher, Room
        compact: ReactNode; // Level 2: Subject + Teacher inline, Room
        subjectRoom: ReactNode; // Level 3: Subject, Room (no teacher)
        inlineRoom: ReactNode; // Level 4: Subject + Room inline
        subjectOnly: ReactNode; // Level 5: Subject only
        inlineAll: ReactNode; // Level 6: Subject + Room + Teacher inline (no time)
    }>;
    /** Minimum scale factor before dropping to next layout (default: 0.88) */
    minScale?: number;
    /** Maximum scale factor (default: 1.3) */
    maxScale?: number;
    /** Additional className for the container */
    className?: string;
    /** Whether this is a side-by-side lesson - affects layout priority */
    isSideBySide?: boolean;
    /** Whether this is a cancelled/irregular lesson - affects layout priority */
    isCancelledOrIrregular?: boolean;
    /** Reserved space at bottom (pixels) - passed through to measurement */
    reserveBottom?: number;
    /** Debug hook to observe layout decisions */
    onDecision?: (decision: LayoutDecision) => void;
}

/**
 * AdaptiveLessonContent - Automatically selects the best layout based on available space
 *
 * Instead of using hardcoded thresholds, this component:
 * 1. Measures each provided layout level's natural size
 * 2. Picks the most detailed layout that fits with acceptable scaling
 * 3. Applies scaling similar to FitText for smooth rendering
 *
 * Benefits over threshold-based approach:
 * - Adapts to actual content (long teacher names, room names, etc.)
 * - Works across different font sizes and zoom levels
 * - No need to tune magic numbers per device/context
 */
const AdaptiveLessonContent: FC<AdaptiveLessonContentProps> = memo(
    ({
        availableHeight,
        availableWidth,
        layouts,
        minScale = 0.88,
        maxScale = 1.3,
        className,
        isSideBySide = false,
        isCancelledOrIrregular = false,
        reserveBottom = 0,
        onDecision,
    }) => {
        const measureContainerRef = useRef<HTMLDivElement>(null);
        const [selectedLevel, setSelectedLevel] = useState<LayoutLevel | null>(
            null
        );
        const [scale, setScale] = useState(1);

        // Get ordered list of layouts to try (most detailed first)
        const getLayoutOrder = useCallback((): LayoutLevel[] => {
            // Base order from most to least detailed
            // Level 6 (inlineAll with teacher) comes before level 4 (inlineRoom without teacher)
            const allLevels: LayoutLevel[] = [0, 1, 2, 3, 6, 4, 5];

            // Filter to only levels that have content provided
            const availableLevels = allLevels.filter((level) => {
                const key = levelToKey(level);
                return layouts[key] !== undefined;
            });

            if (isSideBySide && !isCancelledOrIrregular) {
                // For normal side-by-side: prefer subjectRoom (3) and then inlineAll (6) before compact (2)
                // Reorder to: 0, 1, 3, 6, 2, 4, 5
                return availableLevels.sort((a, b) => {
                    const priority: Record<LayoutLevel, number> = {
                        0: 0,
                        1: 1,
                        3: 2,
                        6: 3,
                        2: 4,
                        4: 5,
                        5: 6,
                    };
                    return priority[a] - priority[b];
                });
            }

            return availableLevels;
        }, [layouts, isSideBySide, isCancelledOrIrregular]);

        const getLayoutContent = useCallback(
            (level: LayoutLevel): ReactNode => {
                const key = levelToKey(level);
                return layouts[key];
            },
            [layouts]
        );

        useLayoutEffect(() => {
            const container = measureContainerRef.current;
            const effectiveHeight = availableHeight - reserveBottom;

            if (!container || effectiveHeight <= 0 || availableWidth <= 0) {
                return;
            }

            const layoutOrder = getLayoutOrder();
            if (layoutOrder.length === 0) return;

            // Find the best fitting layout
            const attempts: Array<LayoutAttempt> = [];
            let bestLevel: LayoutLevel = layoutOrder[layoutOrder.length - 1];
            let bestScale = minScale;

            // For side-by-side lessons, we prefer single-line layouts WITHOUT teacher (levels 4, 5)
            // Only fall back to multi-line or teacher-including layouts if no simple single-line fits
            const isSingleLineNoTeacher = (level: LayoutLevel) =>
                level === 4 || level === 5;

            // First pass: try single-line layouts without teacher for side-by-side
            // Second pass (if needed): try all layouts
            const passes =
                isSideBySide && !isCancelledOrIrregular
                    ? [layoutOrder.filter(isSingleLineNoTeacher), layoutOrder]
                    : [layoutOrder];

            let found = false;
            for (const passLevels of passes) {
                if (found) break;
                for (const level of passLevels) {
                    const content = container.querySelector(
                        `[data-layout-level="${level}"]`
                    ) as HTMLElement;
                    if (!content) continue;

                    // Get natural dimensions
                    const contentHeight = content.scrollHeight;
                    const contentWidth = content.scrollWidth;

                    // Only record attempts once (during first iteration)
                    const alreadyRecorded = attempts.some(
                        (a) => a.level === level
                    );
                    if (!alreadyRecorded) {
                        if (contentHeight <= 0 || contentWidth <= 0) {
                            attempts.push({
                                level,
                                contentHeight,
                                contentWidth,
                                requiredScale: 0,
                                accepted: false,
                            });
                            continue;
                        }

                        // Calculate required scale to fit
                        const scaleH = effectiveHeight / contentHeight;
                        const scaleW = availableWidth / contentWidth;

                        // For single-line layouts (4, 5, 6), prioritize horizontal fit
                        // These layouts have minimal height and should be selected based on width
                        const isSingleLineLayout =
                            level === 4 || level === 5 || level === 6;

                        let requiredScale: number;
                        if (isSingleLineLayout) {
                            // For single-line: only care about width fitting
                            // Height is almost always sufficient for single lines
                            // Use height only as a sanity check (must be at least 0.5 scale)
                            requiredScale =
                                scaleH >= 0.5
                                    ? scaleW
                                    : Math.min(scaleH, scaleW);
                        } else {
                            // For multi-line layouts: use the more restrictive of the two
                            requiredScale = Math.min(scaleH, scaleW);
                        }

                        attempts.push({
                            level,
                            contentHeight,
                            contentWidth,
                            requiredScale,
                            accepted: requiredScale >= minScale,
                        });
                    }

                    const attempt = attempts.find((a) => a.level === level);
                    if (!attempt || attempt.requiredScale < minScale) continue;

                    // Accept this layout if it fits with acceptable scaling
                    bestLevel = level;
                    bestScale = Math.min(
                        maxScale,
                        Math.max(1, attempt.requiredScale)
                    );
                    found = true;
                    break;
                }
            }

            setSelectedLevel(bestLevel);
            setScale(bestScale);

            if (onDecision) {
                onDecision({
                    selectedLevel: bestLevel,
                    bestScale,
                    layoutOrder,
                    attempts,
                    availableHeight: effectiveHeight,
                    availableWidth,
                    reserveBottom,
                    isSideBySide,
                    isCancelledOrIrregular,
                });
            }
        }, [
            availableHeight,
            availableWidth,
            reserveBottom,
            layouts,
            minScale,
            maxScale,
            getLayoutOrder,
            isSideBySide,
            isCancelledOrIrregular,
            onDecision,
        ]);

        const layoutOrder = getLayoutOrder();

        // Don't render until we've determined the layout
        if (selectedLevel === null && layoutOrder.length > 0) {
            // Initial render - show minimal layout while measuring
            const fallbackLevel = layoutOrder[layoutOrder.length - 1];
            return (
                <div
                    className={className}
                    style={{
                        height: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    {/* Measurement container */}
                    <div
                        ref={measureContainerRef}
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            visibility: 'hidden',
                            pointerEvents: 'none',
                            width: availableWidth,
                            left: -9999,
                            top: 0,
                        }}
                    >
                        {layoutOrder.map((level) => (
                            <div
                                key={level}
                                data-layout-level={level}
                                style={{ display: 'block' }}
                            >
                                {getLayoutContent(level)}
                            </div>
                        ))}
                    </div>
                    {/* Show fallback while measuring */}
                    <div style={{ opacity: 0 }}>
                        {getLayoutContent(fallbackLevel)}
                    </div>
                </div>
            );
        }

        return (
            <div
                className={className}
                style={{
                    height: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Hidden measurement container - keeps all layouts measurable for re-evaluation */}
                <div
                    ref={measureContainerRef}
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        width: availableWidth,
                        left: -9999,
                        top: 0,
                    }}
                >
                    {layoutOrder.map((level) => (
                        <div
                            key={level}
                            data-layout-level={level}
                            style={{ display: 'block' }}
                        >
                            {getLayoutContent(level)}
                        </div>
                    ))}
                </div>

                {/* Visible content - selected layout with scaling */}
                <div
                    style={{
                        transform: scale !== 1 ? `scale(${scale})` : undefined,
                        transformOrigin: 'top left',
                    }}
                >
                    {selectedLevel !== null && getLayoutContent(selectedLevel)}
                </div>
            </div>
        );
    }
);

AdaptiveLessonContent.displayName = 'AdaptiveLessonContent';

/** Helper to convert layout level to object key */
function levelToKey(
    level: LayoutLevel
): keyof AdaptiveLessonContentProps['layouts'] {
    const map: Record<
        LayoutLevel,
        keyof AdaptiveLessonContentProps['layouts']
    > = {
        0: 'full',
        1: 'noTime',
        2: 'compact',
        3: 'subjectRoom',
        4: 'inlineRoom',
        5: 'subjectOnly',
        6: 'inlineAll',
    };
    return map[level];
}

export type LayoutAttempt = {
    level: LayoutLevel;
    contentHeight: number;
    contentWidth: number;
    requiredScale: number;
    accepted: boolean;
};

export type LayoutDecision = {
    selectedLevel: LayoutLevel;
    bestScale: number;
    layoutOrder: LayoutLevel[];
    attempts: LayoutAttempt[];
    availableHeight: number;
    availableWidth: number;
    reserveBottom: number;
    isSideBySide: boolean;
    isCancelledOrIrregular: boolean;
};

export default AdaptiveLessonContent;
