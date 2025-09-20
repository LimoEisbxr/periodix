import { useState, useEffect, useCallback } from 'react';
import {
    getLessonColors,
    setLessonColor,
    removeLessonColor,
    getDefaultLessonColors,
} from '../api';
import type { LessonColors, LessonOffsets } from '../types';

interface UseLessonColorsOptions {
    token: string;
    viewingUserId?: string;
}

interface UseLessonColorsReturn {
    lessonColors: LessonColors;
    defaultLessonColors: LessonColors;
    lessonOffsets: LessonOffsets;
    setLessonColors: (colors: LessonColors) => void;
    setDefaultLessonColors: (colors: LessonColors) => void;
    setLessonOffsets: (offsets: LessonOffsets) => void;
    updateLessonColor: (
        lessonName: string,
        color: string,
        offset?: number
    ) => Promise<void>;
    removeLessonColorSetting: (lessonName: string) => Promise<void>;
    loadLessonColors: () => Promise<void>;
    colorError: string | null;
    clearColorError: () => void;
}

/**
 * Hook for managing lesson colors and offsets
 */
export function useLessonColors({
    token,
    viewingUserId,
}: UseLessonColorsOptions): UseLessonColorsReturn {
    const [lessonColors, setLessonColors] = useState<LessonColors>({});
    const [defaultLessonColors, setDefaultLessonColors] =
        useState<LessonColors>({});
    const [lessonOffsets, setLessonOffsets] = useState<LessonOffsets>({});
    const [colorError, setColorError] = useState<string | null>(null);

    const clearColorError = useCallback(() => {
        setColorError(null);
    }, []);

    const loadLessonColors = useCallback(async () => {
        try {
            setColorError(null);

            // Load user-specific colors
            const userColors = await getLessonColors(token);
            if (userColors.colors) {
                setLessonColors(userColors.colors);
            }
            if (userColors.offsets) {
                setLessonOffsets(userColors.offsets);
            }

            // Load default colors (admin-set defaults)
            const defaults = await getDefaultLessonColors(token);
            if (defaults && typeof defaults === 'object') {
                setDefaultLessonColors(defaults);
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load lesson colors';
            setColorError(message);
            console.error('Failed to load lesson colors:', error);
        }
    }, [token, viewingUserId]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateLessonColor = useCallback(
        async (lessonName: string, color: string, offset: number = 0.5) => {
            try {
                setColorError(null);

                await setLessonColor(
                    token,
                    lessonName,
                    color,
                    viewingUserId,
                    offset
                );

                // Update local state
                setLessonColors((prev) => ({
                    ...prev,
                    [lessonName]: color,
                }));

                setLessonOffsets((prev) => ({
                    ...prev,
                    [lessonName]: offset,
                }));
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to update lesson color';
                setColorError(message);
                throw error; // Re-throw so caller can handle if needed
            }
        },
        [token, viewingUserId]
    );

    const removeLessonColorSetting = useCallback(
        async (lessonName: string) => {
            try {
                setColorError(null);

                await removeLessonColor(token, lessonName, viewingUserId);

                // Update local state
                setLessonColors((prev) => {
                    const next = { ...prev };
                    delete next[lessonName];
                    return next;
                });

                setLessonOffsets((prev) => {
                    const next = { ...prev };
                    delete next[lessonName];
                    return next;
                });
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to remove lesson color';
                setColorError(message);
                throw error; // Re-throw so caller can handle if needed
            }
        },
        [token, viewingUserId]
    );

    // Load lesson colors on mount and when dependencies change
    useEffect(() => {
        loadLessonColors();
    }, [loadLessonColors]);

    return {
        lessonColors,
        defaultLessonColors,
        lessonOffsets,
        setLessonColors,
        setDefaultLessonColors,
        setLessonOffsets,
        updateLessonColor,
        removeLessonColorSetting,
        loadLessonColors,
        colorError,
        clearColorError,
    };
}
