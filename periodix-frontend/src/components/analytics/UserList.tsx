import type { FC } from 'react';

interface User {
    userId: string;
    username: string;
    displayName: string | null;
    activityCount: number;
    lastActivity?: Date;
}

interface UserListProps {
    users: User[];
    title: string;
    icon: string;
    emptyMessage?: string;
    maxItems?: number;
    onUserClick?: (userId: string) => void;
    showRank?: boolean;
}

/**
 * Compact, scrollable user list component
 */
export const UserList: FC<UserListProps> = ({
    users,
    title,
    icon,
    emptyMessage = 'No users to display',
    maxItems = 5,
    onUserClick,
    showRank = true,
}) => {
    const displayUsers = users.slice(0, maxItems);

    const getRankBadge = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return `${index + 1}`;
    };

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {title}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                    {users.length} total
                </span>
            </div>

            {displayUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {emptyMessage}
                </div>
            ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[280px] overflow-y-auto">
                    {displayUsers.map((user, index) => (
                        <button
                            key={user.userId}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                            onClick={() => onUserClick?.(user.userId)}
                        >
                            {showRank && (
                                <span className="w-6 text-center text-sm flex-shrink-0">
                                    {getRankBadge(index)}
                                </span>
                            )}

                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                {(user.displayName || user.username)
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {user.displayName || user.username}
                                </p>
                                {user.displayName && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        @{user.username}
                                    </p>
                                )}
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {user.activityCount}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    activities
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {users.length > maxItems && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        +{users.length - maxItems} more users
                    </p>
                </div>
            )}
        </div>
    );
};

export default UserList;
