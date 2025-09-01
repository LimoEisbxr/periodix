import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import { prisma } from '../store/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

const querySchema = z.object({ q: z.string().trim().min(1).max(100) });
const updateMeSchema = z.object({
    displayName: z.string().trim().max(100).nullable(),
});
const updateColorPreferenceSchema = z.object({
    ignoreAdminColors: z.boolean(),
});

// Authenticated user search (by username/displayName)
// NOTE: Consider adding rate limiting in front of this route in production.
router.get('/search', authMiddleware, async (req, res) => {
    const parsed = querySchema.safeParse({ q: req.query.q ?? '' });
    if (!parsed.success) return res.json({ users: [] });
    const q = parsed.data.q;
    const requesterId = req.user!.id;

    try {
        // Check if user is admin
        let isAdmin = false;
        try {
            const auth = req.headers.authorization || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            const decoded: any = jwt.verify(
                token,
                process.env.JWT_SECRET || 'dev-secret'
            );
            isAdmin = Boolean(decoded?.isAdmin);
        } catch {}

        // Admins can search all users
        if (isAdmin) {
            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        { username: { contains: q, mode: 'insensitive' } },
                        { displayName: { contains: q, mode: 'insensitive' } },
                    ],
                },
                select: { id: true, username: true, displayName: true },
                orderBy: [{ username: 'asc' }],
                take: 20,
            });
            return res.json({ users });
        }

        // Check global sharing setting
        const appSettings = await (prisma as any).appSettings.findFirst();
        if (appSettings && !appSettings.globalSharingEnabled) {
            return res.json({ users: [] });
        }

        // Regular users: only return users who are sharing their timetable with the requester
        // First, find all users matching the search query who have sharing enabled
        const usersWithSharing = await (prisma as any).user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { username: { contains: q, mode: 'insensitive' } },
                            {
                                displayName: {
                                    contains: q,
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    },
                    { sharingEnabled: true },
                    { id: { not: requesterId } }, // Exclude self
                ],
            },
            select: { id: true, username: true, displayName: true },
            orderBy: [{ username: 'asc' }],
            take: 20,
        });

        // Filter to only include users who are sharing with the requester
        const userIds = usersWithSharing.map((u: any) => u.id);
        if (userIds.length === 0) {
            return res.json({ users: [] });
        }

        const sharedWith = await (prisma as any).timetableShare.findMany({
            where: {
                ownerId: { in: userIds },
                sharedWithId: requesterId,
            },
            select: { ownerId: true },
        });

        const sharedUserIds = new Set(sharedWith.map((s: any) => s.ownerId));
        const filteredUsers = usersWithSharing.filter((u: any) =>
            sharedUserIds.has(u.id)
        );

        res.json({ users: filteredUsers });
    } catch (e: any) {
        const msg = e?.message || 'Search failed';
        res.status(500).json({ error: msg });
    }
});

// Search users to share with (for settings page)
router.get('/search-to-share', authMiddleware, async (req, res) => {
    const parsed = querySchema.safeParse({ q: req.query.q ?? '' });
    if (!parsed.success) return res.json({ users: [] });
    const q = parsed.data.q;
    const requesterId = req.user!.id;

    try {
        // Check global sharing setting
        const appSettings = await (prisma as any).appSettings.findFirst();
        if (appSettings && !appSettings.globalSharingEnabled) {
            return res.json({ users: [] });
        }

        // Find all users matching the search query, excluding self
        const users = await prisma.user.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { username: { contains: q, mode: 'insensitive' } },
                            {
                                displayName: {
                                    contains: q,
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    },
                    { id: { not: requesterId } }, // Exclude self
                ],
            },
            select: { id: true, username: true, displayName: true },
            orderBy: [{ username: 'asc' }],
            take: 20,
        });

        res.json({ users });
    } catch (e: any) {
        const msg = e?.message || 'Search failed';
        res.status(500).json({ error: msg });
    }
});

// Update current user's display name
router.patch('/me', authMiddleware, async (req, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.user!.id;
        const user = await prisma.user.update({
            where: { id: userId },
            data: { displayName: parsed.data.displayName },
            select: { id: true, username: true, displayName: true },
        });
        res.json({ user });
    } catch (e: any) {
        const msg = e?.message || 'Failed to update profile';
        res.status(400).json({ error: msg });
    }
});

// Update current user's color preferences
router.patch('/me/color-preferences', authMiddleware, async (req, res) => {
    const parsed = updateColorPreferenceSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.user!.id;
        await prisma.user.update({
            where: { id: userId },
            data: { ignoreAdminColors: parsed.data.ignoreAdminColors },
        });
        res.json({ success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to update color preferences';
        res.status(400).json({ error: msg });
    }
});

export default router;
