import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import type { User } from '../../types';

interface Tab {
    id: string;
    label: string;
}

interface TabNavigationProps {
    user: User;
    activeTab: string;
    onTabChange: (tabId: string) => void;
    isMobile: boolean;
}

export default function TabNavigation({
    user,
    activeTab,
    onTabChange,
    isMobile,
}: TabNavigationProps) {
    const getAvailableTabs = (): Tab[] => {
        if (user.isAdmin) {
            return [
                { id: 'access', label: 'Access' },
                { id: 'users', label: 'User Management' },
                { id: 'global', label: 'Global Settings' },
                { id: 'analytics', label: 'Analytics' },
            ];
        }
        if (user.isUserManager) {
            return [
                { id: 'nickname', label: 'Profile' },
                { id: 'sharing', label: 'Personal Sharing Settings' },
                { id: 'notifications', label: 'Notification Settings' },
                { id: 'access', label: 'Access' },
                { id: 'analytics', label: 'Analytics' },
            ];
        }
        return [
            { id: 'nickname', label: 'Profile' },
            { id: 'sharing', label: 'Personal Sharing Settings' },
            { id: 'notifications', label: 'Notification Settings' },
        ];
    };

    const availableTabs = getAvailableTabs();

    // Mobile specific logic
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rowRef = useRef<HTMLDivElement | null>(null);
    const [centerTabs, setCenterTabs] = useState(false);

    useLayoutEffect(() => {
        if (!isMobile) return;
        const measure = () => {
            if (!containerRef.current || !rowRef.current) return;
            const needsScroll =
                rowRef.current.scrollWidth > containerRef.current.clientWidth;
            setCenterTabs(!needsScroll);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isMobile, availableTabs.length]);

    useEffect(() => {
        if (!isMobile) return;
        const t = window.setTimeout(() => {
            if (!containerRef.current || !rowRef.current) return;
            const needsScroll =
                rowRef.current.scrollWidth > containerRef.current.clientWidth;
            setCenterTabs(!needsScroll);
        }, 60);
        return () => window.clearTimeout(t);
    }, [isMobile, availableTabs.length]);

    const baseTabClasses =
        'flex-shrink-0 px-4 py-3 rounded-lg text-xs font-medium transition-colors duration-150 whitespace-nowrap min-w-[58px]';
    const activeClasses =
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-sm border border-indigo-200 dark:border-indigo-700';
    const inactiveClasses =
        'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 border border-transparent';

    if (isMobile) {
        return (
            <div
                ref={containerRef}
                className="overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ scrollPaddingInline: '12px' }}
            >
                <style>{`.scrollbar-none::-webkit-scrollbar { display: none; }`}</style>
                <div
                    ref={rowRef}
                    className={`flex items-stretch gap-2 min-w-max px-3 py-1 select-none ${
                        centerTabs ? 'justify-center' : ''
                    }`}
                >
                    {!centerTabs && (
                        <div className="shrink-0 w-[2px]" aria-hidden="true" />
                    )}
                    {availableTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`${baseTabClasses} ${
                                activeTab === tab.id
                                    ? activeClasses
                                    : inactiveClasses
                            }`}
                        >
                            <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex-shrink-0">
                                    {tab.id === 'nickname' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                    )}
                                    {tab.id === 'sharing' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                                            />
                                        </svg>
                                    )}
                                    {tab.id === 'notifications' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                            <path d="m13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                    )}
                                    {tab.id === 'users' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                                            />
                                        </svg>
                                    )}
                                    {tab.id === 'access' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                            />
                                        </svg>
                                    )}
                                    {tab.id === 'global' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                            />
                                        </svg>
                                    )}
                                    {tab.id === 'analytics' && (
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M4 19h16M4 15h10M4 11h6M4 7h2"
                                            />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                    {!centerTabs && (
                        <div className="shrink-0 w-[2px]" aria-hidden="true" />
                    )}
                </div>
            </div>
        );
    }

    // Desktop layout
    return (
        <div className="space-y-1">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Navigation
            </h3>
            <nav className="space-y-1">
                {availableTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border ${
                            activeTab === tab.id
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-sm border-indigo-200 dark:border-indigo-700'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 border-transparent'
                        }`}
                    >
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                {tab.id === 'nickname' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                )}
                                {tab.id === 'sharing' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                                        />
                                    </svg>
                                )}
                                {tab.id === 'notifications' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                        <path d="m13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                )}
                                {tab.id === 'users' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                                        />
                                    </svg>
                                )}
                                {tab.id === 'access' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                        />
                                    </svg>
                                )}
                                {tab.id === 'global' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                        />
                                    </svg>
                                )}
                                {tab.id === 'analytics' && (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M4 19h16M4 15h10M4 11h6M4 7h2"
                                        />
                                    </svg>
                                )}
                            </div>
                            <span className="truncate">{tab.label}</span>
                        </div>
                    </button>
                ))}
            </nav>
        </div>
    );
}
