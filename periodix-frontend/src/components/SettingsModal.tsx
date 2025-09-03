import { useState, useEffect, useCallback } from 'react';
import type {
    User,
} from '../types';
import {
    getSharingSettings,
} from '../api';

// Import modular components
import TabNavigation from './settings/TabNavigation';
import NicknameChange from './settings/NicknameChange';
import NotificationSettingsComponent from './settings/NotificationSettings';
import SharingSettingsComponent from './settings/SharingSettings';
import AdminUserManagement from './settings/AdminUserManagement';
import UserManagerAccessManagement from './settings/UserManagerAccessManagement';
import AdminAccessManagement from './settings/AdminAccessManagement';
import UserManagement from './settings/UserManagement';

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

    // Tab state for organized settings menu - different tabs for different user types
    const [activeTab, setActiveTab] = useState<string>(() => {
        if (user.isAdmin) return 'access';
        if (user.isUserManager) return 'nickname';
        return 'nickname'; // Regular users start with nickname tab
    });

    // Load settings when modal opens (for future use by modular components)
    const loadSettings = useCallback(async () => {
        try {
            const sharingSettings = await getSharingSettings(token);
            // Settings will be used by modular components
            console.log('Settings loaded:', sharingSettings);
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen, loadSettings]);

    if (!showModal) return null;

    return (
        <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-${ANIM_MS} p-4 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-[800px] h-[95vh] max-h-[700px] transition-all duration-${ANIM_MS} border border-slate-200 dark:border-slate-700 ${
                    isVisible
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-95 translate-y-4'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Settings
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Manage your account and preferences
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col lg:flex-row h-[calc(95vh-120px)] max-h-[calc(700px-120px)]">
                    {/* Tab Navigation - Mobile: top, Desktop: left sidebar */}
                    <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                        <div className="p-6">
                            <TabNavigation 
                                user={user}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-6 h-full">
                            {/* All tab contents rendered but with conditional visibility */}
                            <div className={`${activeTab === 'nickname' ? 'block' : 'hidden'}`}>
                                <NicknameChange
                                    token={token}
                                    user={user}
                                    onUserUpdate={onUserUpdate}
                                />
                            </div>

                            {/* Personal Sharing Settings Tab - Available for Users and User-Managers */}
                            {!user.isAdmin && (
                                <div className={`${activeTab === 'sharing' ? 'block' : 'hidden'}`}>
                                    <SharingSettingsComponent
                                        token={token}
                                        isVisible={activeTab === 'sharing'}
                                    />
                                </div>
                            )}

                            {/* Notification Settings Tab - Available for Users and User-Managers */}
                            {!user.isAdmin && (
                                <div className={`${activeTab === 'notifications' ? 'block' : 'hidden'}`}>
                                    <NotificationSettingsComponent
                                        token={token}
                                        user={user}
                                        isVisible={activeTab === 'notifications'}
                                    />
                                </div>
                            )}

                            {/* User Management Tab - Available for Admins only */}
                            {user.isAdmin && (
                                <div className={`${activeTab === 'users' ? 'block' : 'hidden'}`}>
                                    <UserManagement
                                        token={token}
                                        user={user}
                                        isVisible={activeTab === 'users'}
                                    />
                                </div>
                            )}

                            {/* Whitelist & Access Request Tab - Available for User-Managers and Admins */}
                            {user.isUserManager && !user.isAdmin && (
                                <div className={`${activeTab === 'access' ? 'block' : 'hidden'}`}>
                                    <UserManagerAccessManagement
                                        token={token}
                                        user={user}
                                        isVisible={activeTab === 'access'}
                                    />
                                </div>
                            )}

                            {user.isAdmin && (
                                <div className={`${activeTab === 'access' ? 'block' : 'hidden'}`}>
                                    <AdminAccessManagement
                                        token={token}
                                        user={user}
                                        isVisible={activeTab === 'access'}
                                    />
                                </div>
                            )}

                            {/* Global Sharing Toggle Tab - Available for Admins only */}
                            {user.isAdmin && (
                                <div className={`${activeTab === 'global' ? 'block' : 'hidden'}`}>
                                    <div className="space-y-6">
                                        <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                                                Global Sharing Control
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                System-wide sharing settings
                                            </p>
                                        </div>
                                        {/* Use existing AdminUserManagement component which has global sharing toggle */}
                                        <AdminUserManagement
                                            token={token}
                                            user={user}
                                            isVisible={activeTab === 'global'}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}