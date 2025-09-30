import { prisma } from '../../store/prisma.js';
import { getLocalDayRange } from './time.js';
import type {
    AnalyticsDetailMetric,
    AnalyticsDetailsResponse,
    AnalyticsDetailItem,
} from './types.js';

export async function getAnalyticsDetails(
    metric: AnalyticsDetailMetric
): Promise<AnalyticsDetailsResponse> {
    const { start: todayStart, end: todayEnd } = getLocalDayRange(0);

    const joinUsers = async (
        grouped: Array<{
            userId: string;
            _count?: { _all?: number } | null;
            _min?: { createdAt?: Date | null } | null;
            _max?: { createdAt?: Date | null } | null;
        }>
    ): Promise<AnalyticsDetailItem[]> => {
        const ids = grouped.map((g) => g.userId).filter(Boolean);
        if (!ids.length) return [];
        const users = await (prisma as any).user.findMany({
            where: { id: { in: ids } },
            select: { id: true, username: true, displayName: true },
        });
        const map = new Map<
            string,
            { id: string; username: string; displayName: string | null }
        >();
        for (const u of users) map.set(u.id, u);
        const items: AnalyticsDetailItem[] = [];
        for (const g of grouped) {
            const u = map.get(g.userId);
            if (!u) continue;
            const item: AnalyticsDetailItem = {
                userId: u.id,
                username: u.username,
                displayName: u.displayName,
            };
            if (g._count && typeof g._count._all === 'number')
                (item as any).count = g._count._all;
            if (g._min?.createdAt)
                (item as any).firstAt = g._min.createdAt as Date;
            if (g._max?.createdAt)
                (item as any).lastAt = g._max.createdAt as Date;
            items.push(item);
        }
        items.sort(
            (a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0)
        );
        return items;
    };

    switch (metric) {
        case 'logins_today': {
            const grouped = await (prisma as any).userActivity.groupBy({
                by: ['userId'],
                where: {
                    action: 'login',
                    createdAt: { gte: todayStart, lte: todayEnd },
                },
                _count: { _all: true },
                _min: { createdAt: true },
                _max: { createdAt: true },
            });
            return { metric, items: await joinUsers(grouped) };
        }
        case 'active_today': {
            const grouped = await (prisma as any).userActivity.groupBy({
                by: ['userId'],
                where: { createdAt: { gte: todayStart, lte: todayEnd } },
                _count: { _all: true },
                _min: { createdAt: true },
                _max: { createdAt: true },
            });
            return { metric, items: await joinUsers(grouped) };
        }
        case 'timetable_views_today': {
            const grouped = await (prisma as any).userActivity.groupBy({
                by: ['userId'],
                where: {
                    action: 'timetable_view',
                    createdAt: { gte: todayStart, lte: todayEnd },
                },
                _count: { _all: true },
                _min: { createdAt: true },
                _max: { createdAt: true },
            });
            return { metric, items: await joinUsers(grouped) };
        }
        case 'searches_today': {
            const grouped = await (prisma as any).userActivity.groupBy({
                by: ['userId'],
                where: {
                    action: 'search',
                    createdAt: { gte: todayStart, lte: todayEnd },
                },
                _count: { _all: true },
                _min: { createdAt: true },
                _max: { createdAt: true },
            });
            return { metric, items: await joinUsers(grouped) };
        }
        case 'new_users_today': {
            const users = await (prisma as any).user.findMany({
                where: { createdAt: { gte: todayStart, lte: todayEnd } },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            const items: AnalyticsDetailItem[] = users.map((u: any) => ({
                userId: u.id,
                username: u.username,
                displayName: u.displayName,
                firstAt: u.createdAt,
                lastAt: u.createdAt,
            }));
            return { metric, items };
        }
        case 'session_duration_top': {
            // Compute per-user session durations for today based on activity gaps (same logic window as dashboard but per user)
            const ACTIVE_GAP_MS = 5 * 60 * 1000;
            const activities: Array<{ userId: string; createdAt: Date }> =
                await (prisma as any).userActivity.findMany({
                    where: { createdAt: { gte: todayStart, lte: todayEnd } },
                    select: { userId: true, createdAt: true },
                    orderBy: { createdAt: 'asc' },
                });
            const byUser = new Map<string, Date[]>();
            for (const a of activities) {
                if (!byUser.has(a.userId)) byUser.set(a.userId, []);
                byUser.get(a.userId)!.push(new Date(a.createdAt));
            }
            const sessionMetrics: Array<{
                userId: string;
                totalMs: number;
                sessionCount: number;
            }> = [];
            for (const [userId, times] of byUser.entries()) {
                if (times.length < 2) continue;
                let totalMs = 0;
                let sessionCount = 0;
                let sessionStart = times[0];
                for (let i = 1; i < times.length; i++) {
                    const prev = times[i - 1];
                    const curr = times[i];
                    if (!prev || !curr) continue;
                    const gap = curr.getTime() - prev.getTime();
                    if (gap <= ACTIVE_GAP_MS && gap > 0) {
                        totalMs += gap; // accumulate active time within session
                    } else if (gap > ACTIVE_GAP_MS) {
                        // new session starts
                        sessionCount++;
                        sessionStart = curr;
                    }
                }
                if (totalMs > 0) {
                    // finalize last session
                    sessionCount = Math.max(sessionCount, 1);
                    sessionMetrics.push({ userId, totalMs, sessionCount });
                }
            }
            sessionMetrics.sort(
                (a, b) =>
                    b.totalMs / b.sessionCount - a.totalMs / a.sessionCount
            );
            const top = sessionMetrics.slice(0, 25);
            const users = await (prisma as any).user.findMany({
                where: { id: { in: top.map((m) => m.userId) } },
                select: { id: true, username: true, displayName: true },
            });
            const map = new Map<
                string,
                { id: string; username: string; displayName: string | null }
            >();
            for (const u of users) map.set(u.id, u);
            const items: AnalyticsDetailItem[] = top.map((m) => {
                const u = map.get(m.userId)!;
                return {
                    userId: u.id,
                    username: u.username,
                    displayName: u.displayName,
                    avgSessionMinutes:
                        Math.round((m.totalMs / m.sessionCount / 60000) * 10) /
                        10,
                    sessionCount: m.sessionCount,
                } as AnalyticsDetailItem;
            });
            return { metric, items };
        }
        case 'most_active_7_days': {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const allUsers = await (prisma as any).user.findMany({
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    activities: {
                        where: { createdAt: { gte: sevenDaysAgo } },
                        select: { createdAt: true },
                    },
                },
            });
            const items: AnalyticsDetailItem[] = allUsers
                .map((user: any) => ({
                    userId: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    count: user.activities.length,
                    lastAt: user.activities.length
                        ? new Date(
                              Math.max(
                                  ...user.activities.map((a: any) =>
                                      new Date(a.createdAt).getTime()
                                  )
                              )
                          )
                        : undefined,
                }))
                .filter((u: any) => u.count > 0)
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
            return { metric, items };
        }
        case 'most_active_all_time': {
            const allUsers = await (prisma as any).user.findMany({
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    activities: {
                        select: { createdAt: true },
                    },
                },
            });
            const items: AnalyticsDetailItem[] = allUsers
                .map((user: any) => ({
                    userId: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    count: user.activities.length,
                    lastAt: user.activities.length
                        ? new Date(
                              Math.max(
                                  ...user.activities.map((a: any) =>
                                      new Date(a.createdAt).getTime()
                                  )
                              )
                          )
                        : undefined,
                }))
                .filter((u: any) => u.count > 0)
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
            return { metric, items };
        }
        default:
            return { metric, items: [] };
    }
}
