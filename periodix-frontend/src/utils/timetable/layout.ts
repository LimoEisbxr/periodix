/**
 * Timetable layout calculations and responsive configuration
 */

export interface TimetableLayout {
    SCALE: number;
    axisWidth: number;
    DAY_HEADER_PX: number;
    BOTTOM_PAD_PX: number;
}

/**
 * Calculate responsive timetable layout based on viewport size and total minutes
 */
export function calculateTimetableLayout(
    totalMinutes: number,
    viewportHeight: number = 800,
    viewportWidth: number = 1024
): TimetableLayout {
    // Mobile threshold raised from 640px to 768px for better small-tablet ergonomics
    const isMobile = viewportWidth < 768;

    if (isMobile) {
        // Mobile: keep more compact (1.0–1.15 px/min) to avoid excessive scrolling
        const targetHeight = Math.min(
            880,
            Math.max(660, Math.floor(viewportHeight * 0.9))
        );

        return {
            SCALE: targetHeight / totalMinutes,
            axisWidth: viewportWidth < 400 ? 40 : 44,
            DAY_HEADER_PX: 40, // a little taller, easier tap
            BOTTOM_PAD_PX: 6,
        };
    } else {
        // Desktop: more spacious layout
        const targetHeight = Math.max(560, Math.floor(viewportHeight * 0.78));

        return {
            SCALE: targetHeight / totalMinutes,
            axisWidth: 56,
            DAY_HEADER_PX: 32,
            BOTTOM_PAD_PX: 14,
        };
    }
}

/**
 * Touch gesture constants and utilities
 */
export const TOUCH_CONSTANTS = {
    SWIPE_THRESHOLD: 50, // px - distance needed to commit to navigation (reduced from 80)
    VELOCITY_THRESHOLD: 0.2, // px/ms - speed needed for fast swipe (reduced from 0.3)
    MAX_TOUCH_DURATION: 800, // ms - max time for fast swipe detection (increased from 500)
    HORIZONTAL_LOCK_RATIO: 1.8, // horizontal:vertical ratio to lock horizontal swipe (reduced from 2)
    MOMENTUM_MULTIPLIER: 0.8, // multiplier for momentum-based completion
    MIN_COMPLETION_DISTANCE: 30, // minimum distance to allow momentum completion
} as const;

/**
 * Calculate if a touch gesture should trigger week navigation
 */
export function shouldNavigateWeek(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    startTime: number,
    currentTime: number = Date.now()
): {
    shouldNavigate: boolean;
    direction: 'prev' | 'next' | null;
    momentum: number;
} {
    const deltaX = currentX - startX;
    const deltaY = Math.abs(currentY - startY);
    const deltaTime = currentTime - startTime;
    const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);

    // Check if this is primarily a horizontal gesture
    const isHorizontalGesture =
        Math.abs(deltaX) > deltaY * TOUCH_CONSTANTS.HORIZONTAL_LOCK_RATIO;

    if (!isHorizontalGesture) {
        return { shouldNavigate: false, direction: null, momentum: 0 };
    }

    // Fast swipe detection with momentum
    const isFastSwipe =
        velocity > TOUCH_CONSTANTS.VELOCITY_THRESHOLD &&
        deltaTime < TOUCH_CONSTANTS.MAX_TOUCH_DURATION;

    // Distance-based detection (reduced threshold)
    const isLongSwipe = Math.abs(deltaX) > TOUCH_CONSTANTS.SWIPE_THRESHOLD;

    // Momentum-based completion for smaller gestures
    const hasMomentum =
        Math.abs(deltaX) > TOUCH_CONSTANTS.MIN_COMPLETION_DISTANCE &&
        velocity > TOUCH_CONSTANTS.VELOCITY_THRESHOLD * 0.6;

    if (isFastSwipe || isLongSwipe || hasMomentum) {
        const momentum = velocity * TOUCH_CONSTANTS.MOMENTUM_MULTIPLIER;
        return {
            shouldNavigate: true,
            direction: deltaX > 0 ? 'prev' : 'next',
            momentum: Math.min(momentum, 2.0), // Cap momentum for smoother animations
        };
    }

    return { shouldNavigate: false, direction: null, momentum: 0 };
}

/**
 * Calculate smooth animation easing for week transitions
 */
export function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
}

/**
 * Smoother easing function for momentum-based animations
 */
export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Week navigation animation configuration
 */
export const ANIMATION_CONFIG = {
    DURATION: 300, // ms - smooth animation duration
    EASING: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // CSS easing for smooth transitions
    RUBBER_BAND_RESISTANCE: 0.15, // Reduced resistance for more natural feel
    MAX_DRAG_RATIO: 0.5, // Maximum drag distance as ratio of container width
} as const;

/**
 * Calculate rubber band effect for dragging beyond week boundaries
 */
export function applyRubberBandResistance(
    offset: number,
    containerWidth: number,
    resistance: number = ANIMATION_CONFIG.RUBBER_BAND_RESISTANCE
): number {
    const maxOffset = containerWidth * ANIMATION_CONFIG.MAX_DRAG_RATIO;

    if (Math.abs(offset) <= maxOffset) {
        return offset;
    }

    const sign = offset > 0 ? 1 : -1;
    const excess = Math.abs(offset) - maxOffset;
    // Use exponential decay for more natural feel with reduced resistance
    const resistedExcess =
        maxOffset * (1 - Math.exp(-excess / (containerWidth * resistance)));

    return sign * (maxOffset + resistedExcess);
}

/**
 * Calculate smooth animation progress with momentum consideration
 */
export function calculateAnimationProgress(
    currentDistance: number,
    containerWidth: number,
    momentum: number = 0
): number {
    const baseProgress = Math.abs(currentDistance) / containerWidth;
    const momentumBoost = momentum * 0.1; // Small boost based on momentum
    return Math.min(baseProgress + momentumBoost, 1.0);
}
