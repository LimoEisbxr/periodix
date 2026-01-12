import { addDays, fmtLocal } from './dates';
import type { AbsencePreset, DateRange } from '../types';

const SCHOOL_YEAR_START_MONTH = 7; // August (0-indexed)
const DEFAULT_ALL_TIME_START = '2010-01-01'; // Reasonable lower bound for "all time" queries

export const ABSENCE_PRESET_ORDER: AbsencePreset[] = [
    'thisMonth',
    'schoolYear',
    'allTime',
];

export const ABSENCE_PRESET_LABELS: Record<AbsencePreset, string> = {
    thisMonth: 'This month',
    schoolYear: 'This school year',
    allTime: 'All time',
};

export function getAbsencePresetRange(
    preset: AbsencePreset,
    referenceDate = new Date()
): DateRange {
    const now = new Date(referenceDate);
    // Extend end date to 60 days in the future to include future absences
    const end = fmtLocal(addDays(now, 60));

    if (preset === 'thisMonth') {
        const start = fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1));
        return { start, end };
    }

    if (preset === 'schoolYear') {
        const schoolYearStartYear =
            now.getMonth() >= SCHOOL_YEAR_START_MONTH
                ? now.getFullYear()
                : now.getFullYear() - 1;
        const start = fmtLocal(
            new Date(schoolYearStartYear, SCHOOL_YEAR_START_MONTH, 1)
        );
        return { start, end };
    }

    if (preset === 'allTime') {
        return { start: DEFAULT_ALL_TIME_START, end };
    }

    const fallbackStart = fmtLocal(addDays(now, -30));
    return { start: fallbackStart, end };
}
