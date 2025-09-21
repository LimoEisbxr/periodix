import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { getOrFetchTimetableRange, getClassTimetableRange, getUserAvailableClasses } from '../services/untisService.js';
import { untisUserLimiter } from '../server/untisRateLimiter.js';
import { prisma } from '../store/prisma.js';

const router = Router();

const rangeSchema = z.object({
    userId: z.string().uuid().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
});

const classSchema = z.object({
    className: z.string().trim().min(1).max(50),
    start: z.string().optional(),
    end: z.string().optional(),
});

router.get('/me', authMiddleware, untisUserLimiter, async (req, res) => {
    try {
        const start = req.query.start as string | undefined;
        const end = req.query.end as string | undefined;
        const data = await getOrFetchTimetableRange({
            requesterId: req.user!.id,
            targetUserId: req.user!.id,
            start,
            end,
        });
        res.json(data);
    } catch (e: any) {
        const status = e?.status || 500;
        console.error('[timetable/me] error', {
            status,
            message: e?.message,
            code: e?.code,
        });
        res.status(status).json({
            error: e?.message || 'Failed',
            code: e?.code,
        });
    }
});

router.get(
    '/user/:userId',
    authMiddleware,
    untisUserLimiter,
    async (req, res) => {
        const params = rangeSchema.safeParse({
            ...req.query,
            userId: req.params.userId,
        });
        if (!params.success)
            return res.status(400).json({ error: params.error.flatten() });
        try {
            const { userId, start, end } = params.data;
            const requesterId = req.user!.id;
            
            // Check if user is admin
            const auth = req.headers.authorization || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            let isAdmin = false;
            try {
                const decoded: any = jwt.verify(
                    token,
                    process.env.JWT_SECRET || 'dev-secret'
                );
                isAdmin = Boolean(decoded?.isAdmin);
            } catch {}
            
            // Admins can view any user's timetable
            if (isAdmin) {
                const data = await getOrFetchTimetableRange({
                    requesterId: userId!,
                    targetUserId: userId!,
                    start,
                    end,
                });
                return res.json(data);
            }
            
            // Check if requesting own timetable
            if (requesterId === userId) {
                const data = await getOrFetchTimetableRange({
                    requesterId,
                    targetUserId: userId!,
                    start,
                    end,
                });
                return res.json(data);
            }
            
            // Check global sharing setting
            const appSettings = await (prisma as any).appSettings.findFirst();
            if (appSettings && !appSettings.globalSharingEnabled) {
                return res.status(403).json({ 
                    error: 'Timetable sharing is currently disabled' 
                });
            }
            
            // Check if target user has sharing enabled and is sharing with requester
            const targetUser = await (prisma as any).user.findUnique({
                where: { id: userId },
                select: { sharingEnabled: true },
            });
            
            if (!targetUser || !targetUser.sharingEnabled) {
                return res.status(403).json({ 
                    error: 'User is not sharing their timetable' 
                });
            }
            
            // Check if there's a sharing relationship
            const shareRelationship = await (prisma as any).timetableShare.findUnique({
                where: {
                    ownerId_sharedWithId: {
                        ownerId: userId!,
                        sharedWithId: requesterId,
                    },
                },
            });
            
            if (!shareRelationship) {
                return res.status(403).json({ 
                    error: 'You do not have permission to view this timetable' 
                });
            }
            
            const data = await getOrFetchTimetableRange({
                requesterId,
                targetUserId: userId!,
                start,
                end,
            });
            res.json(data);
        } catch (e: any) {
            const status = e?.status || 500;
            console.error('[timetable/user] error', {
                status,
                message: e?.message,
                code: e?.code,
            });
            res.status(status).json({
                error: e?.message || 'Failed',
                code: e?.code,
            });
        }
    }
);

router.get(
    '/class/:className',
    authMiddleware,
    untisUserLimiter,
    async (req, res) => {
        const params = classSchema.safeParse({
            ...req.query,
            className: req.params.className,
        });
        if (!params.success)
            return res.status(400).json({ error: params.error.flatten() });
        
        try {
            const { className, start, end } = params.data;
            const requesterId = req.user!.id;
            
            // All authenticated users can view class timetables
            // This is public information for students in that class
            const data = await getClassTimetableRange({
                requesterId,
                className,
                start,
                end,
            });
            res.json(data);
        } catch (e: any) {
            const status = e?.status || 500;
            console.error('[timetable/class] error', {
                status,
                message: e?.message,
                code: e?.code,
                className: req.params.className,
            });
            res.status(status).json({
                error: e?.message || 'Failed to fetch class timetable',
                code: e?.code,
            });
        }
    }
);

router.get('/classes', authMiddleware, untisUserLimiter, async (req, res) => {
    try {
        const requesterId = req.user!.id;
        const classes = await getUserAvailableClasses({ requesterId });
        res.json({ classes });
    } catch (e: any) {
        const status = e?.status || 500;
        console.error('[timetable/classes] error', {
            status,
            message: e?.message,
            code: e?.code,
        });
        res.status(status).json({
            error: e?.message || 'Failed to fetch classes',
            code: e?.code,
        });
    }
});

export default router;
