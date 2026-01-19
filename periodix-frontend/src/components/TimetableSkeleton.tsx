import type { FC } from 'react';
import { useEffect, useState, useMemo } from 'react';
import { MOBILE_MEDIA_QUERY, isMobileViewport } from '../utils/responsive';
import TimeAxis from './TimeAxis';

// Mulberry32 seeded PRNG - better distribution than sin-based
function createRandom(seed: number) {
    let t = seed + 0x6d2b79f5;
    return () => {
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Generate a unique seed at module load time (changes on each page reload)
const SKELETON_SEED = Date.now() + Math.floor(Math.random() * 10000);

/**
 * TimetableSkeleton renders a skeleton loading state that matches the
 * actual timetable layout, providing a better UX than a spinner.
 */
const TimetableSkeleton: FC = () => {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;

    const initialMobile =
        typeof window !== 'undefined'
            ? window.matchMedia(MOBILE_MEDIA_QUERY).matches
            : false;
    const MOBILE_DEFAULT_SCALE = 660 / totalMinutes;

    const [SCALE, setSCALE] = useState<number>(
        initialMobile ? MOBILE_DEFAULT_SCALE : 1,
    );
    const [axisWidth, setAxisWidth] = useState<number>(initialMobile ? 44 : 56);
    const [isMobile, setIsMobile] = useState(initialMobile);
    const [BOTTOM_PAD_PX, setBOTTOM_PAD_PX] = useState(initialMobile ? 6 : 14);
    const [DAY_HEADER_PX, setDAY_HEADER_PX] = useState(initialMobile ? 40 : 32);

    useEffect(() => {
        function computeScale() {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
            const mobile = isMobileViewport(vw);
            setIsMobile(mobile);

            if (mobile) {
                const targetHeight = Math.min(
                    880,
                    Math.max(660, Math.floor(vh * 0.9)),
                );
                setSCALE(targetHeight / totalMinutes);
                setAxisWidth(vw < 400 ? 40 : 44);
                setBOTTOM_PAD_PX(6);
                setDAY_HEADER_PX(40);
            } else {
                const targetHeight = Math.max(560, Math.floor(vh * 0.78));
                setSCALE(targetHeight / totalMinutes);
                setAxisWidth(56);
                setBOTTOM_PAD_PX(14);
                setDAY_HEADER_PX(32);
            }
        }
        // Verify dimensions on mount as initialLayout from useMemo might be based on stale/pre-standalone PWA dimensions
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [totalMinutes]);

    const timesHeight = (END_MIN - START_MIN) * SCALE;

    // Generate skeleton lesson blocks with randomized pattern
    const skeletonBlocks = useMemo(() => {
        // Typical lesson periods (start time in minutes from midnight)
        const periods = [
            { start: 7 * 60 + 45, end: 8 * 60 + 30 }, // 1st
            { start: 8 * 60 + 35, end: 9 * 60 + 20 }, // 2nd
            { start: 9 * 60 + 35, end: 10 * 60 + 20 }, // 3rd
            { start: 10 * 60 + 25, end: 11 * 60 + 10 }, // 4th
            { start: 11 * 60 + 25, end: 12 * 60 + 10 }, // 5th
            { start: 12 * 60 + 15, end: 13 * 60 }, // 6th
            { start: 13 * 60 + 45, end: 14 * 60 + 30 }, // 7th
            { start: 14 * 60 + 35, end: 15 * 60 + 20 }, // 8th
        ];

        // Create blocks for 5 days with randomized patterns
        const blocks: {
            day: number;
            startMin: number;
            endMin: number;
            isDouble?: boolean;
            widthPercent: number;
            contentWidthPercent: number;
            animationDelay: number;
        }[] = [];

        for (let day = 0; day < 5; day++) {
            // Create a seeded random generator unique per day and session
            const rand = createRandom(SKELETON_SEED + day * 97 + 13);

            // Decide how many lessons to skip for this day (0-2)
            const skipCount = Math.floor(rand() * 3);
            const skipIndices = new Set<number>();

            // Pick which periods to skip (never skip first period)
            while (skipIndices.size < skipCount) {
                const idx = 1 + Math.floor(rand() * (periods.length - 1));
                skipIndices.add(idx);
            }

            // Decide how many double lessons on this day (0-2, ~70% chance of at least one)
            const numDoubles = rand() < 0.3 ? 0 : rand() < 0.5 ? 1 : 2;
            const doubleStartIndices = new Set<number>();

            // Pick which periods start a double lesson
            let attempts = 0;
            while (doubleStartIndices.size < numDoubles && attempts < 10) {
                const idx = Math.floor(rand() * (periods.length - 1));
                // Don't start double on a skipped period or if next is skipped
                if (!skipIndices.has(idx) && !skipIndices.has(idx + 1)) {
                    // Don't overlap with existing doubles
                    let overlaps = false;
                    for (const existing of doubleStartIndices) {
                        if (Math.abs(idx - existing) <= 1) overlaps = true;
                    }
                    if (!overlaps) doubleStartIndices.add(idx);
                }
                attempts++;
            }

            const mergedIndices = new Set<number>();
            for (const idx of doubleStartIndices) {
                mergedIndices.add(idx + 1);
            }

            for (let i = 0; i < periods.length; i++) {
                // Skip this period if marked for skipping or merged into a double
                if (skipIndices.has(i) || mergedIndices.has(i)) continue;

                // If this is the start of a double lesson
                if (doubleStartIndices.has(i)) {
                    blocks.push({
                        day,
                        startMin: periods[i].start,
                        endMin: periods[i + 1].end,
                        isDouble: true,
                        widthPercent: 88 + rand() * 8,
                        contentWidthPercent: 55 + rand() * 25,
                        animationDelay: rand() * 0.4,
                    });
                    continue;
                }

                blocks.push({
                    day,
                    startMin: periods[i].start,
                    endMin: periods[i].end,
                    widthPercent: 88 + rand() * 8,
                    contentWidthPercent: 50 + rand() * 30,
                    animationDelay: rand() * 0.4,
                });
            }
        }

        return blocks;
    }, []);

    // Day names for header
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    return (
        <div className="relative w-full overflow-x-hidden pt-[env(safe-area-inset-top)]">
            {/* Sticky weekday header skeleton */}
            <div
                className="sticky top-0 z-30 bg-gradient-to-b from-white/85 to-white/60 dark:from-slate-900/85 dark:to-slate-900/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur mb-1"
                style={{
                    paddingRight: 'env(safe-area-inset-right)',
                    paddingLeft: 'env(safe-area-inset-left)',
                }}
            >
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `${axisWidth}px repeat(5, 1fr)`,
                    }}
                >
                    {/* Time column header */}
                    <div className="h-10 flex items-center justify-center">
                        <div className="h-3 w-8 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                    {/* Day headers */}
                    {dayNames.map((day) => (
                        <div
                            key={day}
                            className="h-10 flex flex-col items-center justify-center py-1 gap-1"
                        >
                            <div className="h-3 w-8 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                            <div className="h-2.5 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Main timetable body */}
            <div className="overflow-hidden w-full pr-0.5 sm:pr-0">
                <div className="flex w-full">
                    {/* Time axis skeleton - Use real TimeAxis but wrap in a dimmer container */}
                    <div
                        style={{ width: `${axisWidth}px` }}
                        className="opacity-40 grayscale-[0.5]"
                    >
                        <TimeAxis
                            START_MIN={START_MIN}
                            END_MIN={END_MIN}
                            SCALE={SCALE}
                            DAY_HEADER_PX={DAY_HEADER_PX}
                            BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                            internalHeaderPx={0}
                        />
                    </div>

                    {/* Day columns skeleton */}
                    <div
                        className="flex-1 grid gap-1 sm:gap-3"
                        style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
                    >
                        {Array.from({ length: 5 }, (_, dayIndex) => (
                            <div
                                key={dayIndex}
                                className="relative"
                                style={{ height: timesHeight + BOTTOM_PAD_PX }}
                            >
                                {/* Day column background */}
                                <div className="absolute inset-0 mr-0.5 ml-0.5 sm:mx-0 rounded-md sm:ring-1 sm:ring-slate-900/10 sm:dark:ring-white/10 sm:border sm:border-slate-300/50 sm:dark:border-slate-600/50 shadow-sm overflow-hidden bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />

                                {/* Skeleton lesson blocks */}
                                {skeletonBlocks
                                    .filter((b) => b.day === dayIndex)
                                    .map((block, i) => {
                                        const top =
                                            (block.startMin - START_MIN) *
                                            SCALE;
                                        const height =
                                            (block.endMin - block.startMin) *
                                            SCALE;
                                        const PAD = isMobile ? 2 : 4;
                                        const GAP = isMobile ? 1 : 2;

                                        // Calculate horizontal positioning with randomized width
                                        const widthPct = block.widthPercent;
                                        const leftOffset = (100 - widthPct) / 2;

                                        return (
                                            <div
                                                key={i}
                                                className="absolute rounded-md overflow-hidden"
                                                style={{
                                                    top: top + PAD,
                                                    height: Math.max(
                                                        0,
                                                        height - PAD * 2 - GAP,
                                                    ),
                                                    left: `${leftOffset + 2}%`,
                                                    right: `${leftOffset + 2}%`,
                                                    animationDelay: `${block.animationDelay}s`,
                                                }}
                                            >
                                                {/* Gradient skeleton block */}
                                                <div
                                                    className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse rounded-md"
                                                    style={{
                                                        animationDelay: `${block.animationDelay}s`,
                                                    }}
                                                />

                                                {/* Content skeleton */}
                                                <div className="relative h-full flex flex-col items-center justify-center gap-1 p-1">
                                                    {/* Subject name placeholder */}
                                                    <div
                                                        className="rounded bg-white/40 dark:bg-slate-800/40 animate-pulse"
                                                        style={{
                                                            width: `${block.contentWidthPercent}%`,
                                                            height: block.isDouble
                                                                ? '14px'
                                                                : '12px',
                                                            animationDelay: `${block.animationDelay + 0.1}s`,
                                                        }}
                                                    />
                                                    {/* Room/Teacher placeholder (only for taller blocks) */}
                                                    {height >
                                                        (isMobile
                                                            ? 50
                                                            : 60) && (
                                                        <div
                                                            className="rounded bg-white/30 dark:bg-slate-800/30 animate-pulse"
                                                            style={{
                                                                width: `${block.contentWidthPercent * 0.7}%`,
                                                                height: '10px',
                                                                animationDelay: `${block.animationDelay + 0.2}s`,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimetableSkeleton;
