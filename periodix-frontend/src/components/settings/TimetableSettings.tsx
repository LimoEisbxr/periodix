import { useEffect, useMemo, useState, useCallback } from 'react';
import {
    api,
    getLessonColors,
    getUserPreferences,
    updateUserPreferences,
} from '../../api';
import type { Lesson, LessonColors, TimetableResponse } from '../../types';
import { startOfWeek, addDays, fmtLocal } from '../../utils/dates';

type SubjectKey = string; // su[0].name or activityType fallback

const STORAGE_KEY = 'periodix:hiddenSubjects:self';
const LEGACY_KEY = 'hiddenSubjects';

function getSubjectKey(l: Lesson): SubjectKey {
    return l.su?.[0]?.name ?? l.activityType ?? '';
}

function loadHiddenSet(): Set<SubjectKey> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return new Set(JSON.parse(raw));
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
            // migrate once
            localStorage.setItem(STORAGE_KEY, legacy);
            return new Set(JSON.parse(legacy));
        }
    } catch {
        /* ignore */
    }
    return new Set();
}

function persistHiddenSet(set: Set<SubjectKey>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
        // Notify listeners (e.g., Timetable) that hidden subjects changed
        try {
            window.dispatchEvent(new Event('periodix:hiddenSubjects:changed'));
        } catch {
            /* ignore */
        }
    } catch {
        /* ignore */
    }
}

export default function TimetableSettings({
    token,
    isVisible,
}: {
    token: string;
    isVisible: boolean;
}) {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [lessonColors, setLessonColors] = useState<LessonColors>({});
    const [hidden, setHidden] = useState<Set<SubjectKey>>(() =>
        loadHiddenSet()
    );
    const [, setSyncing] = useState(false);
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const [lastSyncedHidden, setLastSyncedHidden] =
        useState<Set<SubjectKey> | null>(null);
    const [dirty, setDirty] = useState(false);

    // Load current week's timetable when visible; also fetch server preferences and merge
    useEffect(() => {
        if (!isVisible) return;
        const weekStart = startOfWeek(new Date());
        const start = fmtLocal(weekStart);
        const end = fmtLocal(addDays(weekStart, 6));
        setLoading(true);
        setError(null);
        Promise.all([
            api<TimetableResponse>(
                `/api/timetable/me?start=${start}&end=${end}`,
                { token }
            ),
            getLessonColors(token).catch(() => ({ colors: {}, offsets: {} })),
            getUserPreferences(token).catch(() => null),
        ])
            .then(([tt, colors, prefs]) => {
                const payload = Array.isArray(tt?.payload)
                    ? (tt.payload as Lesson[])
                    : [];
                setLessons(payload);
                setLessonColors(colors.colors || {});
                if (prefs && Array.isArray(prefs.hiddenSubjects)) {
                    const serverSet = new Set<SubjectKey>(prefs.hiddenSubjects);
                    setLastSyncedHidden(serverSet);
                    // Merge with local cache but don't mark as dirty to avoid immediate save on open
                    const merged = new Set(loadHiddenSet());
                    for (const s of prefs.hiddenSubjects) merged.add(s);
                    setHidden(merged);
                    persistHiddenSet(merged); // Keep local in sync for timetable filtering
                }
            })
            .catch((e: unknown) => {
                setError(
                    e instanceof Error ? e.message : 'Failed to load timetable'
                );
            })
            .finally(() => {
                setLoading(false);
                setPrefsLoaded(true);
            });
    }, [token, isVisible]);

    // Sync with external storage changes (e.g., open in two tabs)
    useEffect(() => {
        const handler = (ev: StorageEvent) => {
            if (ev.key === STORAGE_KEY) {
                setHidden(loadHiddenSet());
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    // Build subject list with counts
    const subjects = useMemo(() => {
        const map = new Map<SubjectKey, { key: SubjectKey; count: number }>();
        for (const l of lessons) {
            const key = getSubjectKey(l);
            if (!key) continue;
            const entry = map.get(key) || { key, count: 0 };
            entry.count += 1;
            map.set(key, entry);
        }
        let arr = Array.from(map.values());
        if (query.trim()) {
            const q = query.toLowerCase();
            arr = arr.filter((s) => s.key.toLowerCase().includes(q));
        }
        // sort: hidden first (for quick unhide), then by count desc, then by name
        arr.sort((a, b) => {
            const ah = hidden.has(a.key) ? 1 : 0;
            const bh = hidden.has(b.key) ? 1 : 0;
            if (ah !== bh) return bh - ah; // hidden first
            if (b.count !== a.count) return b.count - a.count;
            return a.key.localeCompare(b.key);
        });
        return arr;
    }, [lessons, query, hidden]);

    // Helper to compare sets
    const setsEqual = useCallback(
        (a: Set<string> | null, b: Set<string> | null) => {
            if (!a && !b) return true;
            if (!a || !b) return false;
            if (a.size !== b.size) return false;
            for (const v of a) if (!b.has(v)) return false;
            return true;
        },
        []
    );

    // Debounced server sync for hidden subjects — only after user-made changes
    useEffect(() => {
        if (!isVisible || !prefsLoaded || !dirty) return;
        // If no change vs last synced, clear dirty and skip
        if (setsEqual(hidden, lastSyncedHidden)) {
            setDirty(false);
            return;
        }
        const t = setTimeout(() => {
            setSyncing(true);
            const arr = Array.from(hidden);
            updateUserPreferences(token, { hiddenSubjects: arr })
                .then(() => {
                    setLastSyncedHidden(new Set(hidden));
                    setDirty(false);
                })
                .catch(() => {
                    // Best-effort only; keep dirty so we can retry on next change/open
                })
                .finally(() => setSyncing(false));
        }, 500);
        return () => clearTimeout(t);
    }, [
        hidden,
        token,
        isVisible,
        prefsLoaded,
        dirty,
        lastSyncedHidden,
        setsEqual,
    ]);

    const toggle = useCallback((key: SubjectKey) => {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            persistHiddenSet(next);
            return next;
        });
        setDirty(true);
    }, []);

    const selectAll = () => {
        const next = new Set(subjects.map((s) => s.key));
        setHidden(next);
        persistHiddenSet(next);
        setDirty(true);
    };
    const clearAll = () => {
        const next = new Set<SubjectKey>();
        setHidden(next);
        persistHiddenSet(next);
        setDirty(true);
    };

    if (!isVisible) return null;
    if (loading && !lessons.length)
        return (
            <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                Loading timetable…
            </div>
        );
    if (error)
        return (
            <div className="p-6 text-center text-red-600 dark:text-red-400">
                {error}
            </div>
        );

    const totalHidden = hidden.size;

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    Timetable Settings
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Hide subjects you don’t want to see on your timetable.
                    Changes apply instantly.
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                        Search subjects
                    </label>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type to filter…"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={clearAll}
                        className="px-3 py-2 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-medium"
                    >
                        Show all
                    </button>
                    <button
                        onClick={selectAll}
                        className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                    >
                        Hide all
                    </button>
                </div>
            </div>

            {/* Hidden summary */}
            <div className="text-sm text-slate-600 dark:text-slate-400">
                {totalHidden > 0
                    ? `${totalHidden} subject${
                          totalHidden === 1 ? '' : 's'
                      } hidden`
                    : 'No subjects hidden'}
            </div>

            {/* Subject grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {subjects.length === 0 && (
                    <div className="text-slate-600 dark:text-slate-400">
                        No subjects found.
                    </div>
                )}
                {subjects.map(({ key, count }) => {
                    const isHidden = hidden.has(key);
                    const color = lessonColors[key];
                    return (
                        <button
                            key={key}
                            onClick={() => toggle(key)}
                            className={`group relative flex items-center justify-between gap-3 rounded-xl border p-3 transition shadow-sm hover:shadow-md text-left ${
                                isHidden
                                    ? 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="h-6 w-6 rounded-md ring-1 ring-slate-900/10 dark:ring-white/10 flex items-center justify-center text-[10px] font-bold"
                                    style={{
                                        background:
                                            color ||
                                            'linear-gradient(135deg, rgba(99,102,241,0.7), rgba(168,85,247,0.7))',
                                        color: '#fff',
                                    }}
                                    aria-hidden
                                >
                                    {key.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {key}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {count} lesson{count === 1 ? '' : 's'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                        isHidden
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    }`}
                                >
                                    {isHidden ? 'Hidden' : 'Visible'}
                                </span>
                            </div>
                            <div className="absolute inset-0 rounded-xl pointer-events-none group-hover:ring-1 ring-indigo-400/50" />
                        </button>
                    );
                })}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
                Tip: You can change this any time. We use your subject names to
                hide matching lessons across weeks.
            </div>
        </div>
    );
}
