import type { prisma as PrismaType } from '../../store/prisma.js';

export interface TrackingData {
    userId: string;
    action: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}

export interface DashboardStats {
    totalUsers: number;
    activeUsersToday: number;
    newUsersToday: number;
    totalLoginsToday: number;
    timetableViewsToday: number;
    searchQueriesToday: number;
    avgSessionDuration?: number;
    peakHour?: number;
    serverOffsetMinutes?: number; // Date.getTimezoneOffset
}

export interface UserEngagementMetrics {
    mostActiveUsers: Array<{
        userId: string;
        username: string;
        displayName: string | null;
        activityCount: number;
        lastActivity: Date;
    }>;
    mostActiveUsersAllTime: Array<{
        userId: string;
        username: string;
        displayName: string | null;
        activityCount: number;
        lastActivity: Date;
    }>;
    userGrowthTrend: Array<{
        date: string;
        newUsers: number;
        totalUsers: number;
    }>;
    retentionRate: number;
}

export interface ActivityTrends {
    hourlyActivity: Array<{
        hour: number;
        count: number;
        label: string;
    }>;
    dailyActivity: Array<{
        date: string;
        logins: number;
        timetableViews: number;
        searches: number;
    }>;
    featureUsage: Array<{
        feature: string;
        count: number;
        percentage: number;
    }>;
    serverOffsetMinutes?: number;
}

export type AnalyticsDetailMetric =
    | 'logins_today'
    | 'active_today'
    | 'timetable_views_today'
    | 'searches_today'
    | 'new_users_today'
    // Top users by average session duration today (derived)
    | 'session_duration_top'
    // Leaderboards
    | 'most_active_7_days'
    | 'most_active_all_time';

export interface AnalyticsDetailItem {
    userId: string;
    username: string;
    displayName: string | null;
    count?: number;
    firstAt?: Date;
    lastAt?: Date;
    // For session duration metric
    avgSessionMinutes?: number;
    sessionCount?: number;
}

export interface AnalyticsDetailsResponse {
    metric: AnalyticsDetailMetric;
    items: AnalyticsDetailItem[];
}

// Detailed analytics for a single user (for user insight modal)
export interface UserInsightSummary {
    userId: string;
    username: string;
    displayName: string | null;
    totalActivities: number;
    firstActivityAt?: Date;
    lastActivityAt?: Date;
    todayActivityCount: number;
    avgSessionMinutesToday?: number;
    featureUsage: Array<{
        feature: string;
        count: number;
        percentage: number;
    }>;
    recentActivities: Array<{
        action: string;
        createdAt: Date;
    }>;
}

export type { PrismaType };
