import type { Lesson } from '../../types';

/**
 * Get lesson status information
 */
export interface LessonStatus {
    cancelled: boolean;
    irregular: boolean;
    merged: boolean;
}

/**
 * Determine lesson status flags
 */
export function getLessonStatus(lesson: Lesson): LessonStatus {
    const cancelled = lesson.code === 'cancelled';
    const irregular = lesson.code === 'irregular';
    const merged =
        (lesson.info?.includes(' | ') ?? false) ||
        (lesson.lstext?.includes(' | ') ?? false);

    return { cancelled, irregular, merged };
}

/**
 * Get lesson display information
 */
export interface LessonDisplayInfo {
    subject: string;
    teacher: string;
    room: string;
    timeRange: string;
    hasHomework: boolean;
    hasExams: boolean;
}

/**
 * Extract display information from lesson
 */
export function getLessonDisplayInfo(lesson: Lesson): LessonDisplayInfo {
    const subject = lesson.su?.[0]?.name || lesson.activityType || '';
    const teacher = lesson.te?.map((t) => t.name).join(', ') || '';
    const room = lesson.ro?.map((r) => r.name).join(', ') || '';

    // Format time range
    const startHour = Math.floor(lesson.startTime / 100);
    const startMin = lesson.startTime % 100;
    const endHour = Math.floor(lesson.endTime / 100);
    const endMin = lesson.endTime % 100;
    const timeRange = `${startHour.toString().padStart(2, '0')}:${startMin
        .toString()
        .padStart(2, '0')}-${endHour.toString().padStart(2, '0')}:${endMin
        .toString()
        .padStart(2, '0')}`;

    const hasHomework = (lesson.homework?.length ?? 0) > 0;
    const hasExams = (lesson.exams?.length ?? 0) > 0;

    return {
        subject,
        teacher,
        room,
        timeRange,
        hasHomework,
        hasExams,
    };
}

/**
 * Get lesson color information
 */
export interface LessonColorInfo {
    backgroundColor: string;
    textColor: string;
    borderColor?: string;
}

/**
 * Generate lesson colors based on subject and settings
 */
export function getLessonColors(
    lesson: Lesson,
    lessonColors: Record<string, string>,
    defaultLessonColors: Record<string, string>,
    gradientOffsets: Record<string, number>
): LessonColorInfo {
    const subject = lesson.su?.[0]?.name || lesson.activityType || '';
    const status = getLessonStatus(lesson);

    // Get base color
    const customColor = lessonColors[subject];
    const defaultColor = defaultLessonColors[subject];
    const baseColor = customColor || defaultColor;

    if (!baseColor) {
        // Fallback to default styling
        return {
            backgroundColor: 'rgb(148, 163, 184)', // slate-400
            textColor: 'white',
        };
    }

    // Apply gradient offset
    const offset = gradientOffsets[subject] ?? 0.5;
    const gradientStyle = `linear-gradient(135deg, ${baseColor} ${(
        offset * 100
    ).toFixed(1)}%, color-mix(in srgb, ${baseColor} 80%, white) 100%)`;

    // Determine text color based on background brightness
    const textColor = isLightColor(baseColor) ? '#1f2937' : 'white'; // gray-800 or white

    // Special styling for cancelled/irregular lessons
    if (status.cancelled || status.irregular) {
        return {
            backgroundColor: gradientStyle,
            textColor,
            borderColor: status.cancelled ? '#ef4444' : '#f59e0b', // red-500 or amber-500
        };
    }

    return {
        backgroundColor: gradientStyle,
        textColor,
    };
}

/**
 * Determine if a color is light (for text color selection)
 */
function isLightColor(color: string): boolean {
    // Remove # if present
    const hex = color.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate brightness using relative luminance formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 128;
}

/**
 * Compact layout configuration
 */
export interface CompactLayoutConfig {
    showSubject: boolean;
    showTeacher: boolean;
    showTime: boolean;
    showRoom: boolean;
    inlineTeacher: boolean; // Show teacher inline with subject
}

/**
 * Determine layout configuration based on lesson height
 */
export function getCompactLayoutConfig(
    heightPx: number,
    isMobile: boolean
): CompactLayoutConfig {
    // Compact layout thresholds
    const VERY_COMPACT_THRESHOLD = isMobile ? 25 : 20;
    const COMPACT_THRESHOLD = isMobile ? 45 : 35;
    const NORMAL_THRESHOLD = isMobile ? 65 : 55;

    if (heightPx < VERY_COMPACT_THRESHOLD) {
        // Ultra compact: only subject
        return {
            showSubject: true,
            showTeacher: false,
            showTime: false,
            showRoom: false,
            inlineTeacher: false,
        };
    } else if (heightPx < COMPACT_THRESHOLD) {
        // Very compact: subject + teacher inline
        return {
            showSubject: true,
            showTeacher: true,
            showTime: false,
            showRoom: false,
            inlineTeacher: true,
        };
    } else if (heightPx < NORMAL_THRESHOLD) {
        // Compact: subject, teacher inline, no time
        return {
            showSubject: true,
            showTeacher: true,
            showTime: false,
            showRoom: true,
            inlineTeacher: true,
        };
    } else {
        // Normal: all information, separate lines
        return {
            showSubject: true,
            showTeacher: true,
            showTime: true,
            showRoom: true,
            inlineTeacher: false,
        };
    }
}

/**
 * Generate CSS classes for lesson block
 */
export function getLessonCssClasses(
    lesson: Lesson,
    heightPx: number,
    isMobile: boolean
): string {
    const status = getLessonStatus(lesson);
    const classes: string[] = [
        'absolute',
        'rounded-2xl',
        'p-2',
        'text-xs',
        'ring-1',
        'ring-slate-900/10',
        'shadow-lg',
        'cursor-pointer',
        'transition-all',
        'duration-200',
        'hover:scale-105',
        'hover:shadow-xl',
        'hover:z-10',
    ];

    // Add status-specific classes
    if (status.cancelled) {
        classes.push('opacity-75', 'lesson-cancelled');
    }

    if (status.irregular) {
        classes.push('lesson-irregular');
    }

    if (status.merged) {
        classes.push('lesson-merged');
    }

    // Add size-specific classes
    const layout = getCompactLayoutConfig(heightPx, isMobile);
    if (layout.inlineTeacher) {
        classes.push('compact-layout');
    }

    return classes.join(' ');
}
