import type { Lesson } from '../../types';
import { untisToMinutes } from '../dates';

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Check if a lesson is merged (contains merge separator)
 */
export function isLessonMerged(lesson: Lesson): boolean {
    return (
        (lesson.info?.includes(' | ') ?? false) ||
        (lesson.lstext?.includes(' | ') ?? false)
    );
}

/**
 * Block represents a positioned lesson in the day column
 */
export interface Block {
    l: Lesson;
    startMin: number;
    endMin: number;
    colIndex: number;
    colCount: number;
}

/**
 * Internal type for clustering algorithm
 */
interface ClusterBlock {
    l: Lesson;
    startMin: number;
    endMin: number;
}

/**
 * Convert lessons to time-clamped events for layout calculation
 */
export function lessonsToEvents(
    lessons: Lesson[],
    START_MIN: number,
    END_MIN: number
): ClusterBlock[] {
    return lessons
        .map((l) => {
            const s = clamp(untisToMinutes(l.startTime), START_MIN, END_MIN);
            const e = Math.max(
                s,
                clamp(untisToMinutes(l.endTime), START_MIN, END_MIN)
            );
            return { l, startMin: s, endMin: e };
        })
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

/**
 * Group overlapping events into clusters
 */
export function clusterOverlappingEvents(
    events: ClusterBlock[]
): Array<ClusterBlock[]> {
    const clusters: Array<ClusterBlock[]> = [];
    let current: ClusterBlock[] = [];
    let curMaxEnd = -1;

    for (const ev of events) {
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
    return clusters;
}

/**
 * Arrange events within a cluster into non-overlapping columns
 */
export function arrangeClusterIntoColumns(cluster: ClusterBlock[]): {
    blocks: Block[];
    colCount: number;
} {
    const columns: Array<ClusterBlock[]> = [];
    const placement = new Map<ClusterBlock, number>();

    for (const ev of cluster) {
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
    const blocks: Block[] = cluster.map((ev) => ({
        l: ev.l,
        startMin: ev.startMin,
        endMin: ev.endMin,
        colIndex: placement.get(ev)!,
        colCount,
    }));

    return { blocks, colCount };
}

/**
 * Main layout algorithm: convert lessons to positioned blocks
 */
export function calculateLessonLayout(
    lessons: Lesson[],
    START_MIN: number,
    END_MIN: number
): Block[] {
    // Convert lessons to time-clamped events
    const events = lessonsToEvents(lessons, START_MIN, END_MIN);

    // Group overlapping events into clusters
    const clusters = clusterOverlappingEvents(events);

    // Arrange each cluster into columns and collect all blocks
    const allBlocks: Block[] = [];
    for (const cluster of clusters) {
        const { blocks } = arrangeClusterIntoColumns(cluster);
        allBlocks.push(...blocks);
    }

    return allBlocks;
}

/**
 * Calculate grid slot minutes based on mobile/desktop
 */
export function getGridSlotMinutes(isMobile: boolean): number {
    return isMobile ? 60 : 30;
}

/**
 * Calculate container height for day column
 */
export function calculateContainerHeight(
    START_MIN: number,
    END_MIN: number,
    SCALE: number,
    BOTTOM_PAD_PX: number,
    headerPx: number
): number {
    return (END_MIN - START_MIN) * SCALE + BOTTOM_PAD_PX + headerPx;
}

/**
 * Position calculation utilities for lesson blocks
 */
export interface LessonPosition {
    topPx: number;
    heightPx: number;
    widthPercent: number;
    leftPercent: number;
}

/**
 * Calculate the maximum column count needed for a single day's lessons.
 * This represents the maximum number of overlapping lessons in any time slot.
 */
export function calculateDayMaxColCount(
    lessons: Lesson[],
    START_MIN: number,
    END_MIN: number
): number {
    if (lessons.length === 0) return 1;

    const events = lessonsToEvents(lessons, START_MIN, END_MIN);
    const clusters = clusterOverlappingEvents(events);

    let maxColCount = 1;
    for (const cluster of clusters) {
        const { colCount } = arrangeClusterIntoColumns(cluster);
        maxColCount = Math.max(maxColCount, colCount);
    }

    return maxColCount;
}

/**
 * Calculate the maximum column count across all days in a week.
 * This ensures consistent side-by-side lesson display across all days.
 *
 * @param lessonsByDay - Object mapping day ISO strings to lesson arrays
 * @param START_MIN - Start time in minutes from midnight
 * @param END_MIN - End time in minutes from midnight
 * @returns The maximum number of overlapping lessons in any time slot across all days
 */
export function calculateWeekMaxColCount(
    lessonsByDay: Record<string, Lesson[]>,
    START_MIN: number,
    END_MIN: number
): number {
    let weekMaxColCount = 1;

    for (const dayKey of Object.keys(lessonsByDay)) {
        const dayLessons = lessonsByDay[dayKey];
        const dayMax = calculateDayMaxColCount(dayLessons, START_MIN, END_MIN);
        weekMaxColCount = Math.max(weekMaxColCount, dayMax);
    }

    return weekMaxColCount;
}

/**
 * Calculate position for a lesson block
 */
export function calculateLessonPosition(
    block: Block,
    START_MIN: number,
    SCALE: number,
    isMobile: boolean,
    lastBottomByCol: Record<string, number>
): LessonPosition {
    const topPx = (block.startMin - START_MIN) * SCALE;
    const endPx = (block.endMin - START_MIN) * SCALE;
    const GAP_BUDGET = isMobile ? 1 : 2;

    const MIN_EVENT_HEIGHT = isMobile ? 30 : 14; // slightly larger baseline on mobile for tap comfort
    let heightPx = Math.max(MIN_EVENT_HEIGHT, endPx - topPx - GAP_BUDGET);

    // Enforce per-column cumulative bottom to avoid tiny overlaps from rounding
    const colKey = `${block.colIndex}/${block.colCount}`;
    const lastBottom = lastBottomByCol[colKey] ?? -Infinity;
    const desiredTop = lastBottom + (isMobile ? 1 : 2); // reduced gap on mobile

    let adjustedTopPx = topPx;
    if (topPx < desiredTop) {
        const delta = desiredTop - topPx;
        adjustedTopPx += delta;
        heightPx = Math.max(MIN_EVENT_HEIGHT, heightPx - delta);
    }
    lastBottomByCol[colKey] = adjustedTopPx + heightPx;

    // Calculate width and position within column
    const widthPercent = (1 / block.colCount) * 100;
    const leftPercent = (block.colIndex / block.colCount) * 100;

    return {
        topPx: adjustedTopPx,
        heightPx,
        widthPercent,
        leftPercent,
    };
}
