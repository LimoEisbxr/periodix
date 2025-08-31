import { useState, useEffect, useRef, useCallback } from 'react';
import type { User, NotificationSettings, AdminNotificationSettings } from '../types';
import {
    getSharingSettings,
    updateSharingEnabled,
    shareWithUser,
    stopSharingWithUser,
    updateGlobalSharing,
    searchUsersToShare,
    api,
    type SharingSettings,
    updateUserDisplayName,
    updateMyDisplayName,
    listWhitelist,
    addWhitelistRule,
    deleteWhitelistRule,
    type WhitelistRule,
    listAccessRequests,
    acceptAccessRequest,
    declineAccessRequest,
    type AccessRequest,
    userManagerListWhitelist,
    userManagerAddWhitelistRule,
    userManagerDeleteWhitelistRule,
    userManagerListAccessRequests,
    userManagerAcceptAccessRequest,
    userManagerDeclineAccessRequest,
    grantUserManagerStatus,
    revokeUserManagerStatus,
    getNotificationSettings,
    updateNotificationSettings,
    getAdminNotificationSettings,
    updateAdminNotificationSettings,
} from '../api';
import { 
    requestNotificationPermission, 
    getNotificationPermission, 
    isNotificationSupported, 
} from '../utils/notifications';

export default function SettingsModal({
    token,
    user,
    isOpen,
    onClose,
    onUserUpdate,
}: {
    token: string;
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUserUpdate?: (u: User) => void;
}) {
    // Close/open animation state with enter transition
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const ANIM_MS = 200;
    useEffect(() => {
        let t: number | undefined;
        let raf1: number | undefined;
        let raf2: number | undefined;
        if (isOpen) {
            if (!showModal) setShowModal(true);
            // Start hidden, then two RAFs to ensure layout is applied before transition
            setIsVisible(false);
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setIsVisible(true));
            });
        } else if (showModal) {
            // Trigger exit transition then unmount after duration
            setIsVisible(false);
            t = window.setTimeout(() => {
                setShowModal(false);
            }, ANIM_MS);
        }
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, showModal]);

    const [settings, setSettings] = useState<SharingSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<
        Array<{ id: string; username: string; displayName?: string }>
    >([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef<number | undefined>(undefined);

    // User management state for admin users
    const [users, setUsers] = useState<
        Array<{ id: string; username: string; displayName: string | null; isUserManager: boolean }>
    >([]);
    const [userManagementLoading, setUserManagementLoading] = useState(false);
    const [userManagementError, setUserManagementError] = useState<
        string | null
    >(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editDisplayName, setEditDisplayName] = useState('');

    // Self display name editing (regular users and admins editing their own name)
    const [myDisplayName, setMyDisplayName] = useState<string>(
        user.displayName ?? ''
    );
    const [savingMyName, setSavingMyName] = useState(false);
    const [myNameError, setMyNameError] = useState<string | null>(null);
    const [myNameSaved, setMyNameSaved] = useState(false);

    // Whitelist (admin) state — username only
    const [whitelist, setWhitelist] = useState<WhitelistRule[]>([]);
    const [wlValue, setWlValue] = useState('');
    const [wlLoading, setWlLoading] = useState(false);
    const [wlError, setWlError] = useState<string | null>(null);

    // Access requests (admin) state
    const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
    const [arLoading, setArLoading] = useState(false);
    const [arError, setArError] = useState<string | null>(null);

    // User-manager state (duplicate functionality for user-managers)
    const [umWhitelist, setUmWhitelist] = useState<WhitelistRule[]>([]);
    const [umWlValue, setUmWlValue] = useState('');
    const [umWlLoading, setUmWlLoading] = useState(false);
    const [umWlError, setUmWlError] = useState<string | null>(null);

    // User-manager access requests state
    const [umAccessRequests, setUmAccessRequests] = useState<AccessRequest[]>([]);
    const [umArLoading, setUmArLoading] = useState(false);
    const [umArError, setUmArError] = useState<string | null>(null);

    // User-manager status management state
    const [userManagerChanging, setUserManagerChanging] = useState<string | null>(null);
    const [showConfirmUserManager, setShowConfirmUserManager] = useState<{ userId: string; username: string; isGranting: boolean } | null>(null);

    // Notification settings state
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
    
    // Admin notification settings state
    const [adminNotificationSettings, setAdminNotificationSettings] = useState<AdminNotificationSettings | null>(null);
    const [adminNotificationLoading, setAdminNotificationLoading] = useState(false);
    const [adminNotificationError, setAdminNotificationError] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            const response = await api<{
                users: Array<{
                    id: string;
                    username: string;
                    displayName: string | null;
                    isUserManager: boolean;
                }>;
            }>('/api/admin/users', { token });
            setUsers(response.users);
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to load users'
            );
        } finally {
            setUserManagementLoading(false);
        }
    }, [token]);

    const deleteUser = async (userId: string) => {
        if (!confirm('Delete this user?')) return;
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            await api<{ ok: boolean }>(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                token,
            });
            await loadUsers();
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to delete user'
            );
        } finally {
            setUserManagementLoading(false);
        }
    };

    const startEditUser = (uId: string, currentName: string | null) => {
        setEditingUserId(uId);
        setEditDisplayName(currentName ?? '');
    };
    const cancelEditUser = () => {
        setEditingUserId(null);
        setEditDisplayName('');
    };
    const saveEditUser = async (uId: string) => {
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            const trimmed = editDisplayName.trim();
            const displayNameToSave = trimmed === '' ? null : trimmed;
            const result = await updateUserDisplayName(
                token,
                uId,
                displayNameToSave
            );
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === uId
                        ? { ...u, displayName: result.user.displayName }
                        : u
                )
            );
            cancelEditUser();
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to update user'
            );
        } finally {
            setUserManagementLoading(false);
        }
    };

    // Search for users to share with
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const results = await searchUsersToShare(token, searchQuery);
                setSearchResults(results.users);
            } catch (e) {
                console.error('Search failed:', e);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, token]);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSharingSettings(token);
            setSettings(data);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to load settings'
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    const loadWhitelistRules = useCallback(async () => {
        setWlLoading(true);
        setWlError(null);
        try {
            const res = await listWhitelist(token);
            setWhitelist(res.rules);
        } catch (e) {
            setWlError(
                e instanceof Error ? e.message : 'Failed to load whitelist'
            );
        } finally {
            setWlLoading(false);
        }
    }, [token]);

    const loadAccessRequests = useCallback(async () => {
        setArLoading(true);
        setArError(null);
        try {
            const res = await listAccessRequests(token);
            setAccessRequests(res.requests);
        } catch (e) {
            setArError(
                e instanceof Error ? e.message : 'Failed to load access requests'
            );
        } finally {
            setArLoading(false);
        }
    }, [token]);

    // User-manager callbacks
    const loadUserManagerWhitelist = useCallback(async () => {
        setUmWlLoading(true);
        setUmWlError(null);
        try {
            const wl = await userManagerListWhitelist(token);
            setUmWhitelist(wl.rules);
        } catch (e) {
            setUmWlError(
                e instanceof Error ? e.message : 'Failed to load whitelist'
            );
        } finally {
            setUmWlLoading(false);
        }
    }, [token]);

    const loadUserManagerAccessRequests = useCallback(async () => {
        setUmArLoading(true);
        setUmArError(null);
        try {
            const res = await userManagerListAccessRequests(token);
            setUmAccessRequests(res.requests);
        } catch (e) {
            setUmArError(
                e instanceof Error ? e.message : 'Failed to load access requests'
            );
        } finally {
            setUmArLoading(false);
        }
    }, [token]);

    const handleUserManagerAddRule = useCallback(
        async (value: string) => {
            setUmWlLoading(true);
            setUmWlError(null);
            try {
                await userManagerAddWhitelistRule(token, value);
                setUmWlValue('');
                await loadUserManagerWhitelist();
            } catch (e) {
                setUmWlError(
                    e instanceof Error ? e.message : 'Failed to add rule'
                );
            } finally {
                setUmWlLoading(false);
            }
        },
        [token, loadUserManagerWhitelist]
    );

    const handleUserManagerDeleteRule = useCallback(
        async (id: string) => {
            setUmWlLoading(true);
            setUmWlError(null);
            try {
                await userManagerDeleteWhitelistRule(token, id);
                await loadUserManagerWhitelist();
            } catch (e) {
                setUmWlError(
                    e instanceof Error ? e.message : 'Failed to delete rule'
                );
            } finally {
                setUmWlLoading(false);
            }
        },
        [token, loadUserManagerWhitelist]
    );

    const handleUserManagerAcceptAccessRequest = useCallback(
        async (id: string) => {
            setUmArLoading(true);
            setUmArError(null);
            try {
                await userManagerAcceptAccessRequest(token, id);
                setUmAccessRequests((prev) => prev.filter((r) => r.id !== id));
                // Reload whitelist to show the newly added user
                await loadUserManagerWhitelist();
            } catch (e) {
                setUmArError(
                    e instanceof Error ? e.message : 'Failed to accept request'
                );
            } finally {
                setUmArLoading(false);
            }
        },
        [token, loadUserManagerWhitelist]
    );

    const handleUserManagerDeclineAccessRequest = useCallback(
        async (id: string) => {
            setUmArLoading(true);
            setUmArError(null);
            try {
                await userManagerDeclineAccessRequest(token, id);
                setUmAccessRequests((prev) => prev.filter((r) => r.id !== id));
            } catch (e) {
                setUmArError(
                    e instanceof Error ? e.message : 'Failed to decline request'
                );
            } finally {
                setUmArLoading(false);
            }
        },
        [token]
    );

    const handleSaveMyDisplayName = useCallback(async () => {
        setSavingMyName(true);
        setMyNameError(null);
        setMyNameSaved(false);
        try {
            const trimmedName = myDisplayName.trim();
            const displayNameToSave = trimmedName === '' ? null : trimmedName;
            await updateMyDisplayName(token, displayNameToSave);
            
            // Update the user in the parent component
            if (onUserUpdate) {
                onUserUpdate({
                    ...user,
                    displayName: displayNameToSave,
                });
            }
            setMyNameSaved(true);
            setTimeout(() => setMyNameSaved(false), 3000);
        } catch (e) {
            setMyNameError(e instanceof Error ? e.message : 'Failed to update display name');
        } finally {
            setSavingMyName(false);
        }
    }, [token, myDisplayName, user, onUserUpdate]);

    const handleToggleSharing = async (enabled: boolean) => {
        if (!settings) return;
        try {
            await updateSharingEnabled(token, enabled);
            setSettings({ ...settings, sharingEnabled: enabled });
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to update sharing'
            );
        }
    };

    const handleShareWithUser = async (targetUser: {
        id: string;
        username: string;
        displayName?: string;
    }) => {
        if (!settings) return;
        try {
            await shareWithUser(token, targetUser.id);
            setSettings({
                ...settings,
                sharingWith: [...settings.sharingWith, targetUser],
            });
            setSearchQuery('');
            setSearchResults([]);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to share with user'
            );
        }
    };

    const handleStopSharing = async (userId: string) => {
        if (!settings) return;
        try {
            await stopSharingWithUser(token, userId);
            setSettings({
                ...settings,
                sharingWith: settings.sharingWith.filter(
                    (u) => u.id !== userId
                ),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to stop sharing');
        }
    };

    const handleToggleGlobalSharing = async (enabled: boolean) => {
        if (!settings) return;
        try {
            await updateGlobalSharing(token, enabled);
            setSettings({ ...settings, globalSharingEnabled: enabled });
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update global sharing'
            );
        }
    };

    const saveMyDisplayName = async () => {
        setMyNameError(null);
        setMyNameSaved(false);
        setSavingMyName(true);
        try {
            const trimmed = myDisplayName.trim();
            const nameToSave = trimmed === '' ? null : trimmed;
            const result = await updateMyDisplayName(token, nameToSave);
            if (onUserUpdate)
                onUserUpdate({ ...user, displayName: result.user.displayName });
            setMyDisplayName(result.user.displayName ?? '');
            setMyNameSaved(true);
        } catch (e) {
            setMyNameError(
                e instanceof Error ? e.message : 'Failed to update display name'
            );
        } finally {
            setSavingMyName(false);
        }
    };

    const handleAddWhitelistRule = useCallback(async () => {
        const v = wlValue.trim();
        if (!v) return;
        setWlLoading(true);
        setWlError(null);
        try {
            await addWhitelistRule(token, v);
            setWlValue('');
            await loadWhitelistRules();
        } catch (e) {
            setWlError(e instanceof Error ? e.message : 'Failed to add rule');
        } finally {
            setWlLoading(false);
        }
    }, [token, wlValue, loadWhitelistRules]);

    const handleDeleteWhitelistRule = useCallback(
        async (id: string) => {
            setWlLoading(true);
            setWlError(null);
            try {
                await deleteWhitelistRule(token, id);
                setWhitelist((prev) => prev.filter((r) => r.id !== id));
            } catch (e) {
                setWlError(
                    e instanceof Error ? e.message : 'Failed to delete rule'
                );
            } finally {
                setWlLoading(false);
            }
        },
        [token]
    );

    const handleAcceptAccessRequest = useCallback(
        async (id: string) => {
            setArLoading(true);
            setArError(null);
            try {
                await acceptAccessRequest(token, id);
                setAccessRequests((prev) => prev.filter((r) => r.id !== id));
                // Reload whitelist to show the newly added user
                await loadWhitelistRules();
            } catch (e) {
                setArError(
                    e instanceof Error ? e.message : 'Failed to accept request'
                );
            } finally {
                setArLoading(false);
            }
        },
        [token, loadWhitelistRules]
    );

    const handleDeclineAccessRequest = useCallback(
        async (id: string) => {
            setArLoading(true);
            setArError(null);
            try {
                await declineAccessRequest(token, id);
                setAccessRequests((prev) => prev.filter((r) => r.id !== id));
            } catch (e) {
                setArError(
                    e instanceof Error ? e.message : 'Failed to decline request'
                );
            } finally {
                setArLoading(false);
            }
        },
        [token]
    );

    // User-manager status management functions
    const handleGrantUserManager = useCallback(
        async (userId: string) => {
            setUserManagerChanging(userId);
            setUserManagementError(null);
            try {
                const result = await grantUserManagerStatus(token, userId);
                setUsers((prev) =>
                    prev.map((u) =>
                        u.id === userId ? { ...u, isUserManager: result.user.isUserManager } : u
                    )
                );
                setShowConfirmUserManager(null);
            } catch (e) {
                setUserManagementError(
                    e instanceof Error ? e.message : 'Failed to grant user manager status'
                );
            } finally {
                setUserManagerChanging(null);
            }
        },
        [token]
    );

    const handleRevokeUserManager = useCallback(
        async (userId: string) => {
            setUserManagerChanging(userId);
            setUserManagementError(null);
            try {
                const result = await revokeUserManagerStatus(token, userId);
                setUsers((prev) =>
                    prev.map((u) =>
                        u.id === userId ? { ...u, isUserManager: result.user.isUserManager } : u
                    )
                );
                setShowConfirmUserManager(null);
            } catch (e) {
                setUserManagementError(
                    e instanceof Error ? e.message : 'Failed to revoke user manager status'
                );
            } finally {
                setUserManagerChanging(null);
            }
        },
        [token]
    );

    // Notification settings functions
    const loadNotificationSettings = useCallback(async () => {
        setNotificationLoading(true);
        setNotificationError(null);
        try {
            const response = await getNotificationSettings(token);
            setNotificationSettings(response.settings);
        } catch (e) {
            setNotificationError(e instanceof Error ? e.message : 'Failed to load notification settings');
        } finally {
            setNotificationLoading(false);
        }
    }, [token]);

    const loadAdminNotificationSettings = useCallback(async () => {
        if (!user.isAdmin) return;
        setAdminNotificationLoading(true);
        setAdminNotificationError(null);
        try {
            const response = await getAdminNotificationSettings(token);
            setAdminNotificationSettings(response.settings);
        } catch (e) {
            setAdminNotificationError(e instanceof Error ? e.message : 'Failed to load admin notification settings');
        } finally {
            setAdminNotificationLoading(false);
        }
    }, [token, user.isAdmin]);

    const handleUpdateNotificationSettings = async (updates: Partial<NotificationSettings>) => {
        if (!notificationSettings) return;
        
        try {
            const response = await updateNotificationSettings(token, updates);
            setNotificationSettings(response.settings);
        } catch (e) {
            setNotificationError(e instanceof Error ? e.message : 'Failed to update notification settings');
        }
    };

    const handleUpdateAdminNotificationSettings = async (updates: Partial<AdminNotificationSettings>) => {
        if (!adminNotificationSettings) return;
        
        try {
            const response = await updateAdminNotificationSettings(token, updates);
            setAdminNotificationSettings(response.settings);
        } catch (e) {
            setAdminNotificationError(e instanceof Error ? e.message : 'Failed to update admin notification settings');
        }
    };

    const handleRequestNotificationPermission = async () => {
        try {
            const permission = await requestNotificationPermission();
            setNotificationPermission(permission);
            
            if (permission === 'granted') {
                // Enable browser notifications automatically when permission is granted
                await handleUpdateNotificationSettings({ browserNotificationsEnabled: true });
            }
        } catch (e) {
            setNotificationError(e instanceof Error ? e.message : 'Failed to request notification permission');
        }
    };

    // Load settings when modal opens (with stable callbacks)
    useEffect(() => {
        if (isOpen) {
            loadSettings();
            loadNotificationSettings();
            if (user.isAdmin) {
                loadUsers();
                loadAdminNotificationSettings();
                // Defer whitelist loading until settings fetched and enabled
            }
            setMyDisplayName(user.displayName ?? '');
            setMyNameSaved(false);
            setMyNameError(null);
        }
    }, [isOpen, user.isAdmin, user.displayName, loadSettings, loadUsers, loadNotificationSettings, loadAdminNotificationSettings]);

    // Load whitelist and access requests only when enabled in settings
    useEffect(() => {
        if (!isOpen) return;
        
        if (user.isAdmin) {
            // Admin loads admin-specific data
            if (settings?.whitelistEnabled) {
                loadWhitelistRules();
                loadAccessRequests();
            }
        } else if (user.isUserManager) {
            // User-manager loads user-manager-specific data
            if (settings?.whitelistEnabled) {
                loadUserManagerWhitelist();
                loadUserManagerAccessRequests();
            }
        }
    }, [isOpen, user.isAdmin, user.isUserManager, settings?.whitelistEnabled, loadWhitelistRules, loadAccessRequests, loadUserManagerWhitelist, loadUserManagerAccessRequests]);

    if (!showModal) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 will-change-opacity ${
                isVisible
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
            }`}
        >
            <div
                className={`w-full ${
                    user.isAdmin ? 'max-w-3xl' : 'max-w-lg'
                } bg-white/75 dark:bg-slate-800/80 backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10 rounded-lg shadow-xl max-h-[90vh] overflow-hidden transform transition-all duration-200 will-change-transform will-change-opacity ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                }`}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-inner ring-1 ring-white/20 dark:ring-black/20">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="text-white"
                            >
                                <path
                                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold leading-none text-slate-900 dark:text-slate-100">
                            Settings
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                    {user.isAdmin ? (
                        // Admin User Management Section
                        <>
                            {userManagementLoading ? (
                                <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                                    Loading users...
                                </div>
                            ) : userManagementError ? (
                                <div className="p-6 text-center text-red-600 dark:text-red-400">
                                    {userManagementError}
                                </div>
                            ) : (
                                <div className="p-6">
                                    {/* Global sharing control */}
                                    {settings && (
                                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-red-800 dark:text-red-200">
                                                        Global Sharing Control
                                                    </h4>
                                                    <p className="text-sm text-red-600 dark:text-red-300">
                                                        Disable all timetable
                                                        sharing for everyone
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            settings.globalSharingEnabled
                                                        }
                                                        onChange={(e) =>
                                                            handleToggleGlobalSharing(
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Admin Notification Settings */}
                                    {adminNotificationLoading ? (
                                        <div className="mb-6 text-center text-slate-600 dark:text-slate-400">
                                            Loading notification settings...
                                        </div>
                                    ) : adminNotificationError ? (
                                        <div className="mb-6 text-center text-red-600 dark:text-red-400">
                                            {adminNotificationError}
                                        </div>
                                    ) : adminNotificationSettings && (
                                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-4">
                                                Notification System Settings
                                            </h4>
                                            
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="font-medium text-blue-800 dark:text-blue-200">
                                                            Timetable Notifications
                                                        </h5>
                                                        <p className="text-sm text-blue-600 dark:text-blue-300">
                                                            Enable automatic notifications for timetable changes
                                                        </p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={adminNotificationSettings.enableTimetableNotifications}
                                                            onChange={(e) =>
                                                                handleUpdateAdminNotificationSettings({
                                                                    enableTimetableNotifications: e.target.checked
                                                                })
                                                            }
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="font-medium text-blue-800 dark:text-blue-200">
                                                            Access Request Notifications
                                                        </h5>
                                                        <p className="text-sm text-blue-600 dark:text-blue-300">
                                                            Notify user managers about new access requests
                                                        </p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={adminNotificationSettings.enableAccessRequestNotifications}
                                                            onChange={(e) =>
                                                                handleUpdateAdminNotificationSettings({
                                                                    enableAccessRequestNotifications: e.target.checked
                                                                })
                                                            }
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                                        Timetable Check Interval (minutes)
                                                    </label>
                                                    <p className="text-xs text-blue-600 dark:text-blue-300 mb-2">
                                                        How often to check for timetable changes (5-1440 minutes)
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="5"
                                                            max="1440"
                                                            value={adminNotificationSettings.timetableFetchInterval}
                                                            onChange={(e) => {
                                                                const value = parseInt(e.target.value);
                                                                if (value >= 5 && value <= 1440) {
                                                                    handleUpdateAdminNotificationSettings({
                                                                        timetableFetchInterval: value
                                                                    });
                                                                }
                                                            }}
                                                            className="w-20 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                                        />
                                                        <span className="text-sm text-blue-600 dark:text-blue-300">
                                                            minutes
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Whitelist management (username-only) */}
                                    {settings?.whitelistEnabled ? (
                                        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-medium text-slate-800 dark:text-slate-100">
                                                    Whitelist
                                                </h4>
                                            </div>
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                                <input
                                                    className="input"
                                                    placeholder={
                                                        'Enter username'
                                                    }
                                                    value={wlValue}
                                                    onChange={(e) =>
                                                        setWlValue(
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="btn-primary"
                                                    disabled={
                                                        wlLoading ||
                                                        !wlValue.trim()
                                                    }
                                                    onClick={
                                                        handleAddWhitelistRule
                                                    }
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            {wlError && (
                                                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                                                    {wlError}
                                                </div>
                                            )}
                                            <div className="mt-4 overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead className="text-left text-slate-700 dark:text-slate-200">
                                                        <tr>
                                                            <th className="py-2 pr-4">
                                                                Username
                                                            </th>
                                                            <th className="py-2 pr-4">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {whitelist.map((r) => (
                                                            <tr
                                                                key={r.id}
                                                                className="border-t border-slate-200/70 dark:border-slate-700/70"
                                                            >
                                                                <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                                                    {r.value}
                                                                </td>
                                                                <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                                                    <button
                                                                        className="btn-secondary"
                                                                        disabled={
                                                                            wlLoading
                                                                        }
                                                                        onClick={() =>
                                                                            handleDeleteWhitelistRule(
                                                                                r.id
                                                                            )
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {whitelist.length ===
                                                            0 && (
                                                            <tr>
                                                                <td
                                                                    colSpan={2}
                                                                    className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                                >
                                                                    No usernames
                                                                    whitelisted
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Pending Access Requests (admin only, when whitelist enabled) */}
                                    {settings?.whitelistEnabled ? (
                                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-medium text-blue-800 dark:text-blue-200">
                                                    Pending Access Requests
                                                </h4>
                                                <button
                                                    className="btn-secondary text-xs"
                                                    onClick={loadAccessRequests}
                                                    disabled={arLoading}
                                                >
                                                    {arLoading ? 'Loading...' : 'Refresh'}
                                                </button>
                                            </div>
                                            {arError && (
                                                <div className="mb-3 text-sm text-red-600 dark:text-red-400">
                                                    {arError}
                                                </div>
                                            )}
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-sm">
                                                    <thead className="text-left text-blue-700 dark:text-blue-200">
                                                        <tr>
                                                            <th className="py-2 pr-4">
                                                                Username
                                                            </th>
                                                            <th className="py-2 pr-4">
                                                                Message
                                                            </th>
                                                            <th className="py-2 pr-4">
                                                                Requested
                                                            </th>
                                                            <th className="py-2 pr-4">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {accessRequests.map((request) => (
                                                            <tr
                                                                key={request.id}
                                                                className="border-t border-blue-200/70 dark:border-blue-700/70"
                                                            >
                                                                <td className="py-2 pr-4 text-slate-900 dark:text-slate-100 font-medium">
                                                                    {request.username}
                                                                </td>
                                                                <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 max-w-xs">
                                                                    {request.message ? (
                                                                        <div className="truncate" title={request.message}>
                                                                            {request.message}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-500 italic">
                                                                            No message
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2 pr-4 text-slate-600 dark:text-slate-400 text-xs">
                                                                    {new Date(request.createdAt).toLocaleDateString()}
                                                                </td>
                                                                <td className="py-2 pr-4">
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            className="btn-primary text-xs px-2 py-1"
                                                                            disabled={arLoading}
                                                                            onClick={() =>
                                                                                handleAcceptAccessRequest(request.id)
                                                                            }
                                                                        >
                                                                            Accept
                                                                        </button>
                                                                        <button
                                                                            className="btn-secondary text-xs px-2 py-1"
                                                                            disabled={arLoading}
                                                                            onClick={() =>
                                                                                handleDeclineAccessRequest(request.id)
                                                                            }
                                                                        >
                                                                            Decline
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {accessRequests.length === 0 && !arLoading && (
                                                            <tr>
                                                                <td
                                                                    colSpan={4}
                                                                    className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                                >
                                                                    No pending access requests
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {arLoading && (
                                                            <tr>
                                                                <td
                                                                    colSpan={4}
                                                                    className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                                >
                                                                    Loading access requests...
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Users list */}
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="text-left text-slate-600 dark:text-slate-300">
                                                <tr>
                                                    <th className="py-2 pr-4">
                                                        Username
                                                    </th>
                                                    <th className="py-2 pr-4">
                                                        Display name
                                                    </th>
                                                    <th className="py-2 pr-4">
                                                        User Manager
                                                    </th>
                                                    <th className="py-2 pr-4">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map((u, index) => (
                                                    <tr
                                                        key={u.id}
                                                        className={`${
                                                            index !==
                                                            users.length - 1
                                                                ? 'border-b border-slate-200 dark:border-slate-700'
                                                                : ''
                                                        }`}
                                                    >
                                                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                                                            {u.username}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                            {editingUserId ===
                                                            u.id ? (
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editDisplayName
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setEditDisplayName(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        placeholder="Display name"
                                                                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                                                                    />
                                                                    <button
                                                                        className="btn-primary text-xs px-2 py-1"
                                                                        onClick={() =>
                                                                            saveEditUser(
                                                                                u.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        className="btn-secondary text-xs px-2 py-1"
                                                                        onClick={
                                                                            cancelEditUser
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span>
                                                                    {u.displayName ||
                                                                        '—'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                            {u.isUserManager ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                                                    ✓ Manager
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 dark:text-slate-500">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {editingUserId ===
                                                            u.id ? null : (
                                                                <div className="flex flex-wrap gap-2">
                                                                    <button
                                                                        className="btn-secondary text-sm"
                                                                        onClick={() =>
                                                                            startEditUser(
                                                                                u.id,
                                                                                u.displayName
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading || userManagerChanging === u.id
                                                                        }
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    {u.isUserManager ? (
                                                                        <button
                                                                            className="btn-secondary text-sm bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
                                                                            onClick={() =>
                                                                                setShowConfirmUserManager({
                                                                                    userId: u.id,
                                                                                    username: u.username,
                                                                                    isGranting: false,
                                                                                })
                                                                            }
                                                                            disabled={
                                                                                userManagementLoading || userManagerChanging === u.id
                                                                            }
                                                                        >
                                                                            {userManagerChanging === u.id ? 'Loading...' : 'Revoke'}
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            className="btn-primary text-sm"
                                                                            onClick={() =>
                                                                                setShowConfirmUserManager({
                                                                                    userId: u.id,
                                                                                    username: u.username,
                                                                                    isGranting: true,
                                                                                })
                                                                            }
                                                                            disabled={
                                                                                userManagementLoading || userManagerChanging === u.id
                                                                            }
                                                                        >
                                                                            {userManagerChanging === u.id ? 'Loading...' : 'Grant Manager'}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                        onClick={() =>
                                                                            deleteUser(
                                                                                u.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading || userManagerChanging === u.id
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {users.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="py-8 text-center text-slate-500 dark:text-slate-400"
                                                        >
                                                            No users found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : user.isUserManager ? (
                        // User Manager Section
                        <>
                            <div className="p-6">
                                <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                                    User Management
                                </h2>
                                <p className="text-slate-600 dark:text-slate-300 mb-6">
                                    You have user manager privileges. You can manage users, whitelist entries, and access requests.
                                </p>

                                {/* User-manager whitelist management */}
                                {settings?.whitelistEnabled && (
                                    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-slate-800 dark:text-slate-100">
                                                Manage Whitelist
                                            </h4>
                                        </div>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <input
                                                className="input"
                                                placeholder="Enter username"
                                                value={umWlValue}
                                                onChange={(e) => setUmWlValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && umWlValue.trim()) {
                                                        handleUserManagerAddRule(umWlValue.trim());
                                                    }
                                                }}
                                                disabled={umWlLoading}
                                            />
                                            <button
                                                className="btn-primary whitespace-nowrap"
                                                onClick={() => handleUserManagerAddRule(umWlValue.trim())}
                                                disabled={umWlLoading || !umWlValue.trim()}
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {umWlError && (
                                            <div className="mt-2 text-sm text-red-600">{umWlError}</div>
                                        )}
                                        <div className="mt-4 overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="text-left text-slate-700 dark:text-slate-200">
                                                    <tr>
                                                        <th className="py-2 pr-4">Username</th>
                                                        <th className="py-2 pr-4">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {umWhitelist.map((r) => (
                                                        <tr
                                                            key={r.id}
                                                            className="border-t border-slate-200/70 dark:border-slate-700/70"
                                                        >
                                                            <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                                                {r.value}
                                                            </td>
                                                            <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                                                <button 
                                                                    className="btn-secondary" 
                                                                    onClick={() => handleUserManagerDeleteRule(r.id)}
                                                                    disabled={umWlLoading}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {umWhitelist.length === 0 && (
                                                        <tr>
                                                            <td
                                                                colSpan={2}
                                                                className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                            >
                                                                No usernames whitelisted
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* User-manager access requests management */}
                                {settings?.whitelistEnabled && (
                                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-blue-800 dark:text-blue-200">
                                                Pending Access Requests
                                            </h4>
                                            <button
                                                className="btn-secondary text-xs"
                                                onClick={loadUserManagerAccessRequests}
                                                disabled={umArLoading}
                                            >
                                                {umArLoading ? 'Loading...' : 'Refresh'}
                                            </button>
                                        </div>
                                        {umArError && (
                                            <div className="mb-3 text-sm text-red-600 dark:text-red-400">
                                                {umArError}
                                            </div>
                                        )}
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="text-left text-blue-700 dark:text-blue-200">
                                                    <tr>
                                                        <th className="py-2 pr-4">
                                                            Username
                                                        </th>
                                                        <th className="py-2 pr-4">
                                                            Message
                                                        </th>
                                                        <th className="py-2 pr-4">
                                                            Requested
                                                        </th>
                                                        <th className="py-2 pr-4">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {umAccessRequests.map((request) => (
                                                        <tr
                                                            key={request.id}
                                                            className="border-t border-blue-200/70 dark:border-blue-700/70"
                                                        >
                                                            <td className="py-2 pr-4 text-slate-900 dark:text-slate-100 font-medium">
                                                                {request.username}
                                                            </td>
                                                            <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 max-w-xs">
                                                                {request.message ? (
                                                                    <div className="truncate" title={request.message}>
                                                                        {request.message}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-500 italic">
                                                                        No message
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 pr-4 text-slate-600 dark:text-slate-400 text-xs">
                                                                {new Date(request.createdAt).toLocaleDateString()}
                                                            </td>
                                                            <td className="py-2 pr-4">
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        className="btn-primary text-xs px-2 py-1"
                                                                        disabled={umArLoading}
                                                                        onClick={() =>
                                                                            handleUserManagerAcceptAccessRequest(request.id)
                                                                        }
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        className="btn-secondary text-xs px-2 py-1"
                                                                        disabled={umArLoading}
                                                                        onClick={() =>
                                                                            handleUserManagerDeclineAccessRequest(request.id)
                                                                        }
                                                                    >
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {umAccessRequests.length === 0 && !umArLoading && (
                                                        <tr>
                                                            <td
                                                                colSpan={4}
                                                                className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                            >
                                                                No pending access requests
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {umArLoading && (
                                                        <tr>
                                                            <td
                                                                colSpan={4}
                                                                className="py-3 text-center text-slate-500 dark:text-slate-400"
                                                            >
                                                                Loading access requests...
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Personal display name section for user-managers */}
                            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
                                    Personal Settings
                                </h3>
                                <div className="mb-4">
                                    <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Display Name
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            id="displayName"
                                            className="input flex-1"
                                            placeholder="Your display name"
                                            value={myDisplayName}
                                            onChange={(e) => setMyDisplayName(e.target.value)}
                                            disabled={savingMyName}
                                        />
                                        <button
                                            className="btn-primary"
                                            onClick={handleSaveMyDisplayName}
                                            disabled={savingMyName || myDisplayName === (user.displayName ?? '')}
                                        >
                                            {savingMyName ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                    {myNameError && (
                                        <div className="mt-2 text-sm text-red-600">{myNameError}</div>
                                    )}
                                    {myNameSaved && (
                                        <div className="mt-2 text-sm text-green-600">Display name updated!</div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        // Regular User Sharing Settings Section
                        <>
                            {loading ? (
                                <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                                    Loading settings...
                                </div>
                            ) : error ? (
                                <div className="p-6 text-center text-red-600 dark:text-red-400">
                                    {error}
                                </div>
                            ) : settings ? (
                                <div className="p-6 space-y-6">
                                    {/* Personal display name */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                            Display name
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={myDisplayName}
                                                onChange={(e) => {
                                                    setMyDisplayName(
                                                        e.target.value
                                                    );
                                                    setMyNameSaved(false);
                                                }}
                                                placeholder="Optional friendly name"
                                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                className="btn-primary"
                                                onClick={saveMyDisplayName}
                                                disabled={savingMyName}
                                            >
                                                Save
                                            </button>
                                        </div>
                                        {myNameError && (
                                            <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                {myNameError}
                                            </div>
                                        )}
                                        {myNameSaved && !myNameError && (
                                            <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                                                Saved
                                            </div>
                                        )}
                                    </div>

                                    {/* Notification Settings */}
                                    {notificationLoading ? (
                                        <div className="text-center text-slate-600 dark:text-slate-400">
                                            Loading notification settings...
                                        </div>
                                    ) : notificationError ? (
                                        <div className="text-center text-red-600 dark:text-red-400">
                                            {notificationError}
                                        </div>
                                    ) : notificationSettings && (
                                        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                            <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
                                                Notification Preferences
                                            </h3>
                                            
                                            {/* Browser notification permission */}
                                            {isNotificationSupported() && (
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h4 className="font-medium text-slate-900 dark:text-slate-100">
                                                                Browser Notifications
                                                            </h4>
                                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                                {notificationPermission === 'granted' 
                                                                    ? 'Get notified about important updates'
                                                                    : notificationPermission === 'denied'
                                                                    ? 'Notifications are blocked. Enable them in your browser settings.'
                                                                    : 'Allow notifications to stay updated on changes'
                                                                }
                                                            </p>
                                                        </div>
                                                        {notificationPermission === 'default' && (
                                                            <button
                                                                onClick={handleRequestNotificationPermission}
                                                                className="btn-primary text-sm"
                                                            >
                                                                Enable
                                                            </button>
                                                        )}
                                                        {notificationPermission === 'granted' && (
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={notificationSettings.browserNotificationsEnabled}
                                                                    onChange={(e) =>
                                                                        handleUpdateNotificationSettings({
                                                                            browserNotificationsEnabled: e.target.checked
                                                                        })
                                                                    }
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notification type preferences */}
                                            {notificationSettings.browserNotificationsEnabled && (
                                                <div className="space-y-3 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                Cancelled Lessons
                                                            </h5>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                When your lessons are cancelled
                                                            </p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={notificationSettings.cancelledLessonsEnabled}
                                                                onChange={(e) =>
                                                                    handleUpdateNotificationSettings({
                                                                        cancelledLessonsEnabled: e.target.checked
                                                                    })
                                                                }
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                Irregular Lessons
                                                            </h5>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                When lessons have schedule changes
                                                            </p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={notificationSettings.irregularLessonsEnabled}
                                                                onChange={(e) =>
                                                                    handleUpdateNotificationSettings({
                                                                        irregularLessonsEnabled: e.target.checked
                                                                    })
                                                                }
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                Timetable Changes
                                                            </h5>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                General timetable updates
                                                            </p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={notificationSettings.timetableChangesEnabled}
                                                                onChange={(e) =>
                                                                    handleUpdateNotificationSettings({
                                                                        timetableChangesEnabled: e.target.checked
                                                                    })
                                                                }
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </div>

                                                    {(user.isUserManager || user.isAdmin) && (
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                                    Access Requests
                                                                </h5>
                                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                    New user access requests
                                                                </p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={notificationSettings.accessRequestsEnabled}
                                                                    onChange={(e) =>
                                                                        handleUpdateNotificationSettings({
                                                                            accessRequestsEnabled: e.target.checked
                                                                        })
                                                                    }
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Personal sharing toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-slate-900 dark:text-slate-100">
                                                Enable Timetable Sharing
                                            </h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Allow others to see your
                                                timetable
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    settings.sharingEnabled
                                                }
                                                onChange={(e) =>
                                                    handleToggleSharing(
                                                        e.target.checked
                                                    )
                                                }
                                                disabled={
                                                    !settings.globalSharingEnabled
                                                }
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                                        </label>
                                    </div>

                                    {settings.globalSharingEnabled ? (
                                        <>
                                            {/* Search and add users */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                                    Share with new people
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search users by name or username..."
                                                        value={searchQuery}
                                                        onChange={(e) =>
                                                            setSearchQuery(
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    {searchLoading && (
                                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                {searchResults.length > 0 && (
                                                    <div className="mt-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 max-h-40 overflow-y-auto">
                                                        {searchResults.map(
                                                            (result) => (
                                                                <button
                                                                    key={
                                                                        result.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleShareWithUser(
                                                                            result
                                                                        )
                                                                    }
                                                                    disabled={settings.sharingWith.some(
                                                                        (u) =>
                                                                            u.id ===
                                                                            result.id
                                                                    )}
                                                                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
                                                                >
                                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                                        {result.displayName ||
                                                                            result.username}
                                                                    </div>
                                                                    {result.displayName && (
                                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                            {
                                                                                result.username
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Current sharing list */}
                                            <div>
                                                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">
                                                    People you're sharing with (
                                                    {
                                                        settings.sharingWith
                                                            .length
                                                    }
                                                    )
                                                </h3>
                                                {settings.sharingWith.length ===
                                                0 ? (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                                        You're not sharing your
                                                        timetable with anyone
                                                        yet.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {settings.sharingWith.map(
                                                            (sharedUser) => (
                                                                <div
                                                                    key={
                                                                        sharedUser.id
                                                                    }
                                                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                                                            {sharedUser.displayName ||
                                                                                sharedUser.username}
                                                                        </div>
                                                                        {sharedUser.displayName && (
                                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                {
                                                                                    sharedUser.username
                                                                                }
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleStopSharing(
                                                                                sharedUser.id
                                                                            )
                                                                        }
                                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded"
                                                                        title="Stop sharing"
                                                                    >
                                                                        <svg
                                                                            width="16"
                                                                            height="16"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                        >
                                                                            <path
                                                                                d="M18 6L6 18M6 6l12 12"
                                                                                stroke="currentColor"
                                                                                strokeWidth="2"
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                            <p className="text-slate-600 dark:text-slate-400">
                                                Timetable sharing is currently
                                                disabled by an administrator.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>

            {/* User Manager Grant/Revoke Confirmation Modal */}
            {showConfirmUserManager && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
                            {showConfirmUserManager.isGranting ? 'Grant User Manager Status' : 'Revoke User Manager Status'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            {showConfirmUserManager.isGranting ? (
                                <>
                                    Grant <strong>{showConfirmUserManager.username}</strong> user manager privileges? They
                                    will be able to manage users, whitelist, and access requests.
                                </>
                            ) : (
                                <>
                                    Revoke <strong>{showConfirmUserManager.username}</strong> user manager privileges? They
                                    will lose access to user management features.
                                </>
                            )}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowConfirmUserManager(null)}
                                disabled={userManagerChanging !== null}
                            >
                                Cancel
                            </button>
                            <button
                                className={showConfirmUserManager.isGranting ? "btn-primary" : "btn-secondary bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"}
                                onClick={() => {
                                    if (showConfirmUserManager.isGranting) {
                                        handleGrantUserManager(showConfirmUserManager.userId);
                                    } else {
                                        handleRevokeUserManager(showConfirmUserManager.userId);
                                    }
                                }}
                                disabled={userManagerChanging !== null}
                            >
                                {userManagerChanging !== null ? 'Loading...' : (showConfirmUserManager.isGranting ? 'Grant' : 'Revoke')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
