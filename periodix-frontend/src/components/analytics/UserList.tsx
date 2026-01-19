import { useState } from 'react';

interface User {
    id: string;
    username: string;
    displayName: string;
    _count?: { activity: number };
}

export function UserList({
    users,
    title,
    onUserClick,
}: {
    users: User[];
    title: string;
    onUserClick: (id: string) => void;
}) {
    const [search, setSearch] = useState('');
    const filteredUsers = users.filter(
        (u) =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.displayName.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
            <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400">
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
                                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                            </svg>
                        </div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-sm">
                            {title}
                        </h3>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {filteredUsers.length} Users
                    </span>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search community..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-400/20 transition-all font-medium text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-area-native">
                {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, index) => (
                        <button
                            key={user.id}
                            onClick={() => onUserClick(user.id)}
                            className="w-full group px-4 py-3 rounded-2xl flex items-center gap-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-sm transition-transform group-hover:scale-110">
                                    {user.displayName?.[0] ||
                                        user.username?.[0] ||
                                        '?'}
                                </div>
                                {index < 3 && !search && (
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-amber-500/20">
                                        {index + 1}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 text-left min-w-0">
                                <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                    {user.displayName}
                                </div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                                    @{user.username}
                                </div>
                            </div>

                            {user._count?.activity !== undefined && (
                                <div className="text-right">
                                    <div className="text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums">
                                        {user._count.activity}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-tighter">
                                        actions
                                    </div>
                                </div>
                            )}

                            <div className="text-slate-300 dark:text-slate-700 transform translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4 ring-1 ring-slate-100 dark:ring-slate-800">
                            <svg
                                className="w-8 h-8"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                            </svg>
                        </div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                            No Users Found
                        </h4>
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
                            Adjust your search to find more community members
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
