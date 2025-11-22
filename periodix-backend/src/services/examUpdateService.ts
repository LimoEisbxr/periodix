import { prisma } from '../store/prisma.js';
import { updateExamsForUser } from './untisService.js';

const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const EXAM_LOOKAHEAD_MONTHS = 1;

export class ExamUpdateService {
    private static instance: ExamUpdateService;
    private timer: NodeJS.Timeout | null = null;

    private constructor() {}

    static getInstance(): ExamUpdateService {
        if (!ExamUpdateService.instance) {
            ExamUpdateService.instance = new ExamUpdateService();
        }
        return ExamUpdateService.instance;
    }

    start() {
        if (this.timer) return;
        console.log('[exam-update] service started');
        // Run immediately on startup (with slight delay to let app init)
        setTimeout(() => this.runUpdateCycle(), 60 * 1000);

        this.timer = setInterval(() => {
            this.runUpdateCycle();
        }, UPDATE_INTERVAL_MS);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async runUpdateCycle() {
        console.log('[exam-update] starting update cycle');
        try {
            // Find active users (e.g. logged in recently or have valid credentials)
            // For now, just all users with credentials
            const users = await prisma.user.findMany({
                where: {
                    untisSecretCiphertext: { not: null },
                },
                select: { id: true, username: true },
            });

            console.log(`[exam-update] found ${users.length} users to update`);

            const start = new Date();
            const end = new Date();
            end.setMonth(end.getMonth() + EXAM_LOOKAHEAD_MONTHS);

            for (const user of users) {
                try {
                    console.debug(
                        `[exam-update] updating exams for ${user.username}`
                    );
                    const count = await updateExamsForUser(user.id, start, end);
                    console.debug(
                        `[exam-update] updated ${user.username}: ${count} exams found`
                    );

                    // Add delay between users to be nice to API
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                } catch (e: any) {
                    console.warn(
                        `[exam-update] failed for ${user.username}:`,
                        e.message
                    );
                }
            }
        } catch (e) {
            console.error('[exam-update] cycle failed', e);
        }
        console.log('[exam-update] cycle complete');
    }
}
