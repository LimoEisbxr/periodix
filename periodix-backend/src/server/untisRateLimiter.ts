import type { NextFunction, Request, Response } from 'express';

// In-memory per-user limiter with configurable windows per bucket.
// Applies to routes that hit WebUntis (timetable fetches, credential verification)

type Stamp = number; // milliseconds since epoch
type Entry = {
    stamps: Stamp[]; // recent allowed request times within 10s window
    lastAllowedAt: Stamp | null;
};

type LimiterConfig = {
    windowMs?: number;
    maxWithinWindow?: number;
    bucket?: string;
};

const DEFAULT_WINDOW_MS = 5_000; // 5 seconds
const DEFAULT_MAX_WITHIN_WINDOW = 10;

const store = new Map<string, Entry>();

function now(): number {
    return Date.now();
}

function getKey(req: Request): string {
    // Prefer authenticated user id, else use username from body for register, else IP
    if (req.user?.id) return `user:${req.user.id}`;
    const maybeUsername =
        typeof req.body?.username === 'string' && req.body.username.trim();
    if (maybeUsername) return `username:${maybeUsername}`;
    return `ip:${req.ip}`;
}

function createLimiter(config: LimiterConfig = {}) {
    const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
    const maxWithinWindow = config.maxWithinWindow ?? DEFAULT_MAX_WITHIN_WINDOW;
    const bucket = config.bucket ?? 'default';

    return function untisLimiter(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        const key = `${bucket}:${getKey(req)}`;
        const t = now();
        let entry = store.get(key);
        if (!entry) {
            entry = { stamps: [], lastAllowedAt: null };
            store.set(key, entry);
        }

        entry.stamps = entry.stamps.filter((s) => t - s <= windowMs);

        if (entry.stamps.length >= maxWithinWindow) {
            const oldest = entry.stamps[0] ?? t;
            const until = windowMs - (t - oldest);
            const retryAfter = Math.max(1, Math.ceil(until / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: 'Too many WebUntis requests. Please try again shortly.',
                retryAfter,
            });
        }

        entry.stamps.push(t);
        entry.lastAllowedAt = t;
        next();
    };
}

export const untisUserLimiter = createLimiter();

export const untisClassLimiter = createLimiter({
    bucket: 'class',
    maxWithinWindow: 20,
});
