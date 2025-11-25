import { useState, useEffect, useCallback } from 'react';
import type { User } from '../../types';
import {
    listAllUsers,
    deleteUser,
    grantUserManagerStatus,
    revokeUserManagerStatus,
    adminUpdateUserDisplayName,
} from '../../api';

interface UserManagementProps {
    token: string;
    user: User;
    isVisible: boolean;
}

interface ManageableUser {
    id: string;
    username: string;
    displayName: string | null;
    isUserManager: boolean;
}

export default function UserManagement({
    token,
    user,
    isVisible,
}: UserManagementProps) {
    const [users, setUsers] = useState<ManageableUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operationLoading, setOperationLoading] = useState<string | null>(
        null
    );
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingNickname, setEditingNickname] = useState<string>('');

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listAllUsers(token);
            // Filter out the current admin user from the list
            setUsers(data.users.filter((u) => u.id !== user.id));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [token, user.id]);

    // Load users when component becomes visible
    useEffect(() => {
        if (!isVisible) return;
        loadUsers();
    }, [isVisible, token, loadUsers]);

    const handleDeleteUser = async (userId: string, username: string) => {
        if (
            !confirm(
                `Are you sure you want to delete user "${username}"? This action cannot be undone.`
            )
        ) {
            return;
        }

        setOperationLoading(userId);
        setError(null);
        try {
            await deleteUser(token, userId);
            setUsers(users.filter((u) => u.id !== userId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete user');
        } finally {
            setOperationLoading(null);
        }
    };

    const handleToggleUserManager = async (
        userId: string,
        currentStatus: boolean
    ) => {
        setOperationLoading(userId);
        setError(null);
        try {
            if (currentStatus) {
                await revokeUserManagerStatus(token, userId);
            } else {
                await grantUserManagerStatus(token, userId);
            }
            // Update the user in the local state
            setUsers(
                users.map((u) =>
                    u.id === userId
                        ? { ...u, isUserManager: !currentStatus }
                        : u
                )
            );
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update user manager status'
            );
        } finally {
            setOperationLoading(null);
        }
    };

    const handleStartEditNickname = (managedUser: ManageableUser) => {
        setEditingUserId(managedUser.id);
        setEditingNickname(managedUser.displayName || '');
    };

    const handleCancelEditNickname = () => {
        setEditingUserId(null);
        setEditingNickname('');
    };

    const handleSaveNickname = async (userId: string) => {
        setOperationLoading(userId);
        setError(null);
        try {
            const displayName = editingNickname.trim() || null;
            const result = await adminUpdateUserDisplayName(
                token,
                userId,
                displayName
            );
            // Update the user in the local state
            setUsers(
                users.map((u) =>
                    u.id === userId
                        ? { ...u, displayName: result.user.displayName }
                        : u
                )
            );
            setEditingUserId(null);
            setEditingNickname('');
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to update nickname'
            );
        } finally {
            setOperationLoading(null);
        }
    };

    if (!user.isAdmin) {
        return null;
    }

    // Remove conditional rendering since we handle visibility in parent

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-slate-600 dark:text-slate-400">
                    Loading users...
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    User Management
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage user accounts and permissions
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-300">
                        {error}
                    </p>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        All Users ({users.length})
                    </h4>
                </div>

                {users.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                        <p className="text-slate-500 dark:text-slate-400">
                            No other users found
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {users.map((managedUser) => (
                            <div key={managedUser.id} className="px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-3">
                                            {editingUserId ===
                                            managedUser.id ? (
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="text"
                                                        value={editingNickname}
                                                        onChange={(e) =>
                                                            setEditingNickname(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Enter nickname (leave empty to clear)"
                                                        className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                'Enter'
                                                            )
                                                                handleSaveNickname(
                                                                    managedUser.id
                                                                );
                                                            if (
                                                                e.key ===
                                                                'Escape'
                                                            )
                                                                handleCancelEditNickname();
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            handleSaveNickname(
                                                                managedUser.id
                                                            )
                                                        }
                                                        disabled={
                                                            operationLoading ===
                                                            managedUser.id
                                                        }
                                                        className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        {operationLoading ===
                                                        managedUser.id
                                                            ? 'Saving...'
                                                            : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={
                                                            handleCancelEditNickname
                                                        }
                                                        disabled={
                                                            operationLoading ===
                                                            managedUser.id
                                                        }
                                                        className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="cursor-pointer group"
                                                    onClick={() =>
                                                        handleStartEditNickname(
                                                            managedUser
                                                        )
                                                    }
                                                    title="Click to edit nickname"
                                                >
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                        {managedUser.displayName ||
                                                            managedUser.username}
                                                        <svg
                                                            className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                                            />
                                                        </svg>
                                                    </p>
                                                    {managedUser.displayName && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            @
                                                            {
                                                                managedUser.username
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {managedUser.isUserManager &&
                                                editingUserId !==
                                                    managedUser.id && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                                        User Manager
                                                    </span>
                                                )}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {/* Toggle User Manager Status */}
                                        <button
                                            onClick={() =>
                                                handleToggleUserManager(
                                                    managedUser.id,
                                                    managedUser.isUserManager
                                                )
                                            }
                                            disabled={
                                                operationLoading ===
                                                managedUser.id
                                            }
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                                managedUser.isUserManager
                                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {operationLoading ===
                                            managedUser.id ? (
                                                <div className="flex items-center space-x-1">
                                                    <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                                                    <span>Loading...</span>
                                                </div>
                                            ) : managedUser.isUserManager ? (
                                                'Demote'
                                            ) : (
                                                'Promote'
                                            )}
                                        </button>

                                        {/* Delete User */}
                                        <button
                                            onClick={() =>
                                                handleDeleteUser(
                                                    managedUser.id,
                                                    managedUser.displayName ||
                                                        managedUser.username
                                                )
                                            }
                                            disabled={
                                                operationLoading ===
                                                managedUser.id
                                            }
                                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {operationLoading ===
                                            managedUser.id ? (
                                                <div className="flex items-center space-x-1">
                                                    <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                                                    <span>Deleting...</span>
                                                </div>
                                            ) : (
                                                'Delete'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end">
                <button
                    onClick={loadUsers}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
        </div>
    );
}
