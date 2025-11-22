export function addDays(d: Date, days: number) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
}

export function startOfWeek(d: Date) {
    const nd = new Date(d);
    const dow = nd.getDay();
    const diff = (dow === 0 ? -6 : 1) - dow;
    return addDays(nd, diff);
}

export function pad(n: number) {
    return n < 10 ? `0${n}` : String(n);
}

export function fmtLocal(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function yyyymmddToISO(n: number) {
    if (typeof n !== 'number' || Number.isNaN(n)) return '';
    const s = String(n).padStart(8, '0');
    const y = s.slice(0, 4);
    const mo = s.slice(4, 6);
    const day = s.slice(6, 8);
    return `${y}-${mo}-${day}`;
}

export function fmtHM(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${pad(h)}:${pad(m)}`;
}

export function hourMarks(startMin: number, endMin: number) {
    const marks: Array<{ min: number; label: string }> = [];
    let m = Math.ceil(startMin / 60) * 60;
    for (; m <= endMin; m += 60) marks.push({ min: m, label: fmtHM(m) });
    return marks;
}

export function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

export function untisToMinutes(hhmm: number) {
    const h = Math.floor(hhmm / 100);
    const m = hhmm % 100;
    return h * 60 + m;
}

/**
 * Calculate the ISO week number for a given date
 * ISO 8601 standard: Week 1 is the first week with at least 4 days in the new year
 */
export function getISOWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    
    // Find the Thursday in this week (ISO week belongs to the year of its Thursday)
    target.setDate(target.getDate() - dayOfWeek + 3);
    
    // Get January 1st of the target year
    const jan1 = new Date(target.getFullYear(), 0, 1);
    
    // Calculate the number of days between the Thursday and January 1st
    const diffInMs = target.getTime() - jan1.getTime();
    const diffInDays = Math.floor(diffInMs / (24 * 60 * 60 * 1000));
    
    // Week number = floor(days / 7) + 1
    return Math.floor(diffInDays / 7) + 1;
}

/**
 * Get the next workday (Monday-Friday) from a given date.
 * If the current day is Friday, returns Monday of the next week.
 */
export function getNextWorkday(date: Date): Date {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    if (dayOfWeek === 0) { // Sunday -> Monday
        return addDays(date, 1);
    } else if (dayOfWeek === 6) { // Saturday -> Monday
        return addDays(date, 2);
    } else if (dayOfWeek === 5) { // Friday -> Monday of next week
        return addDays(date, 3);
    } else { // Monday-Thursday -> next day
        return addDays(date, 1);
    }
}

/**
 * Get the previous workday (Monday-Friday) from a given date.
 * If the current day is Monday, returns Friday of the previous week.
 */
export function getPreviousWorkday(date: Date): Date {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    if (dayOfWeek === 0) { // Sunday -> Friday
        return addDays(date, -2);
    } else if (dayOfWeek === 6) { // Saturday -> Friday
        return addDays(date, -1);
    } else if (dayOfWeek === 1) { // Monday -> Friday of previous week
        return addDays(date, -3);
    } else { // Tuesday-Friday -> previous day
        return addDays(date, -1);
    }
}
