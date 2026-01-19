import { useCallback, useEffect, useRef } from 'react';
import { api } from '../api';
import { addDays, fmtLocal } from '../utils/dates';
import type { TimetableResponse } from '../types';

// Cache configuration
const CURRENT_PAGE_TTL_MS = 1 * 60 * 1000; // 1 minute for current page
const ADJACENT_PAGE_TTL_MS = 2 * 60 * 1000; // 2 minutes for adjacent pages
const OTHER_PAGE_TTL_MS = 2 * 60 * 1000; // 2 minutes for other pages (then forget)
const MAX_CACHE_SIZE = 50; // Maximum number of cached entries

// Cache entry type
interface CacheEntry {
    data: TimetableResponse;
    timestamp: number;
    key: string;
    pageType: 'current' | 'adjacent' | 'other';
}

// Cache key generation
function generateCacheKey(
    userId: string,
    weekStartStr: string,
    weekEndStr: string,
): string {
    return `${userId}:${weekStartStr}:${weekEndStr}`;
}

// Global cache storage (persists across component re-renders)
const cache = new Map<string, CacheEntry>();

// Track current page for different TTL rules
let currentPageKey: string | null = null;

// Auto-refresh timer for current page
let currentPageRefreshTimer: number | null = null;

// Background prefetch queue to avoid duplicate requests
const prefetchQueue = new Set<string>();

// Cache utility functions
function getPageType(key: string): 'current' | 'adjacent' | 'other' {
    if (key === currentPageKey) return 'current';

    if (currentPageKey) {
        // Check if this is adjacent to current page
        const adjacentKeys = getAdjacentKeys(currentPageKey);
        if (adjacentKeys.includes(key)) return 'adjacent';
    }

    return 'other';
}

function getAdjacentKeys(currentKey: string): string[] {
    // Parse current key to get userId and dates
    const parts = currentKey.split(':');
    if (parts.length !== 3) return [];

    const [userId, weekStartStr] = parts;
    try {
        const weekStartDate = new Date(weekStartStr);

        // Calculate previous and next week keys
        const prevWeekDates = getPreviousWeekDates(weekStartDate);
        const nextWeekDates = getNextWeekDates(weekStartDate);

        const prevKey = generateCacheKey(
            userId,
            prevWeekDates.weekStartStr,
            prevWeekDates.weekEndStr,
        );
        const nextKey = generateCacheKey(
            userId,
            nextWeekDates.weekStartStr,
            nextWeekDates.weekEndStr,
        );

        return [prevKey, nextKey];
    } catch {
        return [];
    }
}

function isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const age = now - entry.timestamp;

    switch (entry.pageType) {
        case 'current':
            return age > CURRENT_PAGE_TTL_MS;
        case 'adjacent':
            return age > ADJACENT_PAGE_TTL_MS;
        case 'other':
            return age > OTHER_PAGE_TTL_MS;
        default:
            return age > OTHER_PAGE_TTL_MS;
    }
}

function pruneCache(): void {
    // Update page types for all entries
    for (const [key, entry] of cache.entries()) {
        entry.pageType = getPageType(key);
    }

    // Handle expired entries based on their type
    for (const [key, entry] of cache.entries()) {
        if (isExpired(entry)) {
            if (entry.pageType === 'other') {
                // Forget other pages that are expired
                cache.delete(key);
            }
            // Adjacent and current pages keep their entries but will be refreshed on next access
        }
    }

    // If still too large, remove oldest non-current, non-adjacent entries first
    if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries()).sort((a, b) => {
            // Prioritize current and adjacent pages
            const aScore =
                a[1].pageType === 'current'
                    ? 3
                    : a[1].pageType === 'adjacent'
                      ? 2
                      : 1;
            const bScore =
                b[1].pageType === 'current'
                    ? 3
                    : b[1].pageType === 'adjacent'
                      ? 2
                      : 1;

            if (aScore !== bScore) return aScore - bScore;
            return a[1].timestamp - b[1].timestamp;
        });

        const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
        for (const [key] of toRemove) {
            cache.delete(key);
        }
    }
}

function getCachedData(key: string): TimetableResponse | null {
    const entry = cache.get(key);
    if (!entry) return null;

    // Update page type
    entry.pageType = getPageType(key);

    if (isExpired(entry)) {
        if (entry.pageType === 'other') {
            // Forget expired other pages
            cache.delete(key);
            return null;
        }
        // Adjacent and current pages need refresh but return stale data if available
        // The refresh will happen in the background
        return entry.data;
    }

    return entry.data;
}

function setCachedData(key: string, data: TimetableResponse): void {
    const pageType = getPageType(key);
    cache.set(key, {
        data,
        timestamp: Date.now(),
        key,
        pageType,
    });
    pruneCache();
}

function setCurrentPage(key: string): void {
    // Clear existing refresh timer
    if (currentPageRefreshTimer) {
        clearTimeout(currentPageRefreshTimer);
        currentPageRefreshTimer = null;
    }

    currentPageKey = key;

    // Update page types for all entries
    for (const [cacheKey, entry] of cache.entries()) {
        entry.pageType = getPageType(cacheKey);
    }

    // Set up auto-refresh for current page
    scheduleCurrentPageRefresh();
}

function scheduleCurrentPageRefresh(): void {
    if (!currentPageKey) return;

    currentPageRefreshTimer = setTimeout(async () => {
        if (!currentPageKey) return;

        const entry = cache.get(currentPageKey);
        if (entry && entry.pageType === 'current') {
            // Trigger background refresh
            console.debug('Auto-refreshing current page:', currentPageKey);
            triggerBackgroundRefresh(currentPageKey);
        }

        // Schedule next refresh
        scheduleCurrentPageRefresh();
    }, CURRENT_PAGE_TTL_MS) as unknown as number;
}

// Store refresh callback for background refresh
let backgroundRefreshCallback: ((key: string) => Promise<void>) | null = null;

function setBackgroundRefreshCallback(
    callback: (key: string) => Promise<void>,
): void {
    backgroundRefreshCallback = callback;
}

async function triggerBackgroundRefresh(key: string): Promise<void> {
    if (backgroundRefreshCallback) {
        try {
            await backgroundRefreshCallback(key);
        } catch (error) {
            console.debug('Background refresh failed for', key, error);
        }
    }
}

// Week calculation utilities
function getWeekDates(weekStartDate: Date): {
    weekStartStr: string;
    weekEndStr: string;
} {
    const weekStartStr = fmtLocal(weekStartDate);
    const weekEndStr = fmtLocal(addDays(weekStartDate, 6));
    return { weekStartStr, weekEndStr };
}

function getPreviousWeekDates(weekStartDate: Date): {
    weekStartStr: string;
    weekEndStr: string;
} {
    const prevWeekStart = addDays(weekStartDate, -7);
    return getWeekDates(prevWeekStart);
}

function getNextWeekDates(weekStartDate: Date): {
    weekStartStr: string;
    weekEndStr: string;
} {
    const nextWeekStart = addDays(weekStartDate, 7);
    return getWeekDates(nextWeekStart);
}

export interface TimetableResult {
    data: TimetableResponse;
    fromCache: boolean;
}

export function useTimetableCache() {
    // Keep track of which fetches are in progress to avoid duplicates
    const inFlightRequests = useRef(new Set<string>());

    const fetchTimetable = useCallback(
        async (
            url: string,
            token: string,
            cacheKey: string,
        ): Promise<TimetableResponse> => {
            // Check if already in flight
            if (inFlightRequests.current.has(cacheKey)) {
                // Wait a bit and try to get from cache
                await new Promise((resolve) => setTimeout(resolve, 100));
                const cached = getCachedData(cacheKey);
                if (cached) return cached;
            }

            inFlightRequests.current.add(cacheKey);

            try {
                const data = await api<TimetableResponse>(url, { token });
                setCachedData(cacheKey, data);
                return data;
            } finally {
                inFlightRequests.current.delete(cacheKey);
            }
        },
        [],
    );

    // Background refresh function for expired adjacent and current pages
    const backgroundRefresh = useCallback(
        async (cacheKey: string): Promise<void> => {
            const entry = cache.get(cacheKey);
            if (!entry) return;

            // Skip if not expired or if it's an "other" page type
            if (!isExpired(entry) || entry.pageType === 'other') return;

            // Skip if already being refreshed
            if (
                inFlightRequests.current.has(cacheKey) ||
                prefetchQueue.has(cacheKey)
            )
                return;

            prefetchQueue.add(cacheKey);

            try {
                // Parse cache key to reconstruct URL
                const parts = cacheKey.split(':');
                if (parts.length !== 3) return;

                const [userId, weekStartStr, weekEndStr] = parts;

                // For now, we'll just mark it for refresh and let the normal flow handle it
                // A more complete implementation would need access to the current token
                console.debug(
                    'Background refresh needed for:',
                    cacheKey,
                    `user:${userId} week:${weekStartStr}-${weekEndStr}`,
                );
            } catch (error) {
                console.debug('Background refresh failed for', cacheKey, error);
            } finally {
                prefetchQueue.delete(cacheKey);
            }
        },
        [],
    );

    // Set up background refresh callback
    useEffect(() => {
        setBackgroundRefreshCallback(backgroundRefresh);
        return () => {
            setBackgroundRefreshCallback(() => Promise.resolve());
        };
    }, [backgroundRefresh]);

    const prefetchAdjacentWeeks = useCallback(
        async (
            _userId: string,
            targetUserId: string,
            weekStartDate: Date,
            token: string,
            isOwn: boolean = true,
            forceRefresh: boolean = false
        ): Promise<void> => {
            const adjacentWeeks = [
                getPreviousWeekDates(weekStartDate),
                getNextWeekDates(weekStartDate),
            ];

            for (const { weekStartStr, weekEndStr } of adjacentWeeks) {
                const cacheKey = generateCacheKey(
                    targetUserId,
                    weekStartStr,
                    weekEndStr,
                );

                // Check if needs refresh (expired adjacent page)
                const entry = cache.get(cacheKey);
                const needsRefresh =
                    forceRefresh || (entry && entry.pageType === 'adjacent' && isExpired(entry));

                // Skip if already cached and not needing refresh, or being prefetched
                if (
                    !forceRefresh && ((getCachedData(cacheKey) && !needsRefresh) ||
                    prefetchQueue.has(cacheKey))
                ) {
                    continue;
                }

                prefetchQueue.add(cacheKey);

                // Prefetch in background without blocking
                setTimeout(async () => {
                    try {
                        const url = isOwn
                            ? `/api/timetable/me?start=${weekStartStr}&end=${weekEndStr}`
                            : `/api/timetable/user/${targetUserId}?start=${weekStartStr}&end=${weekEndStr}`;

                        await fetchTimetable(url, token, cacheKey);

                        // Update page type after fetching
                        const fetchedEntry = cache.get(cacheKey);
                        if (fetchedEntry) {
                            fetchedEntry.pageType = getPageType(cacheKey);
                        }
                    } catch (error) {
                        // Ignore prefetch errors
                        console.debug('Prefetch failed for', cacheKey, error);
                    } finally {
                        prefetchQueue.delete(cacheKey);
                    }
                }, 100); // Small delay to avoid blocking current request
            }
        },
        [fetchTimetable],
    );

    const getTimetableData = useCallback(
        async (
            userId: string,
            targetUserId: string,
            weekStartDate: Date,
            token: string,
            isOwn: boolean = true,
            forceRefresh: boolean = false
        ): Promise<TimetableResult> => {
            const { weekStartStr, weekEndStr } = getWeekDates(weekStartDate);
            const cacheKey = generateCacheKey(
                targetUserId,
                weekStartStr,
                weekEndStr,
            );

            // Set this as the current page
            setCurrentPage(cacheKey);

            // Try cache first
            const cached = getCachedData(cacheKey);
            const entry = cache.get(cacheKey);

            if (!forceRefresh && cached && entry && !isExpired(entry)) {
                // Start background prefetch for adjacent weeks
                prefetchAdjacentWeeks(
                    userId,
                    targetUserId,
                    weekStartDate,
                    token,
                    isOwn,
                );
                return { data: cached, fromCache: true };
            }

            // If we have stale data for current or adjacent pages, return it while fetching fresh data
            if (
                !forceRefresh &&
                cached &&
                entry &&
                (entry.pageType === 'current' || entry.pageType === 'adjacent')
            ) {
                // Start background refresh and prefetch
                setTimeout(() => {
                    fetchTimetable(
                        isOwn
                            ? `/api/timetable/me?start=${weekStartStr}&end=${weekEndStr}`
                            : `/api/timetable/user/${targetUserId}?start=${weekStartStr}&end=${weekEndStr}`,
                        token,
                        cacheKey,
                    )
                        .then(() => {
                            prefetchAdjacentWeeks(
                                userId,
                                targetUserId,
                                weekStartDate,
                                token,
                                isOwn,
                            );
                        })
                        .catch((error) => {
                            console.debug('Background refresh failed:', error);
                        });
                }, 0);

                return { data: cached, fromCache: true };
            }

            // Fetch fresh data
            const url = isOwn
                ? `/api/timetable/me?start=${weekStartStr}&end=${weekEndStr}`
                : `/api/timetable/user/${targetUserId}?start=${weekStartStr}&end=${weekEndStr}`;

            const data = await fetchTimetable(url, token, cacheKey);

            // Start background prefetch for adjacent weeks
            prefetchAdjacentWeeks(
                userId,
                targetUserId,
                weekStartDate,
                token,
                isOwn,
                forceRefresh,
            );

            return { data, fromCache: false };
        },
        [fetchTimetable, prefetchAdjacentWeeks],
    );

    const invalidateCache = useCallback((userId?: string): void => {
        // Clear refresh timer
        if (currentPageRefreshTimer) {
            clearTimeout(currentPageRefreshTimer);
            currentPageRefreshTimer = null;
        }

        if (userId) {
            // Invalidate only for specific user
            for (const [key] of cache.entries()) {
                if (key.startsWith(`${userId}:`)) {
                    cache.delete(key);
                }
            }
        } else {
            // Clear entire cache
            cache.clear();
            currentPageKey = null;
        }
        prefetchQueue.clear();
        inFlightRequests.current.clear();
    }, []);

    const getCacheStats = useCallback(() => {
        const stats = {
            size: cache.size,
            inFlight: inFlightRequests.current.size,
            prefetchQueue: prefetchQueue.size,
            entries: Array.from(cache.keys()),
            currentPage: currentPageKey,
            entriesByType: {
                current: 0,
                adjacent: 0,
                other: 0,
            } as Record<string, number>,
        };

        // Count entries by type
        for (const entry of cache.values()) {
            stats.entriesByType[entry.pageType]++;
        }

        return stats;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (currentPageRefreshTimer) {
                clearTimeout(currentPageRefreshTimer);
            }
        };
    }, []);

    return {
        getTimetableData,
        invalidateCache,
        getCacheStats,
        getCachedData: (
            userId: string,
            weekStartStr: string,
            weekEndStr: string,
        ) => {
            const cacheKey = generateCacheKey(userId, weekStartStr, weekEndStr);
            return getCachedData(cacheKey);
        },
    };
}
