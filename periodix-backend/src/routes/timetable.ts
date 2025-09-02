import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import jwt from 'jsonwebtoken';
import { getOrFetchTimetableRange } from '../services/untisService.js';
import { untisUserLimiter } from '../server/untisRateLimiter.js';
import { prisma } from '../store/prisma.js';

const router = Router();

const rangeSchema = z.object({
    userId: z.string().uuid().optional(),
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

export default router;
