import { useState, useEffect } from 'react';
import type { FC } from 'react';

interface Activity {
    id: string;
    type: string;
    feature: string;
    timestamp: string;
    details: any;
}

interface UserDetails {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
    createdAt: string;
    _count: {
        activity: number;
    };
    activity: Activity[];
}

export const UserInsightModal: FC<{
    userId: string;
    onClose: () => void;
}> = ({ userId, onClose }) => {
    const [user, setUser] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'activity' | 'stats'>(
        'activity',
    );

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`/api/analytics/user/${userId}`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                const data = await res.json();
                setUser(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [userId]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 flex flex-col items-center gap-4 shadow-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Hydrating Profile...
                    </p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
            <div
                className="w-full max-w-2xl bg-white dark:bg-slate-900/90 rounded-[2.5rem] shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Profile Section */}
                <div className="relative pt-8 lg:pt-12 pb-6 lg:pb-8 px-6 lg:px-8 bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent">
                    <button
                        onClick={onClose}
                        className="absolute top-4 lg:top-6 right-4 lg:right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-[1.5rem] lg:rounded-[2rem] bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-2xl lg:text-3xl font-black shadow-xl mb-4 ring-4 ring-white dark:ring-slate-900 ring-offset-4 ring-offset-indigo-500/10">
                            {user.displayName[0]}
                        </div>
                        <h2 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            {user.displayName}
                        </h2>
                        <p className="text-xs lg:text-sm font-black text-indigo-500 uppercase tracking-widest mt-1">
                            @{user.username}
                        </p>

                        <div className="flex gap-2 mt-4 lg:mt-6">
                            <span className="px-3 lg:px-4 py-1 lg:py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] lg:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {user.role}
                            </span>
                            <span className="px-3 lg:px-4 py-1 lg:py-1.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full text-[9px] lg:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border border-indigo-500/20">
                                {user._count.activity} Events
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 lg:px-8 gap-6 lg:gap-8">
                    {[
                        { id: 'activity', label: 'Activity', icon: '⚡' },
                        { id: 'stats', label: 'Stats', icon: '📊' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-3 lg:pb-4 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative ${
                                activeTab === tab.id
                                    ? 'text-indigo-500'
                                    : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
                            }`}
                        >
                            <span className="mr-1.5 lg:mr-2">{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-full animate-in slide-in-from-bottom-1" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-5 lg:py-6 scroll-area-native">
                    {activeTab === 'activity' ? (
                        <div className="space-y-3 lg:space-y-4">
                            {user.activity.length > 0 ? (
                                user.activity.map((a) => (
                                    <div
                                        key={a.id}
                                        className="p-4 lg:p-5 rounded-[1.5rem] lg:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 transition-all group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] lg:text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                        {a.type}
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                    <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {a.feature}
                                                    </span>
                                                </div>
                                                <p className="text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-200">
                                                    {a.type === 'PAGE_VIEW'
                                                        ? `Visited ${a.feature}`
                                                        : `Interacted with ${a.feature}`}
                                                </p>
                                            </div>
                                            <span className="text-[9px] lg:text-[10px] font-black text-slate-400 dark:text-slate-600 tabular-nums text-right">
                                                {new Date(
                                                    a.timestamp,
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 lg:py-12 flex flex-col items-center text-center opacity-50">
                                    <div className="text-3xl lg:text-4xl mb-2">
                                        🧊
                                    </div>
                                    <p className="text-[10px] lg:text-xs font-black uppercase tracking-widest">
                                        No signals detected
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 lg:gap-4">
                            <div className="p-4 lg:p-6 rounded-[1.5rem] lg:rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                                <p className="text-[9px] lg:text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                                    Engagement
                                </p>
                                <p className="text-xl lg:text-2xl font-black text-indigo-700 dark:text-indigo-300">
                                    High
                                </p>
                            </div>
                            <div className="p-4 lg:p-6 rounded-[1.5rem] lg:rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                                <p className="text-[9px] lg:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">
                                    Status
                                </p>
                                <p className="text-xl lg:text-2xl font-black text-emerald-700 dark:text-emerald-300">
                                    Active
                                </p>
                            </div>
                            <div className="p-4 lg:p-6 rounded-[1.5rem] lg:rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 col-span-2">
                                <p className="text-[9px] lg:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                                    Member Since
                                </p>
                                <p className="text-base lg:text-lg font-black text-slate-700 dark:text-slate-200">
                                    {new Date(
                                        user.createdAt,
                                    ).toLocaleDateString(undefined, {
                                        month: 'long',
                                        year: 'numeric',
                                        day: 'numeric',
                                    })}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 lg:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <button
                        onClick={onClose}
                        className="w-full py-3 lg:py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-[0.2em] hover:scale-[0.98] transition-all shadow-xl shadow-slate-900/10"
                    >
                        Dismiss Analysis
                    </button>
                </div>
            </div>
        </div>
    );
};
