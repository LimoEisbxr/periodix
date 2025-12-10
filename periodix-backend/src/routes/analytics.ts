import { Router } from 'express';
import { z } from 'zod';
import {
    adminOrUserManagerOnly,
    authMiddleware,
} from '../server/authMiddleware.js';
// Using modularized analytics service exports
import {
    trackActivity,
    getDashboardStats,
    getUserEngagementMetrics,
    getActivityTrends,
    getAnalyticsDetails,
    getUserInsight,
    type AnalyticsDetailMetric,
    type TrackingData,
} from '../services/analytics/index.js';

const router = Router();

// Track user activity (internal endpoint, could be called from frontend)
const trackActivitySchema = z.object({
    action: z.string().min(1).max(50),
    details: z.record(z.unknown()).optional(),
});

router.post('/track', authMiddleware, async (req, res) => {
    const parsed = trackActivitySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const trackingData: TrackingData = {
            userId,
            action: parsed.data.action,
        };

        if (parsed.data.details) {
            trackingData.details = parsed.data.details;
        }

        const ipAddr = req.ip || req.connection.remoteAddress;
        if (ipAddr) {
            trackingData.ipAddress = ipAddr;
        }

        const userAgent = req.get('User-Agent');
        if (userAgent) {
            trackingData.userAgent = userAgent;
        }

        if ((req as any).sessionID) {
            trackingData.sessionId = (req as any).sessionID;
        }

        await trackActivity(trackingData);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to track activity:', error);
        res.status(500).json({ error: 'Failed to track activity' });
    }
});

// Get dashboard statistics - accessible by admin or user-manager
router.get('/dashboard', adminOrUserManagerOnly, async (_req, res) => {
    try {
        const stats = await getDashboardStats();
        res.json({ stats });
    } catch (error) {
        console.error('Failed to get dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get user engagement metrics - accessible by admin or user-manager
router.get('/engagement', adminOrUserManagerOnly, async (_req, res) => {
    try {
        const metrics = await getUserEngagementMetrics();
        res.json({ metrics });
    } catch (error) {
        console.error('Failed to get engagement metrics:', error);
        res.status(500).json({ error: 'Failed to fetch engagement metrics' });
    }
});

// Get activity trends - accessible by admin or user-manager
router.get('/trends', adminOrUserManagerOnly, async (_req, res) => {
    try {
        const trends = await getActivityTrends();
        res.json({ trends });
    } catch (error) {
        console.error('Failed to get activity trends:', error);
        res.status(500).json({ error: 'Failed to fetch activity trends' });
    }
});

// Get detailed users/events for a metric (e.g., who logged in today)
router.get('/details', adminOrUserManagerOnly, async (req, res) => {
    try {
        const metricParam = String(req.query.metric || '').toLowerCase();
        const allowed: AnalyticsDetailMetric[] = [
            'logins_today',
            'active_today',
            'timetable_views_today',
            'searches_today',
            'new_users_today',
            'session_duration_top',
            'total_users',
            'retention',
        ];
        if (!allowed.includes(metricParam as AnalyticsDetailMetric)) {
            return res.status(400).json({
                error: 'Invalid metric. Allowed: ' + allowed.join(', '),
            });
        }
        const data = await getAnalyticsDetails(
            metricParam as AnalyticsDetailMetric
        );
        res.json({ details: data });
    } catch (error) {
        console.error('Failed to get analytics details:', error);
        res.status(500).json({ error: 'Failed to fetch analytics details' });
    }
});

// Get comprehensive analytics data - accessible by admin or user-manager
router.get('/overview', adminOrUserManagerOnly, async (_req, res) => {
    try {
        const [dashboardStats, engagementMetrics, activityTrends] =
            await Promise.all([
                getDashboardStats(),
                getUserEngagementMetrics(),
                getActivityTrends(),
            ]);

        res.json({
            dashboard: dashboardStats,
            engagement: engagementMetrics,
            trends: activityTrends,
        });
    } catch (error) {
        console.error('Failed to get analytics overview:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
});

// Get per-user insight summary
router.get('/user/:userId', adminOrUserManagerOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }
        const insight = await getUserInsight(userId);
        if (!insight) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ insight });
    } catch (error) {
        console.error('Failed to get user insight:', error);
        res.status(500).json({ error: 'Failed to fetch user insight' });
    }
});

export default router;
