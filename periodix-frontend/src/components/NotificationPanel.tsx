import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Notification } from '../types';
import { formatNotificationTime } from '../utils/notifications';
import {
    markNotificationAsRead,
    deleteNotification,
    markAllNotificationsAsRead,
} from '../api';

interface NotificationPanelProps {
    notifications: Notification[];
    token: string;
    isOpen: boolean;
    onClose: () => void;
    onNotificationUpdate: () => void;
}

export default function NotificationPanel({
    notifications,
    token,
    isOpen,
    onClose,
    onNotificationUpdate,
}: NotificationPanelProps) {
    const [showPanel, setShowPanel] = useState(false);
    const [animating, setAnimating] = useState(false);
    const [loading, setLoading] = useState(false);

    // Animation state management
    useEffect(() => {
        let timeout: number | undefined;
        if (isOpen) {
            // Mount immediately and start animating shortly after to ensure transition runs
            if (!showPanel) setShowPanel(true);
            timeout = window.setTimeout(() => setAnimating(true), 10);
        } else if (showPanel) {
            // Begin exit transition
            setAnimating(false);
            timeout = window.setTimeout(() => setShowPanel(false), 200);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [isOpen, showPanel]);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markNotificationAsRead(token, notificationId);
            onNotificationUpdate();
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const handleDelete = async (notificationId: string) => {
        try {
            await deleteNotification(token, notificationId);
            onNotificationUpdate();
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        setLoading(true);
        try {
            await markAllNotificationsAsRead(token);
            onNotificationUpdate();
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        } finally {
            setLoading(false);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'cancelled_lesson':
                return (
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-red-600 dark:text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                );
            case 'irregular_lesson':
                return (
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                );
            case 'access_request':
                return (
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-blue-600 dark:text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                    </div>
                );
            case 'timetable_change':
                return (
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-green-600 dark:text-green-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                );
            case 'absence_new':
            case 'absence_change':
                return (
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <svg
                            className="w-4 h-4 text-slate-600 dark:text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 17h5l-5 5v-5zM9 12l2 2 4-4"
                            />
                        </svg>
                    </div>
                );
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    if (!showPanel) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-200 ${
                    animating ? 'opacity-50' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={`absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-xl transform transition-transform duration-200 ${
                    animating ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-2">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Notifications
                        </h2>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Actions */}
                {notifications.length > 0 && unreadCount > 0 && (
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <button
                            onClick={handleMarkAllAsRead}
                            disabled={loading}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading
                                ? 'Marking as read...'
                                : 'Mark all as read'}
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                <svg
                                    className="w-8 h-8 text-slate-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 17h5l-5 5v-5zM9 12l2 2 4-4"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                                No notifications
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400">
                                You're all caught up! Check back later for
                                updates.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`flex items-start space-x-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                        !notification.read
                                            ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                            : ''
                                    }`}
                                >
                                    {/* Icon */}
                                    {getNotificationIcon(notification.type)}

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <h4
                                                className={`text-sm font-medium ${
                                                    !notification.read
                                                        ? 'text-slate-900 dark:text-slate-100'
                                                        : 'text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                {notification.title}
                                            </h4>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2 flex-shrink-0">
                                                {formatNotificationTime(
                                                    notification.createdAt
                                                )}
                                            </span>
                                        </div>
                                        <p
                                            className={`text-sm mt-1 ${
                                                !notification.read
                                                    ? 'text-slate-700 dark:text-slate-200'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            {notification.message}
                                        </p>

                                        {/* Actions */}
                                        <div className="flex items-center space-x-3 mt-2">
                                            {!notification.read && (
                                                <button
                                                    onClick={() =>
                                                        handleMarkAsRead(
                                                            notification.id
                                                        )
                                                    }
                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                                >
                                                    Mark as read
                                                </button>
                                            )}
                                            <button
                                                onClick={() =>
                                                    handleDelete(
                                                        notification.id
                                                    )
                                                }
                                                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
