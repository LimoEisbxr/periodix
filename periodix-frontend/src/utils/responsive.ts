// Centralized responsive breakpoints for JS logic (not Tailwind utility classes).
// We extend the "mobile" experience up to <768px (Tailwind's md breakpoint start)
// so timetable & modal layouts switch earlier to the compact/mobile design.
// NOTE: Tailwind's configured breakpoints (sm=640px) remain unchanged; this only
// affects our JS layout calculations and any manual CSS media queries updated separately.

export const MOBILE_MAX_WIDTH = 850; // inclusive max width considered mobile
export const MOBILE_WIDTH_THRESHOLD = MOBILE_MAX_WIDTH + 1; // 768 convenience for `<` comparisons
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

export function isMobileViewport(vw: number | undefined): boolean {
    return typeof vw === 'number' && vw < MOBILE_WIDTH_THRESHOLD; // <768
}
