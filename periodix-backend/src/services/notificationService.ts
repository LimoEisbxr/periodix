import { prisma } from '../store/prisma.js';
import { getOrFetchTimetableRange } from './untisService.js';
import webpush from 'web-push';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@periodix.de';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('Web Push configured with VAPID keys');
} else {
    console.warn(
        'VAPID keys not configured - push notifications will not work'
    );
}

export interface NotificationData {
    type: string;
    title: string;
    message: string;
    data?: any;
    userId: string;
    expiresAt?: Date;
    notificationId?: string;
}

export class NotificationService {
    private static instance: NotificationService;
    private intervalId: NodeJS.Timeout | null = null;
    private upcomingIntervalId: NodeJS.Timeout | null = null;

    private constructor() {}

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    // Create a notification (with basic deduplication)
    async createNotification(data: NotificationData): Promise<void> {
        try {
            // Basic dedupe: skip if same (userId, type, title, message) was created recently
            // This prevents spam after restarts or tight loops.
            const thirtyDaysAgo = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
            );
            const existing = await (prisma as any).notification.findFirst({
                where: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    createdAt: { gt: thirtyDaysAgo },
                },
                select: { id: true },
            });

            if (existing) {
                return; // already notified recently
            }

            const created = await (prisma as any).notification.create({
                data: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    data: data.data || null,
                    expiresAt: data.expiresAt,
                },
                select: { id: true },
            });

            // Try to send push notification if user has subscriptions
            await this.sendPushNotification({
                ...data,
                notificationId: created.id,
            });
        } catch (error) {
            console.error('Failed to create notification:', error);
        }
    }

    // Send push notification to user's devices
    async sendPushNotification(data: NotificationData): Promise<void> {
        try {
            const user = await (prisma as any).user.findUnique({
                where: { id: data.userId },
                include: {
                    notificationSettings: true,
                    notificationSubscriptions: {
                        where: { active: true },
                    },
                },
            });

            if (!user?.notificationSettings?.pushNotificationsEnabled) {
                return;
            }

            // Check if notification type is enabled
            if (
                !this.isNotificationTypeEnabled(
                    data.type,
                    user.notificationSettings
                )
            ) {
                return;
            }

            const subscriptions = user.notificationSubscriptions || [];
            if (subscriptions.length === 0) {
                return;
            }

            // Only send push notifications if VAPID keys are configured
            if (!vapidPublicKey || !vapidPrivateKey) {
                console.warn(
                    'VAPID keys not configured - skipping push notification'
                );
                return;
            }

            const payload = JSON.stringify({
                title: data.title,
                body: data.message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.notificationId
                    ? `periodix-${data.notificationId}`
                    : `periodix-${data.type}`,
                data: {
                    type: data.type,
                    notificationId: data.notificationId,
                    ...data.data,
                },
                actions: [
                    {
                        action: 'view',
                        title: 'View',
                        icon: '/icon-192.png',
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss',
                    },
                ],
            });

            // Send push notification to all user's devices with per-device preferences
            const pushPromises = subscriptions.map(async (sub: any) => {
                try {
                    const devicePrefs = (user.notificationSettings
                        ?.devicePreferences || {}) as Record<string, any>;
                    const entry = devicePrefs[sub.endpoint] || {};
                    // Map type -> per-device flag key and default behavior
                    let flagKey: string | null = null;
                    let requireTrue = false; // when true, only send if flag strictly true
                    switch (data.type) {
                        case 'upcoming_lesson':
                            flagKey = 'upcomingLessonsEnabled';
                            requireTrue = true; // default off
                            break;
                        case 'cancelled_lesson':
                            flagKey = 'cancelledLessonsEnabled';
                            break;
                        case 'irregular_lesson':
                            flagKey = 'irregularLessonsEnabled';
                            break;
                        case 'timetable_change':
                            flagKey = 'timetableChangesEnabled';
                            break;
                        case 'access_request':
                            flagKey = 'accessRequestsEnabled';
                            break;
                        default:
                            flagKey = null;
                    }
                    if (flagKey) {
                        const value = entry[flagKey];
                        if (requireTrue) {
                            if (value !== true) {
                                return; // skip unless explicitly enabled on this device
                            }
                        } else {
                            if (value === false) {
                                return; // skip if explicitly disabled on this device
                            }
                        }
                    }
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    };

                    await webpush.sendNotification(pushSubscription, payload);
                    console.log(
                        `Push notification sent to device: ${sub.endpoint.substring(
                            0,
                            50
                        )}...`
                    );
                } catch (error: any) {
                    console.error('Failed to send push to device:', error);

                    // If subscription is invalid, mark it as inactive
                    if (error.statusCode === 410 || error.statusCode === 413) {
                        await (prisma as any).notificationSubscription.update({
                            where: { id: sub.id },
                            data: { active: false },
                        });
                        console.log(
                            `Marked subscription as inactive: ${sub.endpoint.substring(
                                0,
                                50
                            )}...`
                        );
                    }
                }
            });

            await Promise.allSettled(pushPromises);

            // Mark notification as sent
            await (prisma as any).notification.updateMany({
                where: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    sent: false,
                },
                data: { sent: true },
            });

            console.log(
                `Push notification sent to ${subscriptions.length} devices for user ${data.userId}`
            );
        } catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }

    // Check if notification type is enabled for user
    private isNotificationTypeEnabled(type: string, settings: any): boolean {
        switch (type) {
            case 'timetable_change':
                return settings.timetableChangesEnabled;
            case 'cancelled_lesson':
                return settings.cancelledLessonsEnabled;
            case 'irregular_lesson':
                return settings.irregularLessonsEnabled;
            case 'upcoming_lesson':
                // Per-device setting handled later; don't block globally here
                return true;
            case 'access_request':
                return settings.accessRequestsEnabled;
            default:
                return true;
        }
    }

    // Notify user managers about new access requests
    async notifyAccessRequest(
        username: string,
        message?: string
    ): Promise<void> {
        try {
            const userManagers = await (prisma as any).user.findMany({
                where: { isUserManager: true },
                include: { notificationSettings: true },
            });

            for (const manager of userManagers) {
                if (
                    manager.notificationSettings?.accessRequestsEnabled !==
                    false
                ) {
                    await this.createNotification({
                        type: 'access_request',
                        title: 'New Access Request',
                        message: `${username} has requested access${
                            message ? `: ${message}` : ''
                        }`,
                        userId: manager.id,
                        data: { username, message },
                        expiresAt: new Date(
                            Date.now() + 7 * 24 * 60 * 60 * 1000
                        ), // 7 days
                    });
                }
            }
        } catch (error) {
            console.error('Failed to notify access request:', error);
        }
    }

    // Check for timetable changes and notify users
    async checkTimetableChanges(): Promise<void> {
        try {
            const adminSettings = await (
                prisma as any
            ).adminNotificationSettings.findFirst();
            if (!adminSettings?.enableTimetableNotifications) {
                return;
            }

            // Compute current ISO week range
            const now = new Date();
            const startOfISOWeek = (d: Date) => {
                const nd = new Date(d);
                nd.setHours(0, 0, 0, 0);
                const day = nd.getDay(); // 0=Sun..6=Sat
                const diff = day === 0 ? -6 : 1 - day; // shift to Monday
                nd.setDate(nd.getDate() + diff);
                return nd;
            };
            const endOfISOWeek = (d: Date) => {
                const start = startOfISOWeek(d);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return end;
            };
            const s = startOfISOWeek(now).toISOString();
            const e = endOfISOWeek(now).toISOString();

            // Refresh cache for users who either enabled push (for upcoming) OR timetable change notifications
            const usersToRefresh = await (prisma as any).user.findMany({
                where: {
                    OR: [
                        {
                            notificationSettings: {
                                pushNotificationsEnabled: true,
                            },
                        },
                        {
                            notificationSettings: {
                                timetableChangesEnabled: true,
                            },
                        },
                    ],
                },
                include: {
                    notificationSettings: true,
                    timetables: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
            });

            for (const user of usersToRefresh) {
                let tmpUser = user as any;
                try {
                    const fresh = await getOrFetchTimetableRange({
                        requesterId: user.id,
                        targetUserId: user.id,
                        start: s,
                        end: e,
                    });
                    tmpUser = {
                        ...user,
                        timetables: [
                            {
                                ...(user.timetables?.[0] || {}),
                                payload: fresh?.payload ?? [],
                            },
                        ],
                    } as any;
                } catch (fetchErr) {
                    // If fetching fails (e.g., missing Untis credentials), fall back to existing cache
                    console.warn(
                        `Admin interval refresh failed for ${user.id}:`,
                        (fetchErr as any)?.message || fetchErr
                    );
                }

                // Only check irregular/cancelled changes for users who enabled it
                if (user.notificationSettings?.timetableChangesEnabled) {
                    await this.checkUserTimetableChanges(tmpUser, {
                        onlyUpcoming: false,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to check timetable changes:', error);
        }
    }

    // Check for changes in a specific user's timetable
    private async checkUserTimetableChanges(
        user: any,
        options?: { onlyUpcoming?: boolean }
    ): Promise<void> {
        try {
            // This is a simplified version - in a real implementation you would:
            // 1. Fetch the latest timetable from WebUntis
            // 2. Compare with the stored timetable
            // 3. Detect changes (cancelled lessons, irregular lessons, etc.)
            // 4. Send notifications for changes

            const latestTimetable = user.timetables?.[0];
            if (!latestTimetable?.payload) {
                return;
            }

            // Extract lessons from the timetable payload
            const lessons = latestTimetable.payload as any[];
            if (!Array.isArray(lessons)) {
                return;
            }

            // Get current date info
            const today = new Date();
            const todayString =
                today.getFullYear() * 10000 +
                (today.getMonth() + 1) * 100 +
                today.getDate();

            // Calculate week boundaries (assuming week starts on Monday)
            const startOfWeek = new Date(today);
            const dayOfWeek = startOfWeek.getDay();
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Handle Sunday (0) as 6 days from Monday
            startOfWeek.setDate(today.getDate() - daysFromMonday);
            const startOfWeekString =
                startOfWeek.getFullYear() * 10000 +
                (startOfWeek.getMonth() + 1) * 100 +
                startOfWeek.getDate();

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            const endOfWeekString =
                endOfWeek.getFullYear() * 10000 +
                (endOfWeek.getMonth() + 1) * 100 +
                endOfWeek.getDate();

            // Helper formatters for messages
            const formatYmd = (n: number | undefined) => {
                if (!n || typeof n !== 'number') return '';
                const y = Math.floor(n / 10000);
                const m = Math.floor((n % 10000) / 100);
                const d = n % 100;
                return `${String(y)}-${String(m).padStart(2, '0')}-${String(
                    d
                ).padStart(2, '0')}`;
            };
            const formatHm = (hhmm: number | undefined) => {
                if (!hhmm && hhmm !== 0) return '';
                const hh = Math.floor((hhmm as number) / 100);
                const mm = (hhmm as number) % 100;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(
                    2,
                    '0'
                )}`;
            };

            if (!options?.onlyUpcoming) {
                for (const lesson of lessons) {
                    // Check cancelled lessons based on user's time scope preference
                    if (
                        lesson.code === 'cancelled' &&
                        user.notificationSettings?.cancelledLessonsEnabled
                    ) {
                        const scope =
                            user.notificationSettings
                                ?.cancelledLessonsTimeScope || 'day';
                        let shouldNotify = false;

                        if (scope === 'day') {
                            shouldNotify = lesson.date === todayString;
                        } else if (scope === 'week') {
                            shouldNotify =
                                lesson.date >= startOfWeekString &&
                                lesson.date <= endOfWeekString;
                        }

                        if (shouldNotify) {
                            const subject = lesson.su?.[0]?.name || 'Lesson';
                            const when = `${formatYmd(lesson.date)} ${formatHm(
                                lesson.startTime
                            )}`.trim();
                            await this.createNotification({
                                type: 'cancelled_lesson',
                                title: 'Lesson Cancelled',
                                message: `${subject} on ${when} has been cancelled`,
                                userId: user.id,
                                data: lesson,
                            });
                        }
                    }

                    // Check irregular lessons based on user's time scope preference
                    if (
                        (lesson.code === 'irregular' ||
                            // treat room/teacher orgname markers as irregular too
                            lesson.te?.some((t: any) => t.orgname) ||
                            lesson.ro?.some((r: any) => r.orgname)) &&
                        user.notificationSettings?.irregularLessonsEnabled
                    ) {
                        const scope =
                            user.notificationSettings
                                ?.irregularLessonsTimeScope || 'day';
                        let shouldNotify = false;

                        if (scope === 'day') {
                            shouldNotify = lesson.date === todayString;
                        } else if (scope === 'week') {
                            shouldNotify =
                                lesson.date >= startOfWeekString &&
                                lesson.date <= endOfWeekString;
                        }

                        if (shouldNotify) {
                            const irregularFlags: string[] = [];
                            if (lesson.code === 'irregular')
                                irregularFlags.push('schedule');
                            if (lesson.te?.some((t: any) => t.orgname))
                                irregularFlags.push('teacher');
                            if (lesson.ro?.some((r: any) => r.orgname))
                                irregularFlags.push('room');
                            const subject = lesson.su?.[0]?.name || 'Lesson';
                            const when = `${formatYmd(lesson.date)} ${formatHm(
                                lesson.startTime
                            )}`.trim();
                            await this.createNotification({
                                type: 'irregular_lesson',
                                title: 'Irregular Lesson',
                                message: `${subject} on ${when} has irregular changes (${irregularFlags.join(
                                    ', '
                                )})`,
                                userId: user.id,
                                data: lesson,
                            });
                        }
                    }

                    // Room/teacher changes are handled under irregular_lesson above
                }
            }

            // Upcoming lesson reminders (Beta): send 5 minutes before start time
            if (options?.onlyUpcoming && user.notificationSettings) {
                const now = new Date();
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
                const todayYmd =
                    now.getFullYear() * 10000 +
                    (now.getMonth() + 1) * 100 +
                    now.getDate();

                // helper to convert Untis HHmm int to minutes
                const toMinutes = (hhmm: number) =>
                    Math.floor(hhmm / 100) * 60 + (hhmm % 100);

                for (const lesson of lessons) {
                    if (!lesson?.startTime) continue;
                    if (lesson.date !== todayYmd) continue;
                    if (lesson.code === 'cancelled') continue; // don't remind cancelled

                    const startMin = toMinutes(lesson.startTime);
                    const diff = startMin - nowMinutes; // minutes until start
                    if (diff === 5) {
                        // Only send if at least one device opted in for upcoming reminders
                        const devicePrefs = (user.notificationSettings
                            ?.devicePreferences || {}) as Record<string, any>;
                        const anyDeviceEnabled = Object.values(
                            devicePrefs
                        ).some((p: any) => p?.upcomingLessonsEnabled);
                        if (!anyDeviceEnabled) continue;
                        // Build shortform info: subject, time, room, teacher
                        const subject = lesson.su?.[0]?.name || 'Lesson';
                        const hh = String(
                            Math.floor(lesson.startTime / 100)
                        ).padStart(2, '0');
                        const mm = String(lesson.startTime % 100).padStart(
                            2,
                            '0'
                        );
                        const room = lesson.ro
                            ?.map((r: any) => r.name)
                            .join(', ');
                        const teacher = lesson.te
                            ?.map((t: any) => t.name)
                            .join(', ');
                        const irregular =
                            lesson.code === 'irregular' ||
                            lesson.te?.some((t: any) => t.orgname) ||
                            lesson.ro?.some((r: any) => r.orgname);

                        const irregularParts: string[] = [];
                        if (lesson.te?.some((t: any) => t.orgname)) {
                            const changes = lesson.te
                                .filter((t: any) => t.orgname)
                                .map((t: any) => `${t.orgname} → ${t.name}`)
                                .join(', ');
                            if (changes)
                                irregularParts.push(`Teacher: ${changes}`);
                        }
                        if (lesson.ro?.some((r: any) => r.orgname)) {
                            const changes = lesson.ro
                                .filter((r: any) => r.orgname)
                                .map((r: any) => `${r.orgname} → ${r.name}`)
                                .join(', ');
                            if (changes)
                                irregularParts.push(`Room: ${changes}`);
                        }

                        const title = 'Upcoming lesson in 5 minutes';
                        const details = [
                            `${subject} @ ${hh}:${mm}`,
                            room ? `Room ${room}` : undefined,
                            teacher ? `with ${teacher}` : undefined,
                        ].filter(Boolean);
                        const message =
                            details.join(' • ') +
                            (irregular && irregularParts.length
                                ? ` — Irregular: ${irregularParts.join(', ')}`
                                : '');

                        await this.createNotification({
                            type: 'upcoming_lesson',
                            title,
                            message,
                            userId: user.id,
                            data: {
                                lesson,
                                irregular,
                                irregularDetails: irregularParts,
                            },
                            // auto-expire shortly after start time
                            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
                        });
                    }
                }
            }
        } catch (error) {
            console.error(
                `Failed to check timetable changes for user ${user.id}:`,
                error
            );
        }
    }

    // Fast path: check upcoming lessons for all users with setting enabled
    private async checkUpcomingLessons(): Promise<void> {
        try {
            const users = await (prisma as any).user.findMany({
                where: {
                    notificationSettings: { pushNotificationsEnabled: true },
                },
                include: {
                    notificationSettings: true,
                    timetables: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
            });
            const now = new Date();
            const todayYmd =
                now.getFullYear() * 10000 +
                (now.getMonth() + 1) * 100 +
                now.getDate();

            for (const user of users) {
                try {
                    // Only process upcoming reminders if any device opted in
                    const devicePrefs = (user.notificationSettings
                        ?.devicePreferences || {}) as Record<string, any>;
                    const anyDeviceEnabled = Object.values(devicePrefs).some(
                        (p: any) => p?.upcomingLessonsEnabled === true
                    );
                    if (!anyDeviceEnabled) {
                        continue; // skip user entirely to avoid needless Untis fetches
                    }

                    const latest = user.timetables?.[0];
                    const lessons: any[] = Array.isArray(latest?.payload)
                        ? (latest.payload as any[])
                        : [];
                    const hasToday = lessons.some(
                        (l: any) => Number(l?.date) === todayYmd
                    );
                    // Only use cached data for upcoming reminders; if cache is missing today's lessons, skip.
                    if (!hasToday) {
                        continue;
                    }

                    await this.checkUserTimetableChanges(user, {
                        onlyUpcoming: true,
                    });
                } catch (perUserErr) {
                    console.error(
                        `checkUpcomingLessons user ${user?.id} failed:`,
                        perUserErr
                    );
                }
            }
        } catch (e) {
            console.error('checkUpcomingLessons failed:', e);
        }
    }

    // Start the background notification service
    async startService(): Promise<void> {
        if (this.intervalId) {
            return; // Already running
        }

        console.log('Starting notification service...');

        // Get fetch interval from admin settings
        const adminSettings = await (
            prisma as any
        ).adminNotificationSettings.findFirst();
        const intervalMinutes = adminSettings?.timetableFetchInterval || 30;

        this.intervalId = setInterval(async () => {
            await this.checkTimetableChanges();
        }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds

        // Separate fast loop for upcoming lesson reminders (runs every 60s)
        if (!this.upcomingIntervalId) {
            this.upcomingIntervalId = setInterval(async () => {
                try {
                    await this.checkUpcomingLessons();
                } catch (e) {
                    console.error('Upcoming lesson check failed:', e);
                }
            }, 60 * 1000);
        }

        console.log(
            `Notification service started with ${intervalMinutes} minute interval`
        );
    }

    // Stop the background notification service
    stopService(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Notification service stopped');
        }
        if (this.upcomingIntervalId) {
            clearInterval(this.upcomingIntervalId);
            this.upcomingIntervalId = null;
            console.log('Upcoming reminder loop stopped');
        }
    }

    // Clean up expired notifications
    async cleanupExpiredNotifications(): Promise<void> {
        try {
            const result = await (prisma as any).notification.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                    },
                },
            });

            if (result.count > 0) {
                console.log(`Cleaned up ${result.count} expired notifications`);
            }
        } catch (error) {
            console.error('Failed to cleanup expired notifications:', error);
        }
    }
}

export const notificationService = NotificationService.getInstance();
