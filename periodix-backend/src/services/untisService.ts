import { WebUntis } from 'webuntis';
import { prisma } from '../store/prisma.js';
import { decryptSecret } from '../server/crypto.js';
import { UNTIS_DEFAULT_SCHOOL, UNTIS_HOST } from '../server/config.js';
import { AppError } from '../server/errors.js';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Timetable caching strategy
// ---------------------------------------------------------------------------
// Goals:
// 1. Avoid hitting WebUntis if we fetched the SAME week in the last 5 minutes.
// 2. Prefetch previous + next week (fire & forget) after a cache miss fetch.
// 3. Periodically prune old timetable cache rows to keep table small.
//    - Remove rows older than MAX_AGE_DAYS
//    - For a (userId, rangeStart, rangeEnd) keep only the most recent MAX_HISTORY_PER_RANGE rows
// 4. Keep implementation lightweight: no extra tables; in‑memory throttle for cleanup.

const WEEK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_DAYS = 45; // Hard limit for any cached timetable
const MAX_HISTORY_PER_RANGE = 2; // Keep at most 2 historical copies per week
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Run pruning at most every 6h per process

let lastCleanupRun = 0; // In‑memory marker; acceptable for single process / ephemeral scaling

function startOfDay(d: Date) {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
}

function endOfDay(d: Date) {
    const nd = new Date(d);
    nd.setHours(23, 59, 59, 999);
    return nd;
}

function startOfISOWeek(date: Date) {
    const d = startOfDay(date);
    // ISO week starts Monday (1); JS Sunday = 0
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setDate(d.getDate() + diff);
    return d;
}

function endOfISOWeek(date: Date) {
    const start = startOfISOWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return endOfDay(end);
}

function normalizeRange(start?: string, end?: string) {
    if (!start || !end) return { normStart: undefined, normEnd: undefined };
    // Treat ranges spanning a full week the same by snapping to ISO week
    const sd = new Date(start);
    const ed = new Date(end);
    // If the provided range length >= 5 days we assume week intentions and snap
    const spanMs = ed.getTime() - sd.getTime();
    if (spanMs >= 5 * 24 * 60 * 60 * 1000) {
        return { normStart: startOfISOWeek(sd), normEnd: endOfISOWeek(sd) };
    }
    // Otherwise just normalize to day bounds
    return { normStart: startOfDay(sd), normEnd: endOfDay(ed) };
}

async function pruneOldTimetables() {
    const now = Date.now();
    if (now - lastCleanupRun < CLEANUP_INTERVAL_MS) return; // throttle
    lastCleanupRun = now;
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    try {
        // Delete very old rows
        await prisma.timetable.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });

        // For each (ownerId, rangeStart, rangeEnd) keep only newest MAX_HISTORY_PER_RANGE
        // This is a bit heavy to do naively; limit to recent owners touched (lightweight): we pull ids via raw query.
        const rows: Array<{
            ownerId: string;
            rangeStart: Date | null;
            rangeEnd: Date | null;
        }> = await (prisma as any).$queryRawUnsafe(
            `SELECT DISTINCT "ownerId", "rangeStart", "rangeEnd" FROM "Timetable" WHERE "rangeStart" IS NOT NULL AND "rangeEnd" IS NOT NULL`
        );
        for (const r of rows) {
            const keep = await prisma.timetable.findMany({
                where: {
                    ownerId: r.ownerId,
                    rangeStart: r.rangeStart,
                    rangeEnd: r.rangeEnd,
                },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: MAX_HISTORY_PER_RANGE,
            });
            const keepIds = new Set(keep.map((k: any) => k.id));
            await prisma.timetable.deleteMany({
                where: {
                    ownerId: r.ownerId,
                    rangeStart: r.rangeStart,
                    rangeEnd: r.rangeEnd,
                    NOT: { id: { in: Array.from(keepIds) } },
                },
            });
        }
    } catch (e) {
        console.warn('[timetable][cleanup] failed', e);
    }
}

async function getCachedRange(ownerId: string, start: Date, end: Date) {
    const since = new Date(Date.now() - WEEK_CACHE_TTL_MS);
    return prisma.timetable.findFirst({
        where: {
            ownerId,
            rangeStart: start,
            rangeEnd: end,
            createdAt: { gt: since },
        },
        orderBy: { createdAt: 'desc' },
    });
}

async function fetchAndStoreUntis(args: {
    target: any;
    sd?: Date | undefined;
    ed?: Date | undefined;
}) {
    const { target, sd, ed } = args;
    // Fetch fresh from WebUntis
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = toHost();
    console.debug('[timetable] using Untis', {
        school,
        host,
        username: target.username,
    });
    if (!target.untisSecretCiphertext || !target.untisSecretNonce) {
        throw new AppError(
            'User missing encrypted Untis credential',
            400,
            'MISSING_UNTIS_SECRET'
        );
    }
    let untisPassword: string;
    try {
        untisPassword = decryptSecret({
            ciphertext: target.untisSecretCiphertext as any,
            nonce: target.untisSecretNonce as any,
            keyVersion: target.untisSecretKeyVersion || 1,
        });
    } catch (e) {
        console.error('[timetable] decrypt secret failed', e);
        throw new AppError(
            'Credential decryption failed',
            500,
            'DECRYPT_FAILED'
        );
    }
    const untis = new WebUntis(
        school,
        target.username,
        untisPassword,
        host
    ) as any;
    try {
        await untis.login();
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }

    let lessonsData: any;
    let homeworkData: any[] = [];
    let examData: any = [];

    try {
        // Fetch all lessons using getOwnTimetableForRange
        if (sd && ed && typeof untis.getOwnTimetableForRange === 'function') {
            console.debug('[timetable] calling getOwnTimetableForRange', {
                start: sd,
                end: ed,
                startType: typeof sd,
                endType: typeof ed,
            });
            lessonsData = await untis.getOwnTimetableForRange(sd, ed);
        } else if (typeof untis.getOwnTimetableForToday === 'function') {
            console.debug('[timetable] calling getOwnTimetableForToday');
            lessonsData = await untis.getOwnTimetableForToday();
        } else {
            console.debug(
                '[timetable] calling getTimetableForToday (fallback)'
            );
            lessonsData = await untis.getTimetableForToday?.();
        }

        // Fetch homework separately using getHomeWorksFor
        if (sd && ed && typeof untis.getHomeWorksFor === 'function') {
            console.debug('[timetable] calling getHomeWorksFor', {
                start: sd,
                end: ed,
            });
            try {
                const hwResp = await untis.getHomeWorksFor(sd, ed);
                // Extract array of homework items from response shape
                homeworkData = Array.isArray(hwResp)
                    ? hwResp
                    : Array.isArray(hwResp?.homeworks)
                    ? hwResp.homeworks
                    : [];
                // Build a map of lessonId -> subject string if available
                const lessonSubjectByLessonId: Map<number, string> = new Map();
                const lessonsArr: any[] = Array.isArray(hwResp?.lessons)
                    ? hwResp.lessons
                    : [];
                for (const l of lessonsArr) {
                    if (
                        typeof l?.id === 'number' &&
                        typeof l?.subject === 'string'
                    ) {
                        lessonSubjectByLessonId.set(l.id, l.subject);
                    }
                }
                console.debug(
                    '[timetable] fetched homework count',
                    homeworkData.length
                );
                // Persist with subject enrichment and due dates
                if (homeworkData.length > 0) {
                    try {
                        await storeHomeworkData(
                            target.id,
                            homeworkData,
                            lessonSubjectByLessonId
                        );
                    } catch (e: any) {
                        console.warn(
                            '[timetable] failed to store homework data',
                            e?.message
                        );
                    }
                }
            } catch (e: any) {
                console.warn(
                    '[timetable] getHomeWorksFor failed, continuing without homework',
                    e?.message
                );
                homeworkData = [];
            }
        }

        // Fetch exams for the range if available
        if (sd && ed && typeof untis.getExamsForRange === 'function') {
            console.debug('[timetable] calling getExamsForRange', {
                start: sd,
                end: ed,
            });
            try {
                examData = await untis.getExamsForRange(sd, ed);
                console.debug('[timetable] fetched exam data', {
                    count: Array.isArray(examData) ? examData.length : 0,
                    sample: Array.isArray(examData) && examData.length > 0 ? examData[0] : null
                });
            } catch (e: any) {
                console.warn(
                    '[timetable] getExamsForRange failed, continuing without exams',
                    e?.message
                );
                examData = [];
            }
        }
    } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        if (
            msg.includes("didn't return any result") ||
            msg.includes('did not return any result') ||
            msg.includes('no result')
        ) {
            console.warn('[timetable] no result from Untis, returning empty');
            lessonsData = [];
            homeworkData = [];
            examData = [];
        } else {
            throw new AppError('Untis fetch failed', 502, 'UNTIS_FETCH_FAILED');
        }
    }

    try {
        await untis.logout?.();
    } catch {}

    // Store exam data in database
    if (examData && Array.isArray(examData) && examData.length > 0) {
        try {
            await storeExamData(target.id, examData);
        } catch (e: any) {
            console.warn('[timetable] failed to store exam data', e?.message);
        }
    }

    // Combine homework and exam data with lessons
    const enrichedLessons = await enrichLessonsWithHomeworkAndExams(
        target.id,
        lessonsData || [],
        sd,
        ed
    );

    const payload = enrichedLessons;
    const rangeStart = sd ?? null;
    const rangeEnd = ed ?? null;

    const sample = Array.isArray(payload) ? payload.slice(0, 2) : payload;
    console.debug('[timetable] response summary', {
        hasPayload: !!payload,
        type: typeof payload,
        lessonsCount: Array.isArray(lessonsData) ? lessonsData.length : 0,
        homeworkCount: homeworkData.length,
        examsCount: Array.isArray(examData) ? examData.length : 0,
        sample: (() => {
            try {
                return JSON.stringify(sample).slice(0, 500);
            } catch {
                return '[unserializable]';
            }
        })(),
    });

    await prisma.timetable.create({
        data: {
            ownerId: target.id,
            payload,
            rangeStart,
            rangeEnd,
        },
    });

    return { userId: target.id, rangeStart, rangeEnd, payload };
}

// Host is fixed via env. Keep helper for future flexibility.
function toHost() {
    return UNTIS_HOST;
}

function parseDate(date?: string) {
    return date ? new Date(date) : undefined;
}

export async function getOrFetchTimetableRange(args: {
    requesterId: string;
    targetUserId: string;
    start?: string | undefined;
    end?: string | undefined;
}) {
    console.debug('[timetable] request', {
        requesterId: args.requesterId,
        targetUserId: args.targetUserId,
        start: args.start,
        end: args.end,
    });
    const target: any = await (prisma as any).user.findUnique({
        where: { id: args.targetUserId },
        select: {
            id: true,
            username: true,
            untisSecretCiphertext: true,
            untisSecretNonce: true,
            untisSecretKeyVersion: true,
        },
    });
    if (!target) throw new Error('Target user not found');

    const { normStart, normEnd } = normalizeRange(args.start, args.end);
    let sd = normStart;
    let ed = normEnd;
    let cached: any = undefined;
    if (sd && ed) {
        try {
            cached = await getCachedRange(target.id, sd, ed);
        } catch (e) {
            console.warn('[timetable] cache lookup failed', e);
        }
        if (cached) {
            return {
                userId: target.id,
                rangeStart: cached.rangeStart,
                rangeEnd: cached.rangeEnd,
                payload: cached.payload,
                cached: true,
            };
        }
    } else {
        // Range not provided: treat as 'today', define single-day normalization
        if (args.start) sd = startOfDay(new Date(args.start));
        if (args.end) ed = endOfDay(new Date(args.end));
    }

    const fresh = await fetchAndStoreUntis({ target, sd, ed });

    // Fire & forget adjacent week prefetch if week context present
    if (sd && ed) {
        setTimeout(() => {
            const prevStart = new Date(sd!);
            prevStart.setDate(prevStart.getDate() - 7);
            const prevEnd = new Date(ed!);
            prevEnd.setDate(prevEnd.getDate() - 7);
            const nextStart = new Date(sd!);
            nextStart.setDate(nextStart.getDate() + 7);
            const nextEnd = new Date(ed!);
            nextEnd.setDate(nextEnd.getDate() + 7);
            const tasks = [
                { s: prevStart, e: prevEnd },
                { s: nextStart, e: nextEnd },
            ];
            tasks.forEach(async ({ s, e }) => {
                try {
                    const existing = await getCachedRange(target.id, s, e);
                    if (!existing) {
                        await fetchAndStoreUntis({ target, sd: s, ed: e });
                    }
                } catch (e) {
                    console.debug('[timetable][prefetch] skipped', e);
                }
            });
            pruneOldTimetables();
        }, 5); // slight delay to avoid blocking response
    }

    return fresh;
}

export async function verifyUntisCredentials(
    username: string,
    password: string
) {
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = UNTIS_HOST;
    const untis = new WebUntis(school, username, password, host) as any;
    try {
        await untis.login();
        try {
            await untis.logout?.();
        } catch {}
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }
}

export async function getUserClassInfo(
    username: string,
    password: string
): Promise<string[]> {
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = UNTIS_HOST;
    const untis = new WebUntis(school, username, password, host) as any;
    
    try {
        await untis.login();
        
        // Try to get user's classes/grades
        let classes: string[] = [];
        
        try {
            // Get current user info which might include class information
            if (typeof untis.getOwnClassesList === 'function') {
                const classList = await untis.getOwnClassesList();
                classes = Array.isArray(classList) 
                    ? classList.map((c: any) => c.name || c.longName || String(c)).filter(Boolean)
                    : [];
            } else if (typeof untis.getOwnStudentId === 'function') {
                // Alternative approach: get student info
                const studentId = await untis.getOwnStudentId();
                if (studentId && typeof untis.getStudent === 'function') {
                    const student = await untis.getStudent(studentId);
                    if (student?.klasse) {
                        classes = Array.isArray(student.klasse) 
                            ? student.klasse.map((k: any) => k.name || k.longName || String(k)).filter(Boolean)
                            : [String(student.klasse)];
                    }
                }
            }
            
            // If we still don't have classes, try to get them from the general classes list
            if (classes.length === 0 && typeof untis.getClasses === 'function') {
                const allClasses = await untis.getClasses();
                if (Array.isArray(allClasses)) {
                    // This is a fallback - we can't determine user's specific class this way
                    // but we'll return empty array and rely on username whitelist
                    classes = [];
                }
            }
        } catch (e: any) {
            console.warn('[whitelist] failed to get user class info', e?.message);
            classes = [];
        }
        
        try {
            await untis.logout?.();
        } catch {}
        
        return classes;
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }
}

async function storeHomeworkData(
    userId: string,
    homeworkData: any[],
    lessonSubjectByLessonId?: Map<number, string>
) {
    for (const hw of homeworkData) {
        try {
            // Determine subject string via mapping (fallback to hw.subject?.name)
            const subjectStr =
                (typeof hw.lessonId === 'number' &&
                    lessonSubjectByLessonId?.get(hw.lessonId)) ||
                hw.subject?.name ||
                '';
            await (prisma as any).homework.upsert({
                where: { userId_untisId: { userId, untisId: hw.id } },
                update: {
                    lessonId: hw.lessonId,
                    // Store due date; Untis returns both date (assigned) and dueDate
                    date: hw.dueDate ?? hw.date,
                    subjectId: Number.isInteger(hw.subject?.id)
                        ? hw.subject?.id
                        : 0,
                    subject: subjectStr,
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: hw.id,
                    userId,
                    lessonId: hw.lessonId,
                    // Store due date; Untis returns both date (assigned) and dueDate
                    date: hw.dueDate ?? hw.date,
                    subjectId: Number.isInteger(hw.subject?.id)
                        ? hw.subject?.id
                        : 0,
                    subject: subjectStr,
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                },
            });
        } catch (e: any) {
            console.warn(
                `[homework] failed to store homework ${hw?.id}:`,
                e?.message
            );
        }
    }
}

async function storeExamData(userId: string, examData: any[]) {
    for (const exam of examData) {
        try {
            // Process teachers and rooms data appropriately for storage
            const processedTeachers = exam.teachers && Array.isArray(exam.teachers) 
                ? exam.teachers.map((teacher: any) => ({
                    id: typeof teacher === 'object' ? teacher.id : undefined,
                    name: typeof teacher === 'string' ? teacher : teacher?.name || ''
                }))
                : null;
                
            const processedRooms = exam.rooms && Array.isArray(exam.rooms)
                ? exam.rooms.map((room: any) => ({
                    id: typeof room === 'object' ? room.id : undefined,  
                    name: typeof room === 'string' ? room : room?.name || ''
                }))
                : null;

            await (prisma as any).exam.upsert({
                where: { userId_untisId: { userId, untisId: exam.id } },
                update: {
                    // Use examDate property from WebUntis API
                    date: exam.examDate || exam.date,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    // Handle subject as string or object
                    subjectId: typeof exam.subject === 'object' ? exam.subject?.id : undefined,
                    subject: typeof exam.subject === 'string' ? exam.subject : exam.subject?.name || '',
                    name: exam.name || '',
                    text: exam.text || '',
                    // Store processed JSON or set null when absent
                    teachers: processedTeachers,
                    rooms: processedRooms,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: exam.id,
                    userId,
                    // Use examDate property from WebUntis API
                    date: exam.examDate || exam.date,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    // Handle subject as string or object
                    subjectId: typeof exam.subject === 'object' ? exam.subject?.id : undefined,
                    subject: typeof exam.subject === 'string' ? exam.subject : exam.subject?.name || '',
                    name: exam.name || '',
                    text: exam.text || '',
                    // Store processed JSON or set null when absent
                    teachers: processedTeachers,
                    rooms: processedRooms,
                },
            });
        } catch (e: any) {
            console.warn(`[exam] failed to store exam ${exam.id}:`, e?.message);
        }
    }
}

async function enrichLessonsWithHomeworkAndExams(
    userId: string,
    lessons: any[],
    startDate?: Date,
    endDate?: Date
): Promise<any[]> {
    if (!Array.isArray(lessons)) return lessons;

    // Get homework and exams for the date range (due date for homework)
    const whereClause: any = { userId };
    if (startDate && endDate) {
        const startDateInt = parseInt(
            startDate.toISOString().slice(0, 10).replace(/-/g, '')
        );
        const endDateInt = parseInt(
            endDate.toISOString().slice(0, 10).replace(/-/g, '')
        );
        whereClause.date = {
            gte: startDateInt,
            lte: endDateInt,
        };
    }

    const [homework, exams] = await Promise.all([
        (prisma as any).homework.findMany({ where: whereClause }),
        (prisma as any).exam.findMany({ where: whereClause }),
    ]);

    const lessonMatchesHw = (hw: any, lesson: any) => {
        const idsToCheck = [
            lesson?.id,
            lesson?.lsnumber,
            lesson?.lsNumber,
            lesson?.ls,
            lesson?.lessonId,
        ].filter((v) => typeof v === 'number');
        return idsToCheck.some((v) => v === hw.lessonId);
    };

    const subjectMatches = (hwSubject: string, lessonSubject: string) => {
        if (!hwSubject || !lessonSubject) return false;
        // Normalize subject names for comparison (case insensitive, trim whitespace)
        return hwSubject.toLowerCase().trim() === lessonSubject.toLowerCase().trim();
    };

    // Helper to check if homework date is within a reasonable range of lesson date
    const dateWithinRange = (hwDate: number, lessonDate: number, dayRange: number = 7) => {
        if (hwDate === lessonDate) return true;
        
        // Convert YYYYMMDD to Date objects for comparison
        const hwDateObj = new Date(
            Math.floor(hwDate / 10000),
            Math.floor((hwDate % 10000) / 100) - 1,
            hwDate % 100
        );
        const lessonDateObj = new Date(
            Math.floor(lessonDate / 10000),
            Math.floor((lessonDate % 10000) / 100) - 1,
            lessonDate % 100
        );
        
        const diffMs = Math.abs(hwDateObj.getTime() - lessonDateObj.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= dayRange;
    };

    // Enrich lessons with homework and exam data
    return lessons.map((lesson) => {
        const subjectName = lesson.su?.[0]?.name;
        const lessonHomework = homework
            .filter(
                (hw: any) => {
                    // Primary matching: homework lessonId matches lesson ID
                    if (lessonMatchesHw(hw, lesson)) {
                        return true;
                    }
                    
                    // Secondary matching: subject matches and date is within reasonable range
                    if (hw.subject && subjectName && subjectMatches(hw.subject, subjectName)) {
                        // Only attach if homework date is within 7 days of lesson date
                        // This prevents homework from being attached to all lessons of same subject
                        if (dateWithinRange(hw.date, lesson.date, 7)) {
                            return true;
                        }
                    }
                    
                    return false;
                }
            )
            .map((hw: any) => ({
                id: hw.untisId,
                lessonId: hw.lessonId,
                date: hw.date,
                subject: { id: hw.subjectId, name: hw.subject },
                text: hw.text,
                remark: hw.remark,
                completed: hw.completed,
            }));

        const lessonExams = exams
            .filter(
                (exam: any) => {
                    const dateMatch = exam.date === lesson.date;
                    const subjectMatch = exam.subject === lesson.su?.[0]?.name;
                    
                    // More flexible subject matching - check if subject names are similar
                    const flexibleSubjectMatch = !subjectMatch && lesson.su?.[0]?.name && exam.subject
                        ? lesson.su[0].name.toLowerCase().includes(exam.subject.toLowerCase()) ||
                          exam.subject.toLowerCase().includes(lesson.su[0].name.toLowerCase())
                        : false;
                    
                    const shouldMatch = dateMatch && (subjectMatch || flexibleSubjectMatch);
                    
                    if (exam.date === lesson.date) {
                        console.debug('[exam-matching]', {
                            examDate: exam.date,
                            lessonDate: lesson.date,
                            examSubject: exam.subject,
                            lessonSubject: lesson.su?.[0]?.name,
                            exactSubjectMatch: subjectMatch,
                            flexibleSubjectMatch: flexibleSubjectMatch,
                            willMatch: shouldMatch
                        });
                    }
                    
                    return shouldMatch;
                }
            )
            .map((exam: any) => ({
                id: exam.untisId,
                date: exam.date,
                startTime: exam.startTime,
                endTime: exam.endTime,
                subject: { id: exam.subjectId, name: exam.subject },
                // Values are already JSON in DB
                teachers: exam.teachers ?? undefined,
                rooms: exam.rooms ?? undefined,
                name: exam.name,
                text: exam.text,
            }));

        const result = {
            ...lesson,
            homework: lessonHomework.length > 0 ? lessonHomework : undefined,
            exams: lessonExams.length > 0 ? lessonExams : undefined,
        };
        
        // Debug logging for lessons with exams
        if (lessonExams.length > 0) {
            console.debug('[lesson-exam-enrichment]', {
                lessonId: lesson.id,
                lessonDate: lesson.date,
                lessonSubject: lesson.su?.[0]?.name,
                examCount: lessonExams.length,
                exams: lessonExams.map((e: any) => ({ name: e.name, subject: e.subject.name }))
            });
        }
        
        return result;
    });
}
