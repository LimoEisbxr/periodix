import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { DEFAULT_PERIODS } from '../utils/periods';
import { MOBILE_MEDIA_QUERY } from '../utils/responsive';
import { fmtHM, untisToMinutes } from '../utils/dates';

type TimeAxisProps = {
    START_MIN: number;
    END_MIN: number;
    SCALE: number;
    DAY_HEADER_PX: number; // original configured header height
    BOTTOM_PAD_PX: number;
    internalHeaderPx?: number; // actual in-column spacer when sticky external header used (defaults to DAY_HEADER_PX)
};

const TimeAxis: FC<TimeAxisProps> = ({
    START_MIN,
    END_MIN,
    SCALE,
    DAY_HEADER_PX,
    BOTTOM_PAD_PX,
    internalHeaderPx,
}) => {
    const timesHeight = (END_MIN - START_MIN) * SCALE;
    const headerPx = internalHeaderPx ?? DAY_HEADER_PX;

    // Detect mobile using raised breakpoint (<768px) to match DayColumn's padding behavior
    const [isMobile, setIsMobile] = useState<boolean>(false);
    useEffect(() => {
        const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // Use the same padding as DayColumn to ensure alignment
    const PAD_TOP = isMobile ? 2 : 4;

    // Build unique timestamp labels (dedupe touching boundaries) with a minimum vertical gap.
    const timeLabelPositions = (() => {
        const minGapPx = 15;
        // Position calculation matching DayColumn logic
        // For lesson starts: align with lesson block top
        const toStartY = (min: number) =>
            Math.round((min - START_MIN) * SCALE + headerPx) + PAD_TOP;
        // For lesson ends: align with lesson block bottom (accounting for padding and gap budget)
        const PAD_BOTTOM = isMobile ? 2 : 4;
        const GAP_BUDGET = isMobile ? 1 : 2;
        const toEndY = (min: number) =>
            Math.round((min - START_MIN) * SCALE + headerPx) -
            PAD_BOTTOM -
            GAP_BUDGET;
        const maxY =
            Math.round((END_MIN - START_MIN) * SCALE + headerPx) + PAD_TOP;
        type L = { y: number; label: string };
        const labels: L[] = [];
        let prevEnd: number | null = null;
        for (let i = 0; i < DEFAULT_PERIODS.length; i++) {
            const p = DEFAULT_PERIODS[i];
            const s = untisToMinutes(p.start);
            const e = untisToMinutes(p.end);
            if (i === 0 || prevEnd === null || s !== prevEnd) {
                labels.push({ y: toStartY(s), label: fmtHM(s) });
            }

            // Check if this end time is also a start time of the next lesson
            const isEndAlsoStart =
                i < DEFAULT_PERIODS.length - 1 &&
                untisToMinutes(DEFAULT_PERIODS[i + 1].start) === e;

            if (isEndAlsoStart) {
                // Center between start and end positions when end time is also a start time
                const startY = toStartY(e);
                const endY = toEndY(e);
                const centeredY = (startY + endY) / 2;
                labels.push({ y: centeredY, label: fmtHM(e) });
            } else {
                labels.push({ y: toEndY(e), label: fmtHM(e) });
            }
            prevEnd = e;
        }
        labels.sort((a, b) => a.y - b.y);

        const clusters: L[][] = [];
        let current: L[] = [];
        for (const l of labels) {
            if (current.length === 0) current.push({ ...l });
            else {
                const last = current[current.length - 1];
                if (l.y - last.y < minGapPx) current.push({ ...l });
                else {
                    clusters.push(current);
                    current = [{ ...l }];
                }
            }
        }
        if (current.length) clusters.push(current);

        const out: L[] = [];
        for (const c of clusters) {
            if (c.length === 1) {
                out.push(c[0]);
                continue;
            }
            const mean = c.reduce((s, v) => s + v.y, 0) / c.length;
            const span = (c.length - 1) * minGapPx;
            let start = mean - span / 2;
            if (start < 0) start = 0;
            if (start + span > maxY) start = Math.max(0, maxY - span);
            for (let i = 0; i < c.length; i++)
                out.push({ y: start + i * minGapPx, label: c[i].label });
        }
        return out;
    })();

    return (
        <div
            className="relative"
            style={{ height: headerPx + timesHeight + BOTTOM_PAD_PX }}
        >
            <div
                className="absolute left-0 right-0"
                style={{
                    top: 0,
                    height: headerPx + timesHeight + BOTTOM_PAD_PX,
                }}
            >
                <div className="mx-1 h-full rounded-md sm:ring-1 sm:ring-slate-900/10 sm:dark:ring-white/10 sm:border sm:border-slate-300/50 sm:dark:border-slate-600/50 shadow-sm overflow-hidden bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none relative">
                    {timeLabelPositions.map((t, i) => {
                        // Position labels directly without adding headerPx since it's already included in toY calculation
                        return (
                            <div
                                key={i}
                                className="absolute left-0 right-0 -translate-y-1/2 text-[11px] leading-none text-slate-500 dark:text-slate-400 select-none text-center"
                                style={{ top: t.y }}
                            >
                                {t.label}
                            </div>
                        );
                    })}
                    {DEFAULT_PERIODS.map((p) => {
                        const sMin = untisToMinutes(p.start);
                        const eMin = untisToMinutes(p.end);
                        // Calculate center based on actual lesson block positioning (not just time midpoint)
                        const PAD_BOTTOM = isMobile ? 2 : 4;
                        const GAP_BUDGET = isMobile ? 1 : 2;
                        const lessonTop =
                            Math.round((sMin - START_MIN) * SCALE + headerPx) +
                            PAD_TOP;
                        const lessonBottom =
                            Math.round((eMin - START_MIN) * SCALE + headerPx) -
                            PAD_BOTTOM -
                            GAP_BUDGET;
                        const centerY = (lessonTop + lessonBottom) / 2;
                        return (
                            <div
                                key={p.number}
                                className="absolute left-0 right-0"
                            >
                                <div
                                    className="absolute left-0 right-0 -translate-y-1/2 select-none text-slate-400 dark:text-slate-500 text-center"
                                    style={{
                                        top: centerY,
                                        fontSize: 22,
                                        fontWeight: 800,
                                    }}
                                >
                                    {p.number}.
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TimeAxis;
