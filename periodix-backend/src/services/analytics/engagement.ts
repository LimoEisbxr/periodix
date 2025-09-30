import { prisma } from '../../store/prisma.js';
import { getLocalDayRange } from './time.js';
import type { UserEngagementMetrics } from './types.js';

export async function getUserEngagementMetrics(): Promise<UserEngagementMetrics> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const mostActiveUsers = await (prisma as any).user.findMany({
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
    const processedActiveUsers = mostActiveUsers
        .map((user: any) => ({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            activityCount: user.activities.length,
            lastActivity: user.activities.length
                ? new Date(
                      Math.max(
                          ...user.activities.map((a: any) =>
                              new Date(a.createdAt).getTime()
                          )
                      )
                  )
                : new Date(0),
        }))
        .filter((u: any) => u.activityCount > 0)
        .sort((a: any, b: any) => b.activityCount - a.activityCount)
        .slice(0, 10);

    const mostActiveUsersAllTime = await (prisma as any).user.findMany({
        select: {
            id: true,
            username: true,
            displayName: true,
            activities: {
                select: { createdAt: true },
            },
        },
    });
    const processedActiveUsersAllTime = mostActiveUsersAllTime
        .map((user: any) => ({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            activityCount: user.activities.length,
            lastActivity: user.activities.length
                ? new Date(
                      Math.max(
                          ...user.activities.map((a: any) =>
                              new Date(a.createdAt).getTime()
                          )
                      )
                  )
                : new Date(0),
        }))
        .filter((u: any) => u.activityCount > 0)
        .sort((a: any, b: any) => b.activityCount - a.activityCount)
        .slice(0, 10);

    const dailyUserStats = await (prisma as any).dailyStats.findMany({
        where: { date: { gte: getLocalDayRange(-30).dateKey } },
        orderBy: { date: 'asc' },
        select: { date: true, newUsers: true, totalUsers: true },
    });
    const userGrowthTrend = dailyUserStats.map((stat: any) => ({
        date: stat.date,
        newUsers: stat.newUsers,
        totalUsers: stat.totalUsers,
    }));

    const retentionRate = await calculateRetentionRate();

    return {
        mostActiveUsers: processedActiveUsers,
        mostActiveUsersAllTime: processedActiveUsersAllTime,
        userGrowthTrend,
        retentionRate,
    };
}

async function calculateRetentionRate(): Promise<number> {
    const { start: todayStart, end: todayEnd } = getLocalDayRange(0);
    const { start: sevenDaysAgoStart, end: sevenDaysAgoEnd } =
        getLocalDayRange(-7);

    const distinctActiveUsers = async (
        start: Date,
        end: Date
    ): Promise<string[]> => {
        const rows = await (prisma as any).userActivity.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: start, lte: end } },
            _count: { _all: true },
        });
        return rows.map((r: any) => r.userId);
    };

    try {
        let baseUserIds = await distinctActiveUsers(
            sevenDaysAgoStart,
            sevenDaysAgoEnd
        );
        if (!baseUserIds.length) {
            const { start: minus8Start } = getLocalDayRange(-8);
            const { end: minus6End } = getLocalDayRange(-6);
            baseUserIds = await distinctActiveUsers(minus8Start, minus6End);
        }
        if (!baseUserIds.length) return 0;

        const todayUserIds = await distinctActiveUsers(todayStart, todayEnd);
        if (!todayUserIds.length) return 0;

        const todaySet = new Set(todayUserIds);
        const retained = baseUserIds.reduce(
            (acc, id) => (todaySet.has(id) ? acc + 1 : acc),
            0
        );
        return Math.round((retained / baseUserIds.length) * 100);
    } catch (error) {
        console.error('Failed to calculate retention rate:', error);
        return 0;
    }
}
