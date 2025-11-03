import dotenv from 'dotenv';
import app from './app.js';
import { notificationService } from './services/notificationService.js';
import { timetableWarmupService } from './services/timetableWarmupService.js';

dotenv.config();

const port = Number(process.env.PORT || 3001);

app.listen(port, async () => {
    console.log(`Backend running on ${port}`);

    // Start the notification service
    try {
        await notificationService.startService();
    } catch (error) {
        console.error('Failed to start notification service:', error);
    }

    try {
        await timetableWarmupService.start();
    } catch (error) {
        console.error('Failed to start timetable warmup service:', error);
    }
});
