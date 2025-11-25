import type { ColorGradient } from '../types';

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number;
    let s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
            default:
                h = 0;
        }
        h /= 6;
    }

    return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a gradient from a base color with a configurable offset (intensity)
 * offset range: 0 = flat (single color) … 1 = max variation.
 * Default offset set to 0.5 per design requirement.
 */
export function generateGradient(
    baseColor: string,
    offset: number = 0.5
): ColorGradient {
    if (!baseColor.match(/^#[0-9A-Fa-f]{6}$/)) {
        return {
            from: '#6366f1',
            via: baseColor,
            to: '#10b981',
        };
    }

    // Clamp offset
    const off = Math.min(1, Math.max(0, offset));

    if (off === 0) {
        return { from: baseColor, via: baseColor, to: baseColor };
    }

    const [h, s, l] = hexToHsl(baseColor);

    // Maximum deltas (previously expanded for "full variation")
    const MAX_HUE_DELTA = 42; // degrees
    const MAX_LIGHT_DELTA = 8; // lightness %
    const MAX_SAT_DELTA = 16; // saturation adjustment range

    const hueDelta = MAX_HUE_DELTA * off;
    const lightDelta = MAX_LIGHT_DELTA * off;
    const satDelta = MAX_SAT_DELTA * off;

    const fromHue = (h - hueDelta + 360) % 360;
    const toHue = (h + hueDelta) % 360;

    // Saturation: move slightly toward a balanced range 40–90 then adjust
    const baseSat = Math.min(90, Math.max(40, s));
    const fromSat = Math.min(95, Math.max(30, baseSat - satDelta / 2));
    const toSat = Math.min(95, Math.max(30, baseSat + satDelta / 2));

    const fromLight = Math.min(75, Math.max(20, l - lightDelta));
    const toLight = Math.min(80, Math.max(25, l + lightDelta));

    return {
        from: hslToHex(fromHue, fromSat, fromLight),
        via: baseColor,
        to: hslToHex(toHue, toSat, toLight),
    };
}

/**
 * Interpolate between two hex colors at a given ratio (0-1)
 */
export function interpolateColor(color1: string, color2: string, ratio: number): string {
    const [h1, s1, l1] = hexToHsl(color1);
    const [h2, s2, l2] = hexToHsl(color2);
    
    // Handle hue interpolation (shortest path around the color wheel)
    let hueDiff = h2 - h1;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    
    const h = (h1 + hueDiff * ratio + 360) % 360;
    const s = s1 + (s2 - s1) * ratio;
    const l = l1 + (l2 - l1) * ratio;
    
    return hslToHex(h, s, l);
}

/**
 * Convert ColorGradient to smooth CSS gradient string with 5 color stops
 */
export function gradientToSmoothCss(gradient: ColorGradient, angle: number = 135): string {
    // Create intermediate colors for smoother gradient
    const midFromVia = interpolateColor(gradient.from, gradient.via, 0.5);
    const midViaTo = interpolateColor(gradient.via, gradient.to, 0.5);
    
    // 5-stop gradient for smoother transitions
    return `linear-gradient(${angle}deg, ${gradient.from} 0%, ${midFromVia} 25%, ${gradient.via} 50%, ${midViaTo} 75%, ${gradient.to} 100%)`;
}

/**
 * Convert ColorGradient to Tailwind-compatible class names with smooth interpolation
 * Uses 5 color stops for smoother transitions
 */
export function gradientToTailwindClasses(gradient: ColorGradient): string {
    return gradientToSmoothCss(gradient, 135);
}

/**
 * Get the default gradient colors used in the app
 */
export function getDefaultGradient(): ColorGradient {
    // Use the same generator so style evolution stays consistent; fallback trio kept stable.
    return generateGradient('#6366f1', 0.5);
}

/**
 * Validate if a color is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Generate a good contrast text color (black or white) for a given background color
 */
export function getContrastTextColor(backgroundColor: string): string {
    if (!isValidHexColor(backgroundColor)) {
        return '#ffffff'; // default to white
    }

    const [, , l] = hexToHsl(backgroundColor);
    return l > 50 ? '#000000' : '#ffffff';
}
