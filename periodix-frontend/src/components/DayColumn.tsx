import type { FC, ReactElement } from 'react';
import { useState, useLayoutEffect, useRef, useEffect, useMemo } from 'react';
import FitText from './FitText';
import EllipsisIcon from './EllipsisIcon';
import type { Lesson, LessonColors, Holiday } from '../types';
import { fmtHM, untisToMinutes } from '../utils/dates';
import { clamp } from '../utils/dates';
import { generateGradient, getDefaultGradient } from '../utils/colors';
import { extractSubjectType } from '../utils/subjectUtils';
import { MOBILE_MEDIA_QUERY } from '../utils/responsive';
import { hasLessonChanges, getRoomDisplayText } from '../utils/lessonChanges';

export type Block = {
    l: Lesson;
    startMin: number;
    endMin: number;
    colIndex: number;
    colCount: number;
    keySuffix?: string;
};

export type DayColumnProps = {
    day: Date;
    keyStr: string;
    items: Lesson[];
    holidays: Holiday[];
    START_MIN: number;
    END_MIN: number;
    SCALE: number;
    DAY_HEADER_PX: number;
    BOTTOM_PAD_PX: number;
    lessonColors: LessonColors;
    defaultLessonColors: LessonColors;
    onLessonClick: (lesson: Lesson) => void;
    isToday?: boolean;
    gradientOffsets?: Record<string, number>; // subject -> offset (0..1)
    hideHeader?: boolean; // suppress built-in header (used when external sticky header is rendered)
    mobileTinyLessonThresholdPx?: number; // threshold for tiny single lessons on mobile (px)
    isDeveloperMode?: boolean; // enables background click JSON popup
    suppressHolidayBanner?: boolean;
    isClassTimetable?: boolean;
};

const DayColumn: FC<DayColumnProps> = ({
    day,
    keyStr,
    items,
    holidays,
    START_MIN,
    END_MIN,
    SCALE,
    DAY_HEADER_PX,
    BOTTOM_PAD_PX,
    lessonColors,
    defaultLessonColors,
    onLessonClick,
    isToday = false,
    gradientOffsets,
    hideHeader = false,
    mobileTinyLessonThresholdPx = 56,
    isDeveloperMode = false,
    suppressHolidayBanner = false,
    isClassTimetable = false,
}) => {
    // Developer JSON modal state
    const [showDayJson, setShowDayJson] = useState(false);

    // Close on Escape when open
    useEffect(() => {
        if (!showDayJson) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowDayJson(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showDayJson]);
    // Detect mobile (<768px now; previously <640px). Responsive hook to decide hiding side-by-side overlaps.
    // Detect mobile synchronously on first render to avoid a second-pass layout jump
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
        } catch {
            return false;
        }
    });
    // Use layout effect so updates (e.g., orientation change) happen before paint, reducing flicker
    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        let mq: MediaQueryList | null = null;
        try {
            mq = window.matchMedia(MOBILE_MEDIA_QUERY);
        } catch {
            return;
        }
        const update = () => setIsMobile(mq!.matches);
        // In case environment changed before hydration
        update();
        mq.addEventListener('change', update);
        return () => {
            if (mq) mq.removeEventListener('change', update);
        };
    }, []);

    // Collapse-overlap state for narrow columns even when not considered "mobile"
    // Use hysteresis so layout doesn't flicker near the boundary.
    // Collapse when narrower than ENTER, expand back to side-by-side when wider than EXIT.
    const COLLAPSE_ENTER_WIDTH = isClassTimetable ? 100 : 195; // px (collapse when below this)
    const COLLAPSE_EXIT_WIDTH = isClassTimetable ? 105 : 200; // px (re-enable side-by-side when above this)
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [collapseNarrow, setCollapseNarrow] = useState(false);
    const [measuredWidth, setMeasuredWidth] = useState<number>(0);
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        let raf = 0;
        const compute = () => {
            try {
                const w = el.getBoundingClientRect().width;
                setMeasuredWidth(w);
                setCollapseNarrow((prev) => {
                    if (w < COLLAPSE_ENTER_WIDTH) return true;
                    if (w > COLLAPSE_EXIT_WIDTH) return false;
                    return prev;
                });
            } catch {
                /* ignore */
            }
        };
        compute();
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(compute);
        });
        try {
            ro.observe(el);
        } catch {
            /* ignore */
        }
        window.addEventListener('resize', compute);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('resize', compute);
        };
    }, [isClassTimetable, COLLAPSE_ENTER_WIDTH, COLLAPSE_EXIT_WIDTH]);

    // DEBUG: Log items for Thursday 27.11.2025 to verify data arrival
    // (Removed debug logs)

    // Helper function to detect if a lesson is merged (contains merge separator)
    const isLessonMerged = (lesson: Lesson): boolean => {
        return (
            (lesson.info?.includes(' | ') ?? false) ||
            (lesson.lstext?.includes(' | ') ?? false)
        );
    };
    const headerPx = hideHeader ? 8 : DAY_HEADER_PX; // minimal spacer when external sticky header used
    const containerHeight =
        (END_MIN - START_MIN) * SCALE + BOTTOM_PAD_PX + headerPx;

    // Precompute whether we should show denser or sparser grid lines (mobile gets 60‑min lines)
    const gridSlotMinutes = isMobile ? 60 : 30;

    // Mobile tiny-height threshold for single, non-overlapping lessons.
    // When a block is shorter than this (in px), hide teacher by default and show room only.
    // Priority: if only teacher changed (and room didn't), show teacher instead; if both changed, show room.
    // Fine-tune via prop 'mobileTinyLessonThresholdPx'.

    type ClusterBlock = {
        l: Lesson;
        startMin: number;
        endMin: number;
        keySuffix?: string;
    };

    // Helper to determine sort priority for side-by-side ordering
    // 1. Exam
    // 2. Irregular (valid change)
    // 3. Normal
    // 4. Irregular (change to empty)
    // 5. Cancelled
    const getLessonPriority = (l: Lesson): number => {
        if (l.exams && l.exams.length > 0) return 1;
        if (l.code === 'cancelled') return 5;

        const teachers = l.te || [];
        const rooms = l.ro || [];
        const isInvalidName = (name?: string) =>
            !name ||
            name.trim() === '---' ||
            name.trim() === '?' ||
            name.trim() === '';

        const hasGoodTeacherChange = teachers.some(
            (t) => !!t.orgname && !isInvalidName(t.name)
        );
        const hasGoodRoomChange = rooms.some(
            (r) => !!r.orgname && !isInvalidName(r.name)
        );

        if (hasGoodTeacherChange || hasGoodRoomChange) return 2;

        const hasBadTeacherChange = teachers.some(
            (t) => !!t.orgname && isInvalidName(t.name)
        );
        const hasBadRoomChange = rooms.some(
            (r) => !!r.orgname && isInvalidName(r.name)
        );

        if (hasBadTeacherChange || hasBadRoomChange) return 4;

        if (l.code === 'irregular') return 2;

        return 3;
    };

    // Slicing logic for mobile: split lessons into atomic segments to allow partial visibility
    const slicedItems = useMemo(() => {
        // If not mobile AND not collapsed narrow, just map to simple objects
        if (!isMobile && !collapseNarrow) {
            return items.map((l) => ({
                l,
                startMin: clamp(
                    untisToMinutes(l.startTime),
                    START_MIN,
                    END_MIN
                ),
                endMin: Math.max(
                    clamp(untisToMinutes(l.startTime), START_MIN, END_MIN),
                    clamp(untisToMinutes(l.endTime), START_MIN, END_MIN)
                ),
                keySuffix: '',
            }));
        }

        // Mobile (or narrow desktop): Slice lessons into atomic segments based on all start/end times
        const cuts = new Set<number>();
        // Add grid boundaries
        cuts.add(START_MIN);
        cuts.add(END_MIN);

        items.forEach((l) => {
            const s = clamp(untisToMinutes(l.startTime), START_MIN, END_MIN);
            const e = clamp(untisToMinutes(l.endTime), START_MIN, END_MIN);
            cuts.add(s);
            cuts.add(e);
        });

        const sortedCuts = Array.from(cuts).sort((a, b) => a - b);
        const result: {
            l: Lesson;
            startMin: number;
            endMin: number;
            keySuffix: string;
        }[] = [];

        items.forEach((l) => {
            const s = clamp(untisToMinutes(l.startTime), START_MIN, END_MIN);
            const e = clamp(untisToMinutes(l.endTime), START_MIN, END_MIN);
            if (s >= e) return;

            for (let i = 0; i < sortedCuts.length - 1; i++) {
                const t1 = sortedCuts[i];
                const t2 = sortedCuts[i + 1];
                if (t1 >= s && t2 <= e) {
                    // This segment is covered
                    result.push({
                        l,
                        startMin: t1,
                        endMin: t2,
                        keySuffix: `-${t1}`,
                    });
                }
            }
        });
        return result;
    }, [items, isMobile, collapseNarrow, START_MIN, END_MIN]);

    const blocks: Block[] = (() => {
        const evs: ClusterBlock[] = slicedItems
            .map((item) => {
                return {
                    l: item.l,
                    startMin: item.startMin,
                    endMin: item.endMin,
                    keySuffix: item.keySuffix,
                };
            })
            .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
        const clusters: Array<ClusterBlock[]> = [];
        let current: ClusterBlock[] = [];
        let curMaxEnd = -1;
        for (const ev of evs) {
            if (current.length === 0 || ev.startMin < curMaxEnd) {
                current.push(ev);
                curMaxEnd = Math.max(curMaxEnd, ev.endMin);
            } else {
                clusters.push(current);
                current = [ev];
                curMaxEnd = ev.endMin;
            }
        }
        if (current.length) clusters.push(current);
        const out: Block[] = [];
        for (const cl of clusters) {
            // Sort cluster by priority (High priority = Low number -> Left column)
            cl.sort((a, b) => {
                const pA = getLessonPriority(a.l);
                const pB = getLessonPriority(b.l);
                if (pA !== pB) return pA - pB;
                if (a.startMin !== b.startMin) return a.startMin - b.startMin;
                // Tie-breaker: shorter lessons first (e.g. single lesson vs double lesson starting at same time)
                return a.endMin - a.startMin - (b.endMin - b.startMin);
            });

            const columns: Array<ClusterBlock[]> = [];
            const placement = new Map<ClusterBlock, number>();
            for (const ev of cl) {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const col = columns[i];
                    const last = col[col.length - 1];
                    if (ev.startMin >= last.endMin) {
                        col.push(ev);
                        placement.set(ev, i);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    columns.push([ev]);
                    placement.set(ev, columns.length - 1);
                }
            }
            const colCount = Math.max(1, columns.length);
            for (const ev of cl)
                out.push({
                    l: ev.l,
                    startMin: ev.startMin,
                    endMin: ev.endMin,
                    colIndex: placement.get(ev)!,
                    colCount,
                    keySuffix: ev.keySuffix,
                });
        }
        return out;
    })();

    // Track the last bottom pixel per visual column signature to enforce gaps
    const lastBottomByCol: Record<string, number> = {};

    // Group blocks by exam for outline rendering
    const examGroups = new Map<number, Block[]>();
    blocks.forEach((b) => {
        if (b.l.exams && b.l.exams.length > 0) {
            b.l.exams.forEach((ex) => {
                if (!examGroups.has(ex.id)) {
                    examGroups.set(ex.id, []);
                }
                examGroups.get(ex.id)?.push(b);
            });
        }
    });

    const holiday = holidays.find((h) => {
        // Parse yyyymmdd number to Date
        const parseUntisDate = (n: number) => {
            const s = String(n);
            const y = Number(s.slice(0, 4));
            const mo = Number(s.slice(4, 6));
            const d = Number(s.slice(6, 8));
            return new Date(y, mo - 1, d);
        };

        const start = parseUntisDate(h.startDate);
        const end = parseUntisDate(h.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const current = new Date(day);
        current.setHours(0, 0, 0, 0);
        return current >= start && current <= end;
    });

    return (
        <div
            key={keyStr}
            className="relative px-1.5 first:pl-3 last:pr-3 overflow-hidden rounded-xl"
            style={{ height: containerHeight }}
            ref={containerRef}
            onClick={(e) => {
                if (!isDeveloperMode) return;
                // Ignore clicks on lessons or their children
                const target = e.target as HTMLElement;
                if (target.closest('.timetable-lesson')) return;
                // Only trigger when clicking within the column itself
                setShowDayJson(true);
            }}
        >
            {isDeveloperMode && showDayJson && (
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur"
                    onClick={() => setShowDayJson(false)}
                >
                    <div
                        className="relative max-w-[min(1000px,95vw)] w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10 border border-slate-200 dark:border-slate-700 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Day JSON – {day.toLocaleDateString()} (
                                {items.length} lesson
                                {items.length === 1 ? '' : 's'})
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                                    onClick={() => {
                                        try {
                                            navigator.clipboard.writeText(
                                                JSON.stringify(items, null, 2)
                                            );
                                        } catch {
                                            /* ignore */
                                        }
                                    }}
                                >
                                    Copy
                                </button>
                                <button
                                    type="button"
                                    className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                    onClick={() => setShowDayJson(false)}
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-3">
                            <pre className="text-[11px] leading-tight whitespace-pre-wrap break-all font-mono text-slate-800 dark:text-slate-100">
                                {JSON.stringify(items, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden transition-colors bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />
            {/* Today highlight overlay */}
            {isToday && (
                <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                    <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_0_2px_rgba(251,191,36,0.35)]" />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-200/20 via-amber-200/10 to-transparent dark:from-amber-300/15 dark:via-amber-300/10" />
                </div>
            )}

            {/* Holiday Overlay */}
            {holiday && !suppressHolidayBanner && (
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-yellow-50/90 dark:bg-yellow-900/40 backdrop-blur-[2px]" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="bg-white/50 dark:bg-black/20 p-4 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-md max-w-full w-full">
                            <h3 className="text-base sm:text-lg font-bold text-yellow-900 dark:text-yellow-100 leading-tight mb-1 whitespace-normal break-words">
                                {holiday.longName}
                            </h3>
                            {holiday.name !== holiday.longName && (
                                <p className="text-xs sm:text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    {holiday.name}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!hideHeader && (
                <div className="absolute left-0 right-0 top-0 z-10 pointer-events-none">
                    {/* Mobile: two centered rows (weekday, date) */}
                    <div className="block sm:hidden text-center leading-tight pt-1">
                        <div
                            className={`text-[11px] font-semibold ${
                                isToday
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            {day.toLocaleDateString(undefined, {
                                weekday: 'short',
                            })}
                        </div>
                        <div
                            className={`text-[10px] font-medium ${
                                isToday
                                    ? 'text-amber-600 dark:text-amber-200'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}
                        >
                            {day.toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: '2-digit',
                            })}
                        </div>
                    </div>

                    {/* Desktop: single line */}
                    <div
                        className={`hidden sm:block text-sm font-semibold tracking-tight leading-snug whitespace-nowrap overflow-hidden text-ellipsis px-2 pt-2 ${
                            isToday
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-700 dark:text-slate-200'
                        }`}
                    >
                        {day.toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                        })}
                    </div>
                </div>
            )}
            <div
                className="absolute left-0 right-0 opacity-55 dark:opacity-35 pointer-events-none rounded-b-xl overflow-hidden"
                style={{
                    top: headerPx,
                    bottom: 0,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                        gridSlotMinutes * SCALE - 1
                    }px, rgba(100,116,139,0.10) ${
                        gridSlotMinutes * SCALE - 1
                    }px, rgba(100,116,139,0.10) ${gridSlotMinutes * SCALE}px)`,
                }}
            />
            {/* Exam Outlines */}
            {Array.from(examGroups.entries()).map(([examId, groupBlocks]) => {
                if (groupBlocks.length === 0) return null;
                const firstBlock = groupBlocks[0];
                const exam = firstBlock.l.exams?.find((e) => e.id === examId);
                if (!exam) return null;

                // Use exam times for vertical span
                const startMin = clamp(
                    untisToMinutes(exam.startTime),
                    START_MIN,
                    END_MIN
                );
                const endMin = Math.max(
                    startMin,
                    clamp(untisToMinutes(exam.endTime), START_MIN, END_MIN)
                );

                // Use first block for horizontal positioning
                const b = firstBlock;
                const GAP_PCT = 1.5;
                const gapPx = Math.max(0, measuredWidth * (GAP_PCT / 100));
                const MOBILE_MIN_COLUMN_WIDTH = 140;

                let mobileVisibleCols = 1;
                if (isMobile && b.colCount > 1) {
                    const maxFit = Math.max(
                        1,
                        Math.floor(
                            (measuredWidth + gapPx) /
                                (MOBILE_MIN_COLUMN_WIDTH + gapPx)
                        )
                    );
                    mobileVisibleCols = Math.min(b.colCount, maxFit);
                }

                // Hide if the column is hidden (same logic as blocks)
                if (b.colCount > 1) {
                    if (!isMobile && collapseNarrow) {
                        if (b.colIndex !== 0) return null;
                    } else if (isMobile) {
                        if (b.colIndex >= mobileVisibleCols) return null;
                    }
                }

                let widthPct = (100 - GAP_PCT * (b.colCount - 1)) / b.colCount;
                let leftPct = b.colIndex * (widthPct + GAP_PCT);
                if (b.colCount > 1) {
                    if (!isMobile && collapseNarrow) {
                        widthPct = 100;
                        leftPct = 0;
                    } else if (isMobile) {
                        if (mobileVisibleCols <= 1) {
                            widthPct = 100;
                            leftPct = 0;
                        } else {
                            const visibleCols = mobileVisibleCols;
                            widthPct =
                                (100 - GAP_PCT * (visibleCols - 1)) /
                                visibleCols;
                            // We are showing the first N columns (0 to visibleCols-1)
                            // So visibleIndex is just colIndex
                            leftPct = b.colIndex * (widthPct + GAP_PCT);
                        }
                    }
                }

                const PAD_TOP = isMobile ? 2 : 4;
                const PAD_BOTTOM = isMobile ? 2 : 4;
                const startPxRaw = (startMin - START_MIN) * SCALE + headerPx;
                const endPxRaw = (endMin - START_MIN) * SCALE + headerPx;
                const topPx = Math.round(startPxRaw) + PAD_TOP;
                const endPx = Math.round(endPxRaw) - PAD_BOTTOM;
                const heightPx = Math.max(isMobile ? 30 : 14, endPx - topPx);

                return (
                    <div
                        key={`exam-${examId}`}
                        className="absolute pointer-events-none z-10 rounded-md border border-yellow-400 dark:border-yellow-300 bg-yellow-400/20 dark:bg-yellow-400/20"
                        style={{
                            top: topPx,
                            height: heightPx,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            borderWidth: '3px',
                        }}
                    />
                );
            })}
            {blocks
                // render in top order to make bottom tracking deterministic
                // Sort by start time asc, then duration desc (Longer first) so Shorter renders on top (z-index)
                .slice()
                .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
                .map((b) => {
                    const { l } = b;
                    // Determine how many overlapping columns to render
                    // Desktop wide: render all columns
                    // Narrow (measured) non-mobile: collapse to 1 (rightmost)
                    // Mobile: render as many as reasonably fit at a minimum width; otherwise collapse to 1
                    const GAP_PCT = 1.5; // Reduced gap for better space utilization
                    const gapPx = Math.max(0, measuredWidth * (GAP_PCT / 100));
                    const MOBILE_MIN_COLUMN_WIDTH = 140; // px - min per-lesson width on mobile to allow side-by-side
                    const DESKTOP_MIN_COLUMN_WIDTH = isClassTimetable ? 28 : 60; // px - min per-lesson width on desktop before collapsing
                    const DESKTOP_MAX_COLUMNS = 3;

                    let visibleCols = b.colCount;

                    if (isMobile) {
                        if (b.colCount > 1) {
                            const maxFit = Math.max(
                                1,
                                Math.floor(
                                    (measuredWidth + gapPx) /
                                        (MOBILE_MIN_COLUMN_WIDTH + gapPx)
                                )
                            );
                            visibleCols = Math.min(b.colCount, maxFit);
                        }
                    } else {
                        // Desktop overcrowding check with explicit cap
                        if (b.colCount > 1) {
                            const maxFit = Math.max(
                                1,
                                Math.floor(
                                    (measuredWidth + gapPx) /
                                        (DESKTOP_MIN_COLUMN_WIDTH + gapPx)
                                )
                            );
                            const cappedFit = Math.min(
                                DESKTOP_MAX_COLUMNS,
                                maxFit
                            );
                            visibleCols = Math.min(b.colCount, cappedFit);
                        }
                    }

                    const isCollapsed = visibleCols < b.colCount;
                    const isMobileCollapsed = isMobile && isCollapsed; // Keep for mobile-specific styling if needed
                    const isDesktopCollapsed =
                        !isMobile && (collapseNarrow || isCollapsed);

                    // Hide non-visible columns depending on state
                    if (b.colCount > 1) {
                        if (!isMobile && collapseNarrow) {
                            // Show the first column (Highest Priority)
                            if (b.colIndex !== 0) return null;
                        } else if (isCollapsed) {
                            // Show the first N columns (Highest Priority)
                            if (b.colIndex >= visibleCols) return null;
                        }
                    }

                    const cancelled = l.code === 'cancelled';
                    const irregular = l.code === 'irregular';
                    // Determine if this lesson represents a merged (double / multi) lesson
                    const isMerged = isLessonMerged(l);
                    const hasChanges = hasLessonChanges(l);
                    const subject = l.su?.[0]?.name ?? l.activityType ?? '—';
                    const subjectType = extractSubjectType(subject);
                    const displaySubject = subjectType;
                    const room = l.ro?.map((r) => r.name).join(', ');
                    const teacher = l.te?.map((t) => t.name).join(', ');
                    const roomMobile = room
                        ? room
                              .split(',')
                              .map((part) =>
                                  part.replace(/\s+(?:WB?|TV|B)$/i, '').trim()
                              )
                              .join(', ')
                        : room;

                    // Mobile single-lesson (non-overlapping) detection for special styling tweaks
                    const singleMobile = isMobile && b.colCount === 1;

                    const effectiveColor =
                        lessonColors[subjectType] ??
                        defaultLessonColors[subjectType] ??
                        null;
                    const offset = gradientOffsets?.[subjectType] ?? 0.5;
                    const baseGradient = effectiveColor
                        ? generateGradient(effectiveColor, offset)
                        : getDefaultGradient();

                    // Create tinted gradient for cancelled/irregular lessons using CSS overlays
                    const gradient = baseGradient;
                    const statusOverlay = cancelled
                        ? // Reduced red tint opacity for cancelled lessons (was 0.6/0.55/0.6)
                          'linear-gradient(to right, rgba(239, 68, 68, 0.38), rgba(239, 68, 68, 0.32), rgba(239, 68, 68, 0.38))'
                        : irregular
                        ? 'linear-gradient(to right, rgba(16, 185, 129, 0.6), rgba(16, 185, 129, 0.55), rgba(16, 185, 129, 0.6))'
                        : null;

                    let widthPct =
                        (100 - GAP_PCT * (b.colCount - 1)) / b.colCount;
                    let leftPct = b.colIndex * (widthPct + GAP_PCT);
                    if (b.colCount > 1) {
                        if (!isMobile && collapseNarrow) {
                            widthPct = 100;
                            leftPct = 0;
                        } else if (isCollapsed) {
                            if (visibleCols <= 1) {
                                widthPct = 100;
                                leftPct = 0;
                            } else {
                                widthPct =
                                    (100 - GAP_PCT * (visibleCols - 1)) /
                                    visibleCols;
                                // We are showing the first N columns (0 to visibleCols-1)
                                // So visibleIndex is just colIndex
                                leftPct = b.colIndex * (widthPct + GAP_PCT);
                            }
                        }
                    }

                    // Pixel-snapped positioning
                    // Mobile: tighter outer padding but slightly larger minimum block height
                    const PAD_TOP = isMobile ? 2 : 4;
                    const PAD_BOTTOM = isMobile ? 2 : 4;
                    const startPxRaw =
                        (b.startMin - START_MIN) * SCALE + headerPx;
                    const endPxRaw = (b.endMin - START_MIN) * SCALE + headerPx;
                    let topPx = Math.round(startPxRaw) + PAD_TOP;
                    const endPx = Math.round(endPxRaw) - PAD_BOTTOM;
                    // Gap budget (space we leave for enforced separation after adjustments)
                    const GAP_BUDGET = isMobile ? 1 : 2;
                    // Minimum visual height per lesson

                    const MIN_EVENT_HEIGHT = isMobile ? 30 : 14; // slightly larger baseline on mobile for tap comfort
                    let heightPx = Math.max(
                        MIN_EVENT_HEIGHT,
                        endPx - topPx - GAP_BUDGET
                    );

                    // Enforce per-column cumulative bottom to avoid tiny overlaps from rounding
                    const colKey = `${b.colIndex}/${b.colCount}`;
                    const lastBottom = lastBottomByCol[colKey] ?? -Infinity;
                    const desiredTop = lastBottom + (isMobile ? 1 : 2); // reduced gap on mobile
                    if (topPx < desiredTop) {
                        const delta = desiredTop - topPx;
                        topPx += delta;
                        heightPx = Math.max(MIN_EVENT_HEIGHT, heightPx - delta);
                    }
                    lastBottomByCol[colKey] = topPx + heightPx;

                    // Reserve space for bottom labels and pad right for indicators
                    const labelReservePx = 0; // No longer reserve space for status labels
                    const MIN_BOTTOM_RESERVE = isMobile ? 4 : 6; // slightly tighter on mobile
                    const reservedBottomPx = Math.max(
                        labelReservePx,
                        MIN_BOTTOM_RESERVE
                    );
                    // Extra right padding for room label shown under icons on desktop
                    const roomPadRightPx =
                        !isMobile && room ? (isClassTimetable ? 20 : 88) : 0;
                    // Allow a more compact mobile layout: lower height threshold for previews
                    // Previously used to decide rendering of inline info previews; now removed.
                    // const MIN_PREVIEW_HEIGHT = isMobile ? 44 : 56;

                    // Determine if there's enough space to show time frame along with teacher
                    // We need space for: subject (~16px) + teacher (~14px) + time (~14px) + margins
                    // Only show time if we have sufficient space for subject + teacher + time (minimum 50px total)
                    const MIN_TIME_DISPLAY_HEIGHT = isMobile
                        ? 56
                        : isClassTimetable
                        ? 44
                        : 56;
                    // When the timeframe wraps to multiple lines, require a bit more vertical space for single (non-merged) lessons
                    const MIN_TIME_DISPLAY_HEIGHT_WRAPPED_SINGLE = isMobile
                        ? 0 // timeframe is not shown on mobile
                        : isClassTimetable
                        ? 64
                        : 80;
                    // Second threshold for very compact layout: move teacher to same row as subject
                    const MIN_COMPACT_DISPLAY_HEIGHT = isMobile
                        ? 45
                        : isClassTimetable
                        ? 40
                        : 45;
                    // Separate threshold for cancelled/irregular lessons (they can use compact layout more aggressively)
                    const MIN_COMPACT_DISPLAY_HEIGHT_CANCELLED_IRREGULAR =
                        isMobile ? 55 : isClassTimetable ? 48 : 55;
                    const availableSpace = heightPx - reservedBottomPx;
                    const canShowTimeFrame =
                        !isMobile && availableSpace >= MIN_TIME_DISPLAY_HEIGHT;

                    // Use different compact layout thresholds for cancelled/irregular vs normal lessons
                    const compactThreshold =
                        cancelled || irregular
                            ? MIN_COMPACT_DISPLAY_HEIGHT_CANCELLED_IRREGULAR
                            : MIN_COMPACT_DISPLAY_HEIGHT;
                    const shouldUseCompactLayout =
                        !isMobile && availableSpace <= compactThreshold;

                    // Compute content padding so mobile remains centered when icons exist
                    // Desktop readability fix:
                    // Previously we subtracted the full indicator stack width from the content area (indicatorsPadRightPx),
                    // which caused FitText to aggressively down‑scale subject/time/teacher text even though the icons
                    // only occupy a small corner on the right. We now only reserve space for the optional room label plus
                    // a small constant (8px) and let the text flow underneath the vertical icon column if needed.
                    // Reduce padding when lessons are side by side to maximize text space
                    const sideByySideAdjustment =
                        b.colCount > 1
                            ? Math.max(0, roomPadRightPx - 40)
                            : roomPadRightPx;
                    const contentPadRight = isMobile
                        ? 0 // mobile keeps centered layout
                        : sideByySideAdjustment + 4; // reduced padding for side-by-side lessons
                    const contentPadLeft = 0;

                    // Auto contrast decision based on middle gradient (via) luminance heuristics
                    const viaColor = gradient.via;
                    let luminance = 0.3;
                    if (/^#[0-9A-Fa-f]{6}$/.test(viaColor)) {
                        const r = parseInt(viaColor.slice(1, 3), 16) / 255;
                        const g = parseInt(viaColor.slice(3, 5), 16) / 255;
                        const b = parseInt(viaColor.slice(5, 7), 16) / 255;
                        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    }
                    const textColorClass =
                        luminance > 0.62 ? 'text-slate-900' : 'text-white';

                    // Decide tiny mobile single layout behavior
                    const roomInfoMeta = getRoomDisplayText(l);
                    const roomChanged = !!roomInfoMeta?.hasChanges;
                    const teacherChanged = !!l.te?.some((t) => !!t.orgname);
                    const isTinyMobileSingle =
                        singleMobile && heightPx < mobileTinyLessonThresholdPx;
                    // In tiny mode:
                    // - default: show room (if available and not cancelled/irregular)
                    // - if only teacher changed, show teacher instead
                    // - if both changed, show room again
                    const showTeacherTiny =
                        isTinyMobileSingle &&
                        ((teacherChanged && !roomChanged) ||
                            (!roomMobile && (l.te?.length ?? 0)));
                    const showRoomTiny =
                        isTinyMobileSingle &&
                        !!roomMobile &&
                        !(cancelled || irregular) &&
                        (!teacherChanged || roomChanged);

                    const showClassCondensedMeta =
                        isClassTimetable &&
                        !isMobile &&
                        !canShowTimeFrame &&
                        availableSpace > 14;

                    const condensedTimeLabel = showClassCondensedMeta
                        ? `${fmtHM(b.startMin)}–${fmtHM(b.endMin)}`
                        : null;

                    const inlineRoomBlock =
                        !isMobile && room ? (
                            <div
                                className={`text-[11px] leading-tight mt-0.5 ${
                                    cancelled
                                        ? 'lesson-cancelled-room'
                                        : 'opacity-95'
                                }`}
                            >
                                <span
                                    className={
                                        roomInfoMeta?.hasChanges
                                            ? 'change-highlight-inline'
                                            : undefined
                                    }
                                >
                                    {room}
                                </span>
                            </div>
                        ) : null;

                    return (
                        <div
                            key={`${l.id}${b.keySuffix || ''}`}
                            className={`timetable-lesson absolute rounded-md p-2 sm:p-2 text-[11px] sm:text-xs ring-1 ring-slate-900/10 dark:ring-white/15 overflow-hidden cursor-pointer transform duration-150 hover:shadow-lg hover:brightness-110 hover:saturate-140 hover:contrast-110 backdrop-blur-[1px] ${textColorClass} ${
                                cancelled
                                    ? 'border-6 border-rose-600 dark:border-rose-500'
                                    : irregular
                                    ? 'border-6 border-emerald-500 dark:border-emerald-400'
                                    : 'ring-1 ring-slate-900/10 dark:ring-white/15'
                            }`}
                            style={{
                                top: topPx,
                                height: heightPx,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                background: statusOverlay
                                    ? `${statusOverlay}, linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})`
                                    : `linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})`,
                                // Larger invisible hit target for touch
                                paddingTop: isMobile ? 4 : undefined,
                                paddingBottom: isMobile ? 4 : undefined,
                                boxShadow:
                                    '0 1px 2px -1px rgba(0,0,0,0.25), 0 2px 6px -1px rgba(0,0,0,0.25)',
                            }}
                            title={`${fmtHM(b.startMin)}–${fmtHM(
                                b.endMin
                            )} | ${subject} ${room ? `| ${room}` : ''} ${
                                teacher ? `| ${teacher}` : ''
                            }`}
                            onClick={() => onLessonClick(l)}
                        >
                            {/* Indicator for collapsed overlaps (mobile overlay position) */}
                            {isMobileCollapsed && b.colCount > 1 && (
                                <>
                                    {/* subtle left edge bar to suggest stacking */}
                                    <div
                                        className="absolute inset-y-0 left-0 w-1 rounded-l-md bg-black/20 dark:bg-white/20 pointer-events-none sm:hidden"
                                        aria-hidden="true"
                                        style={{ mixBlendMode: 'soft-light' }}
                                    />
                                    {/* stacked-card inner outlines to hint multiple layers */}
                                    <div
                                        className="absolute inset-0 pointer-events-none sm:hidden"
                                        aria-hidden="true"
                                    >
                                        <div className="absolute inset-0 rounded-md border border-white/25 dark:border-white/20 opacity-40" />
                                        <div className="absolute inset-[2px] rounded-[6px] border border-black/25 dark:border-black/40 opacity-35" />
                                    </div>
                                    {/* layered tabs glyph (two overlapping rectangles) */}
                                    <div
                                        className="absolute left-1 top-1 pointer-events-none sm:hidden"
                                        title="Multiple overlapping lessons"
                                    >
                                        <svg
                                            width="16"
                                            height="12"
                                            viewBox="0 0 16 12"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <rect
                                                x="4"
                                                y="3"
                                                width="11"
                                                height="7"
                                                rx="2"
                                                fill="rgba(0,0,0,0.28)"
                                            />
                                            <rect
                                                x="1"
                                                y="1"
                                                width="11"
                                                height="7"
                                                rx="2"
                                                fill="rgba(255,255,255,0.55)"
                                            />
                                        </svg>
                                    </div>
                                </>
                            )}
                            {/* Subtle stacked design when column is narrow (between mobile and side-by-side) */}
                            {isDesktopCollapsed && b.colCount > 1 && (
                                <>
                                    {/* left edge bar to suggest layering */}
                                    <div
                                        className="absolute inset-y-0 left-0 w-1 rounded-l-md bg-black/15 dark:bg-white/15 pointer-events-none hidden sm:block"
                                        aria-hidden="true"
                                        style={{ mixBlendMode: 'soft-light' }}
                                    />
                                    {/* faint inner outlines indicating multiple cards */}
                                    <div
                                        className="absolute inset-0 pointer-events-none hidden sm:block"
                                        aria-hidden="true"
                                    >
                                        <div className="absolute inset-0 rounded-md border border-white/20 dark:border-white/15 opacity-30" />
                                        <div className="absolute inset-[2px] rounded-[6px] border border-black/20 dark:border-black/35 opacity-25" />
                                    </div>
                                </>
                            )}
                            {/* Indicators */}
                            <div className="absolute top-1 right-1 hidden sm:flex flex-col items-end gap-1">
                                <div className="flex gap-1 items-center">
                                    {/* Desktop/narrow stacked indicator placed with badges when overlaps are collapsed */}
                                    {isDesktopCollapsed && b.colCount > 1 && (
                                        <div
                                            className="w-4 h-4 rounded-[4px] bg-black/25 dark:bg-white/20 flex items-center justify-center shadow-sm ring-1 ring-black/20 dark:ring-white/20"
                                            title="Multiple overlapping lessons"
                                        >
                                            <svg
                                                width="12"
                                                height="9"
                                                viewBox="0 0 16 12"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <rect
                                                    x="4"
                                                    y="3"
                                                    width="11"
                                                    height="7"
                                                    rx="2"
                                                    fill="rgba(0,0,0,0.45)"
                                                />
                                                <rect
                                                    x="1"
                                                    y="1"
                                                    width="11"
                                                    height="7"
                                                    rx="2"
                                                    fill="rgba(255,255,255,0.7)"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.homework && l.homework.length > 0 && (
                                        <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.info && (
                                        <div className="w-3 h-3 bg-blue-400 dark:bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.lstext && (
                                        <div className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                            </svg>
                                        </div>
                                    )}
                                    {l.exams && l.exams.length > 0 && (
                                        <div className="w-3 h-3 bg-red-400 dark:bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {hasChanges && (
                                        <div className="w-3 h-3 bg-emerald-400 dark:bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {/* Desktop inline info snippet under icons (only when time is shown) */}
                                {l.info &&
                                    l.info.trim().length < 4 &&
                                    canShowTimeFrame && (
                                        <div
                                            className="mt-0.5 max-w-[140px] text-[10px] leading-snug text-white/90 text-right bg-black/15 dark:bg-black/20 px-1 py-0.5 rounded-sm backdrop-blur-[1px] overflow-hidden"
                                            style={{ maxHeight: '3.3em' }}
                                        >
                                            {l.info}
                                        </div>
                                    )}
                                {l.lstext &&
                                    l.lstext.trim().length < 4 &&
                                    canShowTimeFrame && (
                                        <div
                                            className="mt-0.5 max-w-[140px] text-[10px] leading-snug text-white/90 text-right bg-black/10 dark:bg-black/15 px-1 py-0.5 rounded-sm backdrop-blur-[1px] overflow-hidden"
                                            style={{ maxHeight: '3.3em' }}
                                        >
                                            {l.lstext}
                                        </div>
                                    )}
                            </div>

                            {/* Content */}
                            <div
                                className="flex h-full min-w-0 flex-col"
                                style={{
                                    paddingBottom: reservedBottomPx,
                                    paddingRight: contentPadRight,
                                    paddingLeft: contentPadLeft,
                                }}
                            >
                                {/* Mobile: absolute icons overlay (no layout impact) */}
                                <div className="sm:hidden absolute top-1.5 right-1.5 flex flex-row-reverse gap-1 items-center pointer-events-none">
                                    {/* Mobile badges: show limited badges for single lessons, up to 3 for merged lessons */}
                                    {(() => {
                                        const badges: ReactElement[] = [];
                                        const baseClass =
                                            'w-3.5 h-3.5 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm';

                                        // Count information types available
                                        const hasHomework =
                                            l.homework && l.homework.length > 0;
                                        const hasInfo = !!l.info;
                                        const hasLstext = !!l.lstext;
                                        const hasExams =
                                            l.exams && l.exams.length > 0;
                                        const informationCount = [
                                            hasHomework,
                                            hasInfo,
                                            hasLstext,
                                            hasExams,
                                        ].filter(Boolean).length;

                                        const isMerged = isLessonMerged(l);

                                        // For single lessons with multiple information types, show ellipsis instead
                                        if (!isMerged && informationCount > 1) {
                                            badges.push(
                                                <div
                                                    key="ellipsis"
                                                    className={`bg-slate-500/90 dark:bg-slate-400/90 ${baseClass}`}
                                                    title="Multiple information items - click lesson for details"
                                                >
                                                    <EllipsisIcon className="w-2 h-2 text-white" />
                                                </div>
                                            );
                                        } else {
                                            // For merged lessons or single lessons with 1 info type, show individual badges
                                            if (hasHomework)
                                                badges.push(
                                                    <div
                                                        key="hw"
                                                        className={`bg-amber-500/90 dark:bg-amber-500/90 ${baseClass}`}
                                                    >
                                                        <svg
                                                            className="w-2 h-2 text-white"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </div>
                                                );
                                            if (hasInfo)
                                                badges.push(
                                                    <div
                                                        key="info"
                                                        className={`bg-blue-500/90 dark:bg-blue-500/90 ${baseClass}`}
                                                    >
                                                        <svg
                                                            className="w-2 h-2 text-white"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </div>
                                                );
                                            if (hasLstext)
                                                badges.push(
                                                    <div
                                                        key="lstext"
                                                        className={`bg-violet-500/90 dark:bg-violet-400/90 ${baseClass}`}
                                                    >
                                                        <svg
                                                            className="w-2 h-2 text-white"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                                        </svg>
                                                    </div>
                                                );
                                            if (hasExams)
                                                badges.push(
                                                    <div
                                                        key="exam"
                                                        className={`bg-red-500/90 dark:bg-red-500/90 ${baseClass}`}
                                                    >
                                                        <svg
                                                            className="w-2 h-2 text-white"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </div>
                                                );
                                        }

                                        // For merged lessons, keep the limit of 3 badges
                                        return isMerged
                                            ? badges.slice(0, 3)
                                            : badges.slice(0, 1);
                                    })()}
                                </div>

                                {/* Mobile centered layout */}
                                <div className="flex flex-col items-center justify-center text-center gap-0 h-full sm:hidden px-0.5">
                                    {/* Info preview removed from mobile timetable view */}
                                    <div
                                        className={`font-semibold leading-tight w-full whitespace-nowrap truncate ${
                                            cancelled
                                                ? 'lesson-cancelled-subject'
                                                : ''
                                        }`}
                                        style={{
                                            fontSize:
                                                'clamp(12px, 3.5vw, 15px)',
                                        }}
                                    >
                                        {displaySubject}
                                    </div>
                                    {(() => {
                                        const hasTeachers = !!(
                                            l.te && l.te.length > 0
                                        );
                                        if (!hasTeachers) return null;
                                        // In tiny mobile single mode, only show teacher if it has priority
                                        if (
                                            isTinyMobileSingle &&
                                            !showTeacherTiny
                                        )
                                            return null;
                                        return (
                                            <div
                                                className={`text-[11px] leading-tight truncate max-w-full flex flex-wrap justify-center gap-x-1 ${
                                                    cancelled
                                                        ? 'lesson-cancelled-teacher'
                                                        : ''
                                                }`}
                                            >
                                                {(l.te ?? []).map((t, i) => (
                                                    <span
                                                        key={i}
                                                        className={
                                                            t.orgname
                                                                ? singleMobile
                                                                    ? 'change-highlight-mobile'
                                                                    : 'change-highlight-inline'
                                                                : undefined
                                                        }
                                                    >
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    {(() => {
                                        const roomInfo = getRoomDisplayText(l);
                                        // Tiny mode decision: show room when allowed by priority
                                        if (isTinyMobileSingle) {
                                            if (!showRoomTiny) return null;
                                        } else {
                                            // Normal mobile rules
                                            if (
                                                !roomMobile ||
                                                cancelled ||
                                                irregular
                                            )
                                                return null;
                                        }
                                        return (
                                            <div
                                                className={`text-[11px] leading-tight truncate max-w-full ${
                                                    cancelled
                                                        ? 'lesson-cancelled-room'
                                                        : ''
                                                }`}
                                            >
                                                <div
                                                    className={
                                                        roomInfo.hasChanges
                                                            ? singleMobile
                                                                ? 'change-highlight-mobile'
                                                                : 'change-highlight opacity-90'
                                                            : 'opacity-90'
                                                    }
                                                >
                                                    {roomMobile}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Removed lstext preview in timetable (mobile) */}
                                </div>
                                {/* Desktop layout - adaptive based on available space */}
                                <div className="hidden sm:flex flex-col sm:flex-row items-stretch justify-between gap-1.5 sm:gap-2 min-w-0 h-full">
                                    <FitText
                                        mode="both"
                                        maxScale={1.6}
                                        minScale={isClassTimetable ? 0.55 : 0.9} // prevent overly tiny scaling that reduced readability
                                        reserveBottom={reservedBottomPx}
                                        className="min-w-0 self-stretch"
                                    >
                                        {shouldUseCompactLayout ? (
                                            // Compact layout: subject and teacher on same line
                                            <div className="flex flex-wrap items-baseline gap-x-2">
                                                <div
                                                    className={`font-semibold leading-tight text-[13px] ${
                                                        cancelled
                                                            ? 'lesson-cancelled-subject'
                                                            : ''
                                                    }`}
                                                >
                                                    {displaySubject}
                                                </div>
                                                {(() => {
                                                    if (
                                                        !l.te ||
                                                        l.te.length === 0
                                                    )
                                                        return null;
                                                    return (
                                                        <div
                                                            className={`leading-tight text-[12px] flex flex-wrap gap-x-1 ${
                                                                cancelled
                                                                    ? 'lesson-cancelled-teacher'
                                                                    : ''
                                                            } mb-0.5`}
                                                        >
                                                            {l.te.map(
                                                                (t, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className={
                                                                            t.orgname
                                                                                ? 'change-highlight-inline'
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {t.name}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            // Normal layout: subject, teacher, time (time moved below teacher per request)
                                            <>
                                                <div
                                                    className={`font-semibold leading-tight text-[13px] ${
                                                        cancelled
                                                            ? 'lesson-cancelled-subject'
                                                            : ''
                                                    }`}
                                                >
                                                    {displaySubject}
                                                </div>
                                                {(() => {
                                                    if (
                                                        !l.te ||
                                                        l.te.length === 0
                                                    )
                                                        return null;
                                                    return (
                                                        <div
                                                            className={`leading-tight text-[12px] flex flex-wrap gap-x-1 ${
                                                                cancelled
                                                                    ? 'lesson-cancelled-teacher'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {l.te.map(
                                                                (t, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className={
                                                                            t.orgname
                                                                                ? 'change-highlight-inline'
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {t.name}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                {/* Timeframe moved below teacher */}
                                                {canShowTimeFrame &&
                                                    (!(
                                                        cancelled || irregular
                                                    ) ||
                                                        ((cancelled ||
                                                            irregular) &&
                                                            isMerged)) && (
                                                        <ResponsiveTimeFrame
                                                            startMin={
                                                                b.startMin
                                                            }
                                                            endMin={b.endMin}
                                                            cancelled={
                                                                cancelled &&
                                                                isMerged
                                                            }
                                                            // Hide time for single lessons when wrapped if not enough height
                                                            availableSpace={
                                                                availableSpace
                                                            }
                                                            singleLesson={
                                                                !isMerged
                                                            }
                                                            minHeightWhenWrapped={
                                                                MIN_TIME_DISPLAY_HEIGHT_WRAPPED_SINGLE
                                                            }
                                                        />
                                                    )}
                                            </>
                                        )}
                                        {inlineRoomBlock}
                                        {condensedTimeLabel && (
                                            <div className="text-[11px] leading-tight opacity-85 mt-0.5">
                                                {condensedTimeLabel}
                                            </div>
                                        )}
                                    </FitText>
                                </div>
                                {/* Info/Notes preview (desktop) */}
                                {/* Info preview moved to indicators area (desktop) */}
                                {/* Removed lstext preview in timetable (desktop) */}
                                {/* {l.lstext && canShowPreview && (
                                    <div className="hidden sm:block mt-0.5 text-[11px] leading-snug text-white/90 whitespace-pre-wrap">
                                        {l.lstext}
                                    </div>
                                )} */}
                                {/* Status text overlays removed - now shown only in modal */}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};

export default DayColumn;

// --- Helper component for responsive timeframe (desktop) ---
// Displays the time range horizontally when there is enough width; otherwise
// wraps into a vertical stack:
//  HH:MM\n+//    –\n+//  HH:MM
// The dash is centered and slightly muted for readability.
// Dynamic timeframe wrapping configuration
// We measure intrinsic single-line width of the time range and compare against available inner width.
// Hysteresis prevents flicker when resizing near the boundary.
// Previous values rarely triggered wrapping because the column width almost always satisfied the deficit rule.
// We now:
//  - use a realistic fallback intrinsic width (~120px for "HH:MM–HH:MM")
//  - wrap when (available + WRAP_ENTER_SLACK) < intrinsic (i.e. we are short by more than slack)
//  - unwrap when (available - WRAP_EXIT_SLACK) > intrinsic (i.e. we have comfortable surplus)
//  - add stronger column width based force wrap/unwrap thresholds
const MIN_FALLBACK_INLINE_WIDTH = 120; // Conservative estimate if measurement fails
const WRAP_ENTER_SLACK = 2; // Smaller slack => wraps sooner when tight
const WRAP_EXIT_SLACK = 8; // Larger surplus required to unwrap to avoid oscillation
// Additional column-based heuristic: even if intrinsic fits, force vertical when the whole column is narrow
const FORCE_WRAP_COLUMN_WIDTH = 180; // px - below this force vertical layout
const FORCE_UNWRAP_COLUMN_WIDTH = 190; // px - need to exceed this to allow reverting to single line

const ResponsiveTimeFrame: FC<{
    startMin: number;
    endMin: number;
    cancelled?: boolean;
    // Available vertical space inside the lesson content area (px)
    availableSpace?: number;
    // Whether this is a single (non-merged) lesson
    singleLesson?: boolean;
    // Minimum height required to show wrapped time for single lessons
    minHeightWhenWrapped?: number;
}> = ({
    startMin,
    endMin,
    cancelled = false,
    availableSpace,
    singleLesson = false,
    minHeightWhenWrapped = 64,
}) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [wrapVertical, setWrapVertical] = useState(false);

    useEffect(() => {
        const timeEl = ref.current;
        if (!timeEl) return;
        const lessonEl = timeEl.closest(
            '.timetable-lesson'
        ) as HTMLElement | null;
        if (!lessonEl) return;

        // Hidden measurer for intrinsic single-line width
        const meas = document.createElement('span');
        const cs = getComputedStyle(timeEl);
        Object.assign(meas.style, {
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontSize: cs.fontSize,
            fontFamily: cs.fontFamily,
            fontWeight: cs.fontWeight,
            letterSpacing: cs.letterSpacing,
        } as CSSStyleDeclaration);
        meas.textContent = `${fmtHM(startMin)}–${fmtHM(endMin)}`;
        document.body.appendChild(meas);

        let frame = 0;
        let wrapped = false;

        const compute = () => {
            try {
                const intrinsic =
                    meas.getBoundingClientRect().width ||
                    MIN_FALLBACK_INLINE_WIDTH;
                const lessonRect = lessonEl.getBoundingClientRect();
                const columnWidth = lessonRect.width;
                // Derive available width by subtracting horizontal padding + reserved area for right icon stack / room label.
                const style = getComputedStyle(lessonEl);
                const padLeft = parseFloat(style.paddingLeft) || 0;
                const padRight = parseFloat(style.paddingRight) || 0;
                // Reserve ~30px for potential indicators / internal padding to push earlier wrapping.
                const available = Math.max(
                    0,
                    columnWidth - padLeft - padRight - 30
                );

                // Column width based forced state overrides intrinsic logic (with hysteresis)
                if (!wrapped && columnWidth < FORCE_WRAP_COLUMN_WIDTH) {
                    wrapped = true;
                    setWrapVertical(true);
                    return;
                }
                if (wrapped && columnWidth > FORCE_UNWRAP_COLUMN_WIDTH) {
                    // Don't early return; allow intrinsic logic to potentially keep it wrapped if still too tight
                }

                if (!wrapped) {
                    // Wrap if after adding enter slack we still cannot fit intrinsic width
                    if (available + WRAP_ENTER_SLACK < intrinsic) {
                        wrapped = true;
                        setWrapVertical(true);
                    }
                } else {
                    // Unwrap only with comfortable surplus + column wide enough
                    if (
                        available - WRAP_EXIT_SLACK > intrinsic &&
                        columnWidth > FORCE_UNWRAP_COLUMN_WIDTH
                    ) {
                        wrapped = false;
                        setWrapVertical(false);
                    }
                }
            } catch {
                /* ignore */
            }
        };

        // Initial after layout settle
        frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(compute);
        });

        const ro = new ResizeObserver(compute);
        try {
            ro.observe(lessonEl);
        } catch {
            /* ignore */
        }
        window.addEventListener('resize', compute);
        window.addEventListener('orientationchange', compute);
        document.addEventListener('visibilitychange', compute);

        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
            window.removeEventListener('resize', compute);
            window.removeEventListener('orientationchange', compute);
            document.removeEventListener('visibilitychange', compute);
            meas.remove();
        };
    }, [startMin, endMin]);

    // If time wraps to multiple lines and this is a single lesson with too little height, hide timeframe entirely
    if (
        wrapVertical &&
        singleLesson &&
        typeof availableSpace === 'number' &&
        availableSpace < minHeightWhenWrapped
    ) {
        return null;
    }

    if (wrapVertical) {
        return (
            <div
                ref={ref}
                className={`flex flex-col items-center justify-center leading-tight text-[12px] mt-0.5 ${
                    cancelled ? 'lesson-cancelled-time' : ''
                }`}
                style={{ lineHeight: 1.05 }}
            >
                <span className="whitespace-nowrap">{fmtHM(startMin)}</span>
                <span className="opacity-60 -my-0.5">–</span>
                <span className="whitespace-nowrap">{fmtHM(endMin)}</span>
            </div>
        );
    }
    return (
        <div
            ref={ref}
            className={`opacity-90 sm:mt-0 leading-tight text-[12px] ${
                cancelled ? 'lesson-cancelled-time' : ''
            }`}
        >
            <span className="whitespace-nowrap">
                {fmtHM(startMin)}–{fmtHM(endMin)}
            </span>
        </div>
    );
};
