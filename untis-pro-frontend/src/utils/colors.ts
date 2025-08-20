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
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
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
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a gradient from a base color
 * Creates a pleasing left-to-right gradient by adjusting hue, saturation, and lightness
 */
export function generateGradient(baseColor: string): ColorGradient {
    if (!baseColor.match(/^#[0-9A-Fa-f]{6}$/)) {
        // Fallback to default gradient if invalid color
        return {
            from: '#6366f1', // indigo-500
            via: baseColor,
            to: '#10b981', // emerald-500
        };
    }

    const [h, s, l] = hexToHsl(baseColor);
    
    // Create variations by adjusting hue and lightness
    const fromHue = (h - 30 + 360) % 360; // Shift hue left
    const toHue = (h + 30) % 360; // Shift hue right
    
    // Adjust saturation and lightness for better visual appeal
    const adjustedSat = Math.min(90, Math.max(40, s)); // Keep saturation in good range
    const fromLight = Math.min(65, Math.max(35, l - 5)); // Slightly darker
    const toLight = Math.min(70, Math.max(40, l + 5)); // Slightly lighter
    
    return {
        from: hslToHex(fromHue, adjustedSat, fromLight),
        via: baseColor,
        to: hslToHex(toHue, adjustedSat, toLight),
    };
}

/**
 * Convert ColorGradient to Tailwind-compatible class names
 */
export function gradientToTailwindClasses(gradient: ColorGradient): string {
    // Since we can't use arbitrary values directly in Tailwind classes in this context,
    // we'll return a style object instead that can be applied via CSS-in-JS
    return `linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})`;
}

/**
 * Get the default gradient colors used in the app
 */
export function getDefaultGradient(): ColorGradient {
    return {
        from: '#6366f1', // indigo-500
        via: '#0ea5e9', // sky-500
        to: '#10b981', // emerald-500
    };
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