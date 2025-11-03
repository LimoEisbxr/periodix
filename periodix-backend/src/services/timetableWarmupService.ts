import { prisma } from '../store/prisma.js';
import { getOrFetchTimetableRange } from './untisService.js';

const ACTIVE_LOOKBACK_DAYS = 20;
const WARMUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 5;

function startOfISOWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

function endOfISOWeek(date: Date): Date {
    const start = startOfISOWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

function currentIsoWeekRange(): { startIso: string; endIso: string } {
    const now = new Date();
    const start = startOfISOWeek(now);
    const end = endOfISOWeek(now);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

class TimetableWarmupService {
    private static instance: TimetableWarmupService;
    private interval: NodeJS.Timeout | null = null;
    private kickoffTimeout: NodeJS.Timeout | null = null;
    private running = false;

    static getInstance(): TimetableWarmupService {
        if (!TimetableWarmupService.instance) {
            TimetableWarmupService.instance = new TimetableWarmupService();
        }
        return TimetableWarmupService.instance;
    }

    async start(): Promise<void> {
        if (this.interval || this.kickoffTimeout) return;

        // Delay initial run slightly to avoid slowing down startup
        this.kickoffTimeout = setTimeout(() => {
            this.runOnce().catch((err) =>
                console.error('[timetableWarmup] initial run failed', err)
            );
        }, 10_000);

        this.interval = setInterval(() => {
            this.runOnce().catch((err) =>
                console.error('[timetableWarmup] scheduled run failed', err)
            );
        }, WARMUP_INTERVAL_MS);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.kickoffTimeout) {
            clearTimeout(this.kickoffTimeout);
            this.kickoffTimeout = null;
        }
    }

    private async runOnce(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            const cutoff = new Date(
                Date.now() - ACTIVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
            );

            const notificationUsers: Array<{ id: string }> = await (
                prisma as any
            ).user.findMany({
                where: {
                    notificationSettings: {
                        OR: [
                            { pushNotificationsEnabled: true },
                            { timetableChangesEnabled: true },
                        ],
                    },
                },
                select: { id: true },
            });
            const notificationIds = new Set<string>(
                notificationUsers.map((u) => u.id)
            );

            const activeUsers: Array<{ id: string }> = await (
                prisma as any
            ).user.findMany({
                where: {
                    activities: {
                        some: {
                            createdAt: {
                                gte: cutoff,
                            },
                        },
                    },
                    untisSecretCiphertext: { not: null },
                    untisSecretNonce: { not: null },
                },
                select: { id: true },
                take: 500,
            });

            const targetIdSet = new Set<string>();
            for (const user of activeUsers) {
                const id = user.id;
                if (!notificationIds.has(id)) {
                    targetIdSet.add(id);
                }
            }
            const targetIds = Array.from(targetIdSet);

            if (!targetIds.length) {
                return;
            }

            console.log(
                `[timetableWarmup] refreshing cached timetables for ${targetIds.length} users`
            );

            const { startIso, endIso } = currentIsoWeekRange();
            const batches = chunkArray(targetIds, BATCH_SIZE);

            for (const batch of batches) {
                await Promise.allSettled(
                    batch.map(async (userId: string) => {
                        try {
                            await getOrFetchTimetableRange({
                                requesterId: userId,
                                targetUserId: userId,
                                start: startIso,
                                end: endIso,
                            });
                        } catch (err: any) {
                            const message = err?.message || String(err);
                            console.warn('[timetableWarmup] refresh failed', {
                                userId,
                                message,
                            });
                        }
                    })
                );
            }
        } catch (err) {
            console.error('[timetableWarmup] run failed', err);
        } finally {
            this.running = false;
        }
    }
}

export const timetableWarmupService = TimetableWarmupService.getInstance();
